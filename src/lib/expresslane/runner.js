// EXPRESS LANE, TIER 3c — the staging runner.
//
// The one moving part. It walks the queue in staging.js, asks Tier 2 for a
// clip's URL, downloads the bytes, and puts them in the byte store. Every
// piece it talks to is injected, so the whole loop runs in a Node test with no
// network, no IndexedDB and no browser.
//
// SINGLE-THREADED, AND THAT IS A MEASUREMENT RATHER THAN A STYLE.
// MLB's clip hosts throttle to about 2.1 Mbps and concurrency does not help:
// seven parallel downloads gave 2.0 Mbps AGGREGATE, the same as one alone,
// while the condensed-game host this app already uses ran at 134 Mbps on the
// same connection in the same minute. So the throttle is MLB's clip
// infrastructure, not the network and not this code, and a pool would only
// spread one pipe across seven sockets. DO NOT ADD ONE.
//
// AND NO ROLLING PREFETCH WINDOW. A clip is 4-6 MB for about 7.5 seconds of
// video, so it takes two to three times longer to fetch than to watch. A
// window that fetches on demand falls further behind on every clip and can
// never recover. Staging runs ahead of the scorer or it does not work.
//
// POLITE, BECAUSE THE HOST INSISTS. `sporty-clips.mlb.com` sits behind
// Cloudflare on HTTP/1.1 and starts returning empty bodies and then a hard 403
// after roughly 25 requests in a few minutes. Ordinary staging never comes
// near that — a 6 MB clip at 2.1 Mbps takes about 25 seconds, so the loop
// makes about two requests a minute all by itself — but the gap below is kept
// anyway, and a 403 stops the job rather than being retried into a longer ban.
//
// VERIFIED 2026-09-10, and the whole tier rests on it: the byte host answers a
// cross-origin request with `access-control-allow-origin: *` and a real 206
// with `Content-Range`. So a browser `fetch()` can read the bytes and hand
// back a Blob. No proxy, no service worker, no Referer spoofing — which is
// also what keeps this inside MLB's Terms of Use, where on-device storage for
// personal use is carved out and re-serving is not.

import {
  blockJob,
  enqueueHalf,
  evictable,
  markByteFailure,
  markComplete,
  markEvicted,
  markResolveMiss,
  markStaged,
  nextToStage,
  pauseJob,
  resumeJob,
  retryUnfilmedAhead,
  setCursor,
  consentToSkip,
  withMode,
} from './staging.js'
import { deleteClips, putClip, stagedPlayIds } from './byteStore.js'

// Between two downloads. Small: the download itself is the real rate limit.
const DEFAULT_GAP_MS = 750

// Before asking again for a clip that resolved to nothing. Clips publish 8 to
// 26 minutes after the pitch, so an empty answer is often a timing answer.
const DEFAULT_RETRY_MS = 20_000

// Before sweeping the rows written off as unfilmed once more. This is the
// answer to the scorer who opens a game minutes after the last out and meets
// the publication frontier rather than the bandwidth ceiling: the queue drains
// early, waits, and asks again for the film ahead of the cursor.
const DEFAULT_RESWEEP_MS = 90_000

// The default downloader. `cache: 'no-store'` on purpose — the bytes are about
// to be stored as a Blob, and letting the HTTP cache keep its own copy would
// pay for a 546 MB game twice against one origin quota.
async function defaultFetchClip(url, { signal } = {}) {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) return { ok: false, status: response.status, blob: null }
  return { ok: true, status: response.status, blob: await response.blob() }
}

const defaultSleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

// Build a runner around one job.
//
//   resolveClip  async (playId) => url | null   — Tier 2, injected so the
//                                                 runner never imports a
//                                                 network module directly
//   fetchClip    async (url, { signal }) => { ok, status, blob }
//   store        the byte store, injected for the same reason
//   onChange     called with the new job on every transition
//
// The runner OWNS the job. A caller reads it through `getJob()` and changes it
// through the commands below, so there is one writer and the surface cannot
// hand back a stale copy mid-download.
export function createStagingRunner({
  job: initialJob,
  resolveClip,
  fetchClip = defaultFetchClip,
  store = { putClip, deleteClips, stagedPlayIds },
  sleep = defaultSleep,
  onChange = () => {},
  gapMs = DEFAULT_GAP_MS,
  retryMs = DEFAULT_RETRY_MS,
  resweepMs = DEFAULT_RESWEEP_MS,
  lookbehind,
  // The staging plan's one knob (STAGING_PLANS in staging.js): how many queue
  // positions past the cursor this runner may fetch. `Infinity` runs the queue
  // dry, which is what `ahead` and `all` both do; `1` fetches only the row the
  // scorer is about to need, which is `demand`. It changes nothing about the
  // gate — the cursor still may not pass the picture — only when the bytes are
  // paid for.
  horizon = Infinity,
}) {
  let job = initialJob
  let pumping = false
  let stopped = false
  let started = false
  let controller = null

  // A SLEEP THAT NEW WORK CAN CUT SHORT.
  //
  // The loop waits in two places — between retries, and before the re-sweep —
  // and it holds `pumping` while it does, so a plain `sleep` made the runner
  // deaf for as long as 90 seconds. That is not theoretical: a half whose film
  // has finished staging drains, the loop settles into the re-sweep nap, and
  // the scorer then finishes the half and steps into the next one. `addHalf`
  // queues its rows and calls `pump`, which returns at once against the
  // re-entry guard — so the new half sat there unstaged and the surface showed
  // "Getting the first few plays." until the nap ran out. Found by walking a
  // game under `?nofilm`, where every half drains instantly and the stall is the
  // first thing that happens.
  //
  // Returns true when it was woken rather than timed out, which is the caller's
  // cue to look at the queue again instead of carrying on to the re-sweep.
  let wake = null
  const wakeUp = () => {
    const resume = wake
    wake = null
    resume?.(true)
  }
  const nap = async (ms) => {
    const woken = await Promise.race([
      sleep(ms).then(() => false),
      new Promise((resolve) => {
        wake = resolve
      }),
    ])
    wake = null
    return woken
  }

  const update = (nextJob) => {
    if (nextJob === job) return
    job = nextJob
    onChange(job)
  }

  // Drop the clips behind the scorer. Runs after a cursor move and after each
  // clip lands, so the working set stays near the staging lead rather than
  // growing to the 546 MB a whole game weighs.
  const sweep = async () => {
    const gone = evictable(job, lookbehind === undefined ? {} : { lookbehind })
    if (!gone.length) return
    const removed = await store.deleteClips(job.gamePk, gone)
    // Only forget what really went. A job that lied about the disk would
    // re-stage clips that are still there, or leave ones that are not.
    if (removed) update(markEvicted(job, gone))
  }

  // One clip, start to finish. Returns how the loop should carry on:
  //   'next'   go straight to the following row
  //   'retry'  the same row again, after a wait
  //   'stop'   the job is blocked or the runner was stopped
  const stageOne = async (entry) => {
    const { playId } = entry
    let url = null
    try {
      url = await resolveClip(playId)
    } catch {
      url = null
    }
    if (stopped) return 'stop'

    if (!url) {
      // Empty. Counted rather than acted on: three empties and the row becomes
      // paperwork and the queue moves past it. This is the phantom-playId path
      // (#1024) and the not-published-yet path, and nothing at the time tells
      // them apart — which is why neither one prompts the scorer.
      update(markResolveMiss(job, playId))
      // Once the attempts run out the row IS paperwork, so the queue moves on
      // at once rather than sitting through a retry wait it no longer needs.
      return job.unfilmed.has(playId) ? 'next' : 'retry'
    }

    controller = typeof AbortController === 'function' ? new AbortController() : null
    let result
    try {
      result = await fetchClip(url, { signal: controller?.signal })
    } catch {
      result = { ok: false, status: 0, blob: null }
    } finally {
      controller = null
    }
    if (stopped) return 'stop'

    if (!result?.ok) {
      // A 403 is the host refusing this client, not one clip going wrong.
      // Retrying it earns a longer ban, so the job stops and says why.
      if (result?.status === 403) {
        update(blockJob(job, 'host'))
        return 'stop'
      }
      update(markByteFailure(job, playId))
      return job.state === 'blocked' ? 'stop' : 'retry'
    }

    const outcome = await store.putClip(job.gamePk, playId, result.blob)
    if (outcome === 'stored') {
      update(markStaged(job, playId))
      await sweep()
      return 'next'
    }
    if (outcome === 'quota') {
      // A full disk is not a bad clip. Stopping is the only honest answer:
      // the next clip would hit the same wall.
      update(blockJob(job, 'quota'))
      return 'stop'
    }
    update(markByteFailure(job, playId))
    return job.state === 'blocked' ? 'stop' : 'retry'
  }

  const pump = async () => {
    if (pumping) return
    pumping = true
    let resweptAt = 0
    try {
      while (!stopped) {
        if (job.state === 'paused' || job.state === 'blocked') break
        const entry = nextToStage(job, { horizon })
        if (!entry) {
          // OUT OF REACH IS NOT DRAINED, and conflating the two hangs the
          // `demand` plan on its first play. Under a finite horizon the queue is
          // normally full of rows the plan has not authorised yet: the loop has
          // no work now, but the game is not over and there is nothing to
          // re-sweep. It stops, and the next cursor move starts it again. Only a
          // queue with nothing left ANYWHERE is complete.
          if (nextToStage(job) !== null) break
          if (job.state !== 'complete') update(markComplete(job))
          // The queue is drained. Wait, then ask once more for the rows that
          // were written off — a clip that had not published when the queue
          // passed it may have published since. `retryUnfilmedAhead` returns
          // the same job when there is nothing to re-ask, which ends the loop.
          if (resweptAt >= 1 || !job.queue.length) break
          // Woken instead of timed out means a half joined the queue while this
          // was waiting. Look again rather than spending the one re-sweep on a
          // question nothing has asked yet.
          if (await nap(resweepMs)) continue
          if (stopped) break
          resweptAt += 1
          const before = job
          update(retryUnfilmedAhead(job))
          if (job === before) break
          continue
        }
        const step = await stageOne(entry)
        if (step === 'stop') break
        await nap(step === 'retry' ? retryMs : gapMs)
      }
    } finally {
      pumping = false
    }
  }

  return {
    getJob: () => job,

    // Start, or pick the loop back up after a pause.
    //
    // THE STORE IS READ BEFORE ANYTHING IS FETCHED, and the order is the whole
    // point: a game staged half-way before the app was closed picks up where
    // it stopped, because the clip URLs are deterministic and nothing already
    // on the disk is worth paying for twice. Staging that began before the
    // read would re-download the front of the queue every time.
    //
    // A BLOCKED JOB IS NOT STARTED. Starting clears a pause, which the scorer
    // asked for, but a block is the world's doing — a full disk, or a host
    // that has stopped answering — and driving straight back into it earns a
    // longer ban and hides why the job stopped. The scorer retries a block
    // deliberately, through `resume`.
    async start() {
      stopped = false
      if (!started) {
        const staged = await store.stagedPlayIds(job.gamePk)
        let resumed = job
        for (const playId of staged) resumed = markStaged(resumed, playId)
        update(resumed)
        started = true
      }
      if (job.state === 'paused') update(resumeJob(job))
      await pump()
    },

    pause() {
      update(pauseJob(job))
      controller?.abort()
    },

    async resume() {
      update(resumeJob(job))
      stopped = false
      wakeUp()
      await pump()
    },

    // Leaving the surface. The bytes stay: they are what makes coming back to
    // a half-scored game instant.
    stop() {
      stopped = true
      controller?.abort()
    },

    // The scorer moved. The gate is enforced inside `setCursor`, so a cursor
    // that would pass the film simply does not move.
    async moveCursor(key) {
      update(setCursor(job, key))
      await sweep()
      // A CURSOR MOVE IS WORK UNDER A FINITE HORIZON, and forgetting that
      // deadlocks `demand` on its first play. With `horizon: 1` the queue is
      // "drained" as soon as the one reachable row is covered, so `pump` marks
      // the job complete and stops. Moving the cursor is what brings the next
      // row into reach — nothing else does — so it has to restart the loop.
      // Under an infinite horizon the pump is already running or the queue is
      // genuinely finished, and `pump`'s own re-entry guard makes this free.
      const landed = job.cursorKey
      // NOT AWAITED, deliberately. `pump` runs until the queue is out of work,
      // which under `demand` means one whole ~25-second download — and the
      // caller of this is the tap that moves the cursor. Awaiting it would hold
      // the play on screen until its successor had finished arriving.
      wakeUp()
      if (started && Number.isFinite(horizon)) pump()
      return landed
    },

    // The next half the scorer has reached is now readable, so its rows join
    // the queue. This is the ONLY way the queue grows, and it is what keeps
    // the job from ever holding the whole game.
    //
    // Rows may be added before `start`, and nothing is fetched until it is
    // called: the store has to be read first, or the pre-roll pays again for
    // clips that are already here.
    async addHalf(rows) {
      update(enqueueHalf(job, rows))
      // Wake first, then pump: if the loop is napping it is holding the
      // re-entry guard, so `pump` alone would return without ever seeing these
      // rows.
      wakeUp()
      if (started) await pump()
    },

    // The escape hatch: score this row without the film. A deliberate act, and
    // it is offered only for a clip whose URL resolved and whose bytes will
    // not come — never for a row that resolved to nothing.
    async skipFilm(key) {
      update(consentToSkip(job, key))
      wakeUp()
      await pump()
    },

    async setMode(mode) {
      update(withMode(job, mode))
    },
  }
}
