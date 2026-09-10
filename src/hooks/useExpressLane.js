// Express Lane's one stateful hook: it joins the three data tiers to the
// screen and owns the cursor.
//
// Tier 1 (rail.js) says what the rows of a half-inning are. Tier 2
// (clipIndex.js) turns a row's playId into a URL. Tier 3 (staging.js +
// runner.js + byteStore.js) downloads the bytes and holds THE FILM GATE. This
// hook holds none of that logic — it wires them together, keeps the object URL
// of the clip on screen, and hands the surface a cursor it may ask to move.
//
// THE CURSOR IS THE LAST ROW WHOSE FILM HAS BEEN WATCHED. Everything the deck
// draws is at or behind it; nothing is ever drawn for the row ahead. Moving it
// forward is therefore the reveal act, and it drives the app's own
// `revealedThrough` mark so paper, screen and every other device stay in step.
//
// ONE HALF-INNING AT A TIME, which is the same unit InningViewer works in and
// the same unit ADR-0008 requires: a whole-game rail would state how many
// innings the game ran. The next half is enqueued only once the scorer reaches
// it, which is also exactly the staging lead the bandwidth ceiling wants.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildRail, resultModeRows, fullModeRows } from '../api/expresslane/rail.js'
import { expressDeck, railRevealCap, reachedPlateAppearances } from '../api/expresslane/runners.js'
import { resolveClipUrl } from '../api/expresslane/clipIndex.js'
import {
  createJob,
  gateFor,
  stagingPlan,
  stagingStatus,
  DEFAULT_STAGING_PLAN,
} from '../lib/expresslane/staging.js'
import { createStagingRunner } from '../lib/expresslane/runner.js'
import { checkoutClip, getClip, persistStorage } from '../lib/expresslane/byteStore.js'
import { halfAt } from '../api/scorecard/alignment.js'

// The rows one mode keeps, and the one switch that empties them of film.
//
// `filmless` is the dev-only `?nofilm` escape (ExpressLanePage reads it, and
// only under `import.meta.env.DEV`). Stripping the playId here rather than
// teaching the gate a fourth state is what keeps it honest: a row with no
// playId is ALREADY a row the gate understands — paperwork, the same as a mound
// visit — so nothing downstream needs a special case, nothing downloads, and
// the surface behaves exactly as it does on a game whose film never published.
function modeRows(allRows, mode, filmless) {
  const rows = mode === 'full' ? fullModeRows(allRows) : resultModeRows(allRows)
  return filmless ? rows.map((row) => ({ ...row, playId: null })) : rows
}

export function useExpressLane({
  feed,
  gamePk,
  mode = 'result',
  // WHEN THE BYTES ARE PAID FOR — 'demand' | 'ahead' | 'all' (STAGING_PLANS in
  // staging.js). It changes nothing about the film gate and nothing about what
  // the scorer may see; the same clips arrive down the same throttled pipe
  // under all three.
  plan = DEFAULT_STAGING_PLAN,
  // Regulation innings, from the caller's `selectRegulationInnings`. Only the
  // 'all' plan reads it, and it is the bound that keeps a filled queue from
  // stating whether this game went to extras (ADR-0008).
  regulation = 9,
  // The dev-only `?nofilm` switch. See `modeRows`.
  filmless = false,
  startHalfIdx = 0,
  // The furthest half this scorer may look at: `revealedThrough + 1`, live, so
  // it moves as they score. THE FORWARD ARROW IS CLAMPED TO IT, and that is not
  // a nicety — walking forward two halves would build the rail for a half the
  // scorer has not unlocked and stage its film, which is the sanctioned
  // lookahead (ADR-0003/0010) broken by a button.
  maxHalfIdx = Infinity,
  onReveal,
}) {
  const [halfIdx, setHalfIdx] = useState(startHalfIdx)
  const [job, setJob] = useState(() => createJob({ gamePk, mode }))
  const [cursorKey, setCursorKey] = useState(null)
  const [clip, setClip] = useState({ url: null, playId: null })
  const runnerRef = useRef(null)
  const releaseRef = useRef(null)

  const { inning, half } = useMemo(() => halfAt(halfIdx), [halfIdx])

  // The COMPLETE rail for the half, before either mode filters it. Result mode
  // keeps the terminal row of each plate appearance; this keeps every pitch,
  // and the plate-appearance expand reads it. That is the expand's whole
  // footing: the pitch DATA is free in Tier 1 whether or not the pitch VIDEO
  // was ever staged, so an opened plate appearance always has count, pitch
  // type and velocity to show, and an unstaged pitch inside it is an ordinary
  // row rather than an error state.
  const allRows = useMemo(
    () => (feed ? buildRail(feed, inning, half) : []),
    [feed, inning, half],
  )

  const rows = useMemo(() => modeRows(allRows, mode, filmless), [allRows, mode, filmless])

  const { horizon, prerollClips, openWhen, wholeGame } = useMemo(() => stagingPlan(plan), [plan])

  // The runner is built once per game and outlives a half change: the byte
  // store, the staged set and the frontier are all per GAME, and rebuilding it
  // on every inning would re-read the store and lose the queue.
  useEffect(() => {
    if (!gamePk) return undefined
    const staging = createStagingRunner({
      // ONE CLIP PER PLAY, WHICHEVER BOOTH CALLED IT. Tier 2 resolves a playId
      // through Savant, which answers with a single mp4 — there is no booth
      // parameter to pass it, and the one host that IS addressable by booth
      // (`fastball-clips.mlb.com/{gamePk}/{home|away}/{playId}.mp4`) is
      // Referer-locked to mlb.com and unplayable from this origin. So the job's
      // `feed` field describes the POSTER rendition and nothing else, and the
      // surface does not offer a choice it cannot honour.
      job: createJob({ gamePk, mode }),
      resolveClip: (playId) => resolveClipUrl(playId),
      onChange: setJob,
      horizon,
    })
    runnerRef.current = staging
    persistStorage()
    staging.start()
    return () => {
      staging.stop()
      runnerRef.current = null
    }
    // The plan is in here because the horizon is baked into the runner, and
    // changing it mid-flight would leave the queue half-walked under one rule
    // and half under another. Rebuilding costs nothing that matters: `start`
    // re-reads the byte store, so every clip already on the disk is picked back
    // up rather than paid for twice.
  }, [gamePk, mode, horizon])

  // THE WHOLE OF REGULATION, UP FRONT — the `all` plan, and the only place in
  // the app that fills the queue past the half the scorer is in.
  //
  // REGULATION, NOT THE GAME, and that bound is the whole reason this is
  // allowed to exist. Eighteen halves is the same queue for a game that ended
  // in nine and one that ran to fifteen, so a filled queue says nothing about
  // the game it belongs to (ADR-0008). Extras join one half at a time below,
  // exactly as they do under the other two plans.
  //
  // THE PROSE NEVER LEAVES THIS LOOP. `buildRail` is reveal-only — its rows
  // narrate the play — but `enqueueHalf` takes only `{ key, playId, halfIndex }`
  // off each row, so what reaches the job is the same score-free triple it
  // holds under every plan. The rails themselves are local to this effect and
  // are never rendered, never held in state, and gone when it returns. Any
  // future caller that wants them for anything else has to answer for it.
  const preloadedRef = useRef(null)
  useEffect(() => {
    const runner = runnerRef.current
    if (!runner || !wholeGame || !feed) return
    const token = `${gamePk}:${mode}:${filmless}:${regulation}`
    if (preloadedRef.current === token) return
    preloadedRef.current = token
    // In half order, because the queue IS the order: the frontier and every
    // gate walk read it front to back, and an out-of-order append would put a
    // staged clip beyond a gap the cursor cannot cross.
    for (let idx = 0; idx < regulation * 2; idx += 1) {
      const { inning, half } = halfAt(idx)
      const queued = modeRows(buildRail(feed, inning, half), mode, filmless)
      if (queued.length) runner.addHalf(queued)
    }
  }, [wholeGame, feed, gamePk, mode, filmless, regulation])

  // Each half's rows join the queue as the scorer reaches it. Under `all` this
  // is a no-op for regulation — `enqueueHalf` ignores a half it already holds —
  // and it is what brings EXTRA innings in, one at a time, under every plan.
  useEffect(() => {
    if (!runnerRef.current || !rows.length) return
    runnerRef.current.addHalf(rows)
  }, [rows])

  // THE HALF THE SCORER HAS REACHED HAS NOTHING IN IT.
  //
  // Which is the ordinary way a game ENDS. The surface opens on
  // `revealedThrough + 1` — the first half not yet finished — and for a game
  // scored to its last out that half was never played. Reading it is the
  // sanctioned lookahead (ADR-0003/0010) and it leaks nothing: an empty rail
  // says only "you have reached the end of what has been played", which the
  // scorer who reached it already knows.
  //
  // It is NOT clamped against the game's inning count, deliberately. That
  // number states whether the game went to extras (ADR-0008), and the empty
  // rail answers the same question without asking it.
  const halfEmpty = rows.length === 0

  // Enough film to open on, which each plan answers differently.
  const status = useMemo(() => stagingStatus(job, { horizon }), [job, horizon])
  const preroll = useMemo(() => {
    let ready = 0
    for (const entry of job.queue) {
      if (!entry.playId) continue
      if (!job.staged.has(entry.playId) && !job.unfilmed.has(entry.playId)) break
      ready += 1
      if (ready >= prerollClips) break
    }
    // `complete` counts as ready under 'clips' because a SHORT half can drain
    // before three land. An EMPTY one drains too, and used to come through here
    // as "ready" — which opened the surface onto a half with no rows, a dead
    // button and a film pane promising film that was never coming. The
    // `halfEmpty` guard below is what closed that, and it holds for every plan.
    //
    // 'now'     — `demand`. Nothing is staged ahead, so there is nothing to
    //             wait for: the surface opens and the first play waits on the
    //             button, where the wait is at least legible.
    // 'drained' — `all`. The queue is regulation, so this is the half-hour the
    //             chooser warned about. It is still an INDETERMINATE wait: a
    //             count of clips staged out of a game-wide total would state
    //             the game's length (ADR-0008), and a byte bar would tell the
    //             scorer that the play ahead is a long one (ADR-0046).
    const open =
      openWhen === 'now'
        ? true
        : openWhen === 'drained'
          ? job.state === 'complete'
          : ready >= prerollClips || job.state === 'complete'
    return { ready: !halfEmpty && open, state: job.state, openWhen }
  }, [job, halfEmpty, prerollClips, openWhen])

  const cursorRow = useMemo(
    () => rows.find((row) => row.key === cursorKey) ?? null,
    [rows, cursorKey],
  )
  const cursorAt = useMemo(() => rows.findIndex((row) => row.key === cursorKey), [rows, cursorKey])
  const nextRow = cursorAt < 0 ? (rows[0] ?? null) : (rows[cursorAt + 1] ?? null)

  // What the gate says about the row AHEAD. This is what greys the button, and
  // it is read on the next row rather than the current one because the current
  // row's film has by definition already arrived.
  const gate = useMemo(() => (nextRow ? gateFor(job, nextRow) : null), [job, nextRow])

  // What the gate says about the row the cursor is ON. The film pane reads
  // THIS one, not the gate above it: the row ahead decides whether the button
  // is live, but the pane is showing the row the scorer is looking at, and the
  // two are different rows with different answers. A cursor sitting on a mound
  // visit has no film and never will; a cursor sitting on a pitch whose clip
  // resolved to nothing is the same; and neither is "the film is coming".
  const currentGate = useMemo(
    () => (cursorRow ? gateFor(job, cursorRow) : null),
    [job, cursorRow],
  )

  // The deck: the box being written in, the boxes of the men on base, and the
  // chips. Capped at the cursor, so no diamond shows a base its runner has not
  // reached yet.
  const deck = useMemo(() => {
    if (!feed || !cursorRow) return { batter: null, runners: [], entries: [], cap: null }
    return expressDeck(feed, inning, half, cursorRow)
  }, [feed, inning, half, cursorRow])

  const chips = useMemo(() => reachedPlateAppearances(deck.entries), [deck.entries])

  // The clip for the row the cursor sits on. The previous object URL is
  // revoked as the new one is taken: a session walks past dozens of 6 MB
  // blobs, and holding them all is about 500 MB resident and a crash.
  useEffect(() => {
    let cancelled = false
    const playId = cursorRow?.playId ?? null
    releaseRef.current?.()
    releaseRef.current = null
    // A row with no film takes the same path as one with film, so nothing here
    // sets state synchronously and the effect has exactly one exit.
    const load = playId && gamePk ? getClip(gamePk, playId) : Promise.resolve(null)
    load.then((blob) => {
      if (cancelled) return
      if (!blob) {
        setClip({ url: null, playId })
        return
      }
      const { url, release } = checkoutClip(blob)
      releaseRef.current = release
      setClip({ url, playId })
    })
    return () => {
      cancelled = true
    }
  }, [cursorRow, gamePk])

  // The clip is shown ONLY while it still belongs to the row the cursor is on.
  //
  // Reading `clip` straight would put the PREVIOUS play's picture under the NEW
  // play's box for the frame or two the store takes to answer — the wrong film
  // beside the right notation, which on this surface is the one mistake that
  // undoes the whole thing. Keyed on playId rather than cleared on a timer, so
  // it is right by construction instead of by luck.
  const clipForCursor = useMemo(
    () => (clip.playId === (cursorRow?.playId ?? null) ? clip : { url: null, playId: null }),
    [clip, cursorRow],
  )

  useEffect(
    () => () => {
      releaseRef.current?.()
      releaseRef.current = null
    },
    [],
  )

  // Move forward one row. The gate is enforced inside the runner, so a cursor
  // that would pass the film simply does not move and the surface keeps
  // showing the wait.
  const advance = useCallback(async () => {
    if (!nextRow || !runnerRef.current) return false
    const landed = await runnerRef.current.moveCursor(nextRow.key)
    if (landed !== nextRow.key) return false
    setCursorKey(landed)
    // Advancing IS the reveal act (ADR-0016's mark, driven from here so paper
    // and screen stay in step and reveal.js syncs it across devices for free).
    //
    // NAMED, NOT POSITIONAL, and the half is named the way the rest of the app
    // names one. `revealTo` and `revealAtBat` take `(inning, half)` — every
    // other caller passes that pair — and a half-INDEX handed to them in its
    // place is silently read as an inning number: index 0 became half-index -1,
    // which the ratchet discards, so the top of the 1st could never be
    // committed and the surface could never leave it; index 2 became half-index
    // 3, which is the BOTTOM of the 2nd, and unsealed a half the scorer had
    // never watched on this page, in the innings viewer and on every synced
    // device. `cap` is the feed-entry count `railRevealCap` measures, not a
    // count of rail rows — see that function for why the two are not the same
    // number.
    const at = rows.findIndex((row) => row.key === landed)
    onReveal?.({
      inning,
      half,
      cap: railRevealCap(feed, inning, half, rows[at] ?? null),
      halfDone: at >= 0 && at + 1 >= rows.length,
    })
    return true
  }, [nextRow, rows, feed, inning, half, onReveal])

  // Back to a plate appearance already scored. Always allowed — those rows are
  // written, and the look-again is why the foot strip exists.
  const goTo = useCallback(
    async (key) => {
      if (!runnerRef.current) return
      const landed = await runnerRef.current.moveCursor(key)
      setCursorKey(landed)
    },
    [],
  )

  // ONE PLAY BACK, the fine-grained partner to the half arrows.
  //
  // The app has no address finer than a half-inning — `/game/{pk}/top5` is as
  // deep as a URL goes, and a play's position inside a half is state, not an
  // address (ADR-0016). So within a half, stepping IS what navigation means,
  // and it needs a control of its own rather than only the chips: the chips
  // name plate appearances, and in Full mode a row can be a pitch.
  //
  // Never gated. It lands on a row already scored, and `setCursor` lets a
  // backwards move through unconditionally for exactly that reason.
  const canStepBack = cursorAt > 0
  const stepBack = useCallback(async () => {
    if (cursorAt <= 0 || !runnerRef.current) return
    const landed = await runnerRef.current.moveCursor(rows[cursorAt - 1].key)
    setCursorKey(landed)
  }, [cursorAt, rows])

  // The half is done. Advancing the mark unlocks the next one, which is what
  // lets its rows join the queue — extras included, one at a time (ADR-0008).
  const canGoForward = halfIdx < maxHalfIdx
  const nextHalf = useCallback(() => {
    setCursorKey(null)
    setHalfIdx((idx) => (idx < maxHalfIdx ? idx + 1 : idx))
  }, [maxHalfIdx])

  // Jump to a half by index — what the running line's run cells call.
  //
  // Clamped forward to the same frontier the arrow is, and for the same reason:
  // every cell in that grid is a live button, including the blank one for the
  // half not yet reached, so without this a tap two columns along would build
  // the rail for a half the scorer has not unlocked and stage its film.
  // Backwards is unrestricted, because those halves are already scored.
  const goToHalf = useCallback(
    (idx) => {
      const target = Math.max(0, Math.min(idx, maxHalfIdx))
      setCursorKey(null)
      setHalfIdx(target)
    },
    [maxHalfIdx],
  )

  // Back a half. Always allowed and never gated: every half behind the cursor
  // is one the scorer has already scored, and going back to look again is the
  // whole reason the foot strip exists. It is also the way OUT of the empty
  // half a finished game opens on.
  const prevHalf = useCallback(() => {
    setCursorKey(null)
    setHalfIdx((idx) => Math.max(0, idx - 1))
  }, [])

  const skipFilm = useCallback(async () => {
    if (!nextRow || !runnerRef.current) return
    await runnerRef.current.skipFilm(nextRow.key)
  }, [nextRow])

  const retry = useCallback(async () => {
    await runnerRef.current?.resume()
  }, [])

  return {
    inning,
    half,
    halfIdx,
    rows,
    allRows,
    cursorRow,
    cursorKey,
    nextRow,
    gate,
    currentGate,
    deck,
    chips,
    clip: clipForCursor,
    job,
    status,
    preroll,
    atHalfEnd: cursorAt >= 0 && !nextRow,
    halfEmpty,
    canGoForward,
    advance,
    goTo,
    stepBack,
    canStepBack,
    nextHalf,
    prevHalf,
    goToHalf,
    skipFilm,
    retry,
  }
}
