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
import { createJob, gateFor, stagingStatus } from '../lib/expresslane/staging.js'
import { createStagingRunner } from '../lib/expresslane/runner.js'
import { checkoutClip, getClip, persistStorage } from '../lib/expresslane/byteStore.js'
import { halfAt } from '../api/scorecard/alignment.js'

// How much film has to be here before the surface will open.
//
// Three clips, not one half-inning. Both were on the table and the gate
// settles it: after the pre-roll the scorer moves at the queue's pace whatever
// the head start was, so the only thing the pre-roll buys is the OPENING — and
// three clips opens in about 75 seconds against a half-inning's two minutes.
// A larger pre-roll would buy a longer wait for the same steady state.
//
// It is a count of CLIPS, never shown as one. "3 of 84" would state the game's
// length (ADR-0008); the surface shows an indeterminate wait instead.
const PREROLL_CLIPS = 3

export function useExpressLane({
  feed,
  gamePk,
  mode = 'result',
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

  const rows = useMemo(
    () => (mode === 'full' ? fullModeRows(allRows) : resultModeRows(allRows)),
    [allRows, mode],
  )

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
    })
    runnerRef.current = staging
    persistStorage()
    staging.start()
    return () => {
      staging.stop()
      runnerRef.current = null
    }
  }, [gamePk, mode])

  // Each half's rows join the queue as the scorer reaches it. This is the only
  // way the queue grows.
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

  // Enough film to open on. Counted against the head of the queue, never shown.
  const status = useMemo(() => stagingStatus(job), [job])
  const preroll = useMemo(() => {
    let ready = 0
    for (const entry of job.queue) {
      if (!entry.playId) continue
      if (!job.staged.has(entry.playId) && !job.unfilmed.has(entry.playId)) break
      ready += 1
      if (ready >= PREROLL_CLIPS) break
    }
    // `complete` counts as ready because a SHORT half can drain before three
    // clips land. An EMPTY one drains too, and used to come through here as
    // "ready" — which opened the surface onto a half with no rows, a dead
    // button and a film pane promising film that was never coming.
    return {
      ready: !halfEmpty && (ready >= PREROLL_CLIPS || job.state === 'complete'),
      state: job.state,
    }
  }, [job, halfEmpty])

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
