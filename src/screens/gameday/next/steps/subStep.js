import { useCallback, useSyncExternalStore } from 'react'
import { firstStepEnd, openAtBat } from '../../../../api/gameday/subSteps.js'
import { localStore } from '../../../../lib/account/localStore.js'

// Sub-step stepping (ADR-0123; #2570 pitch mode, #2571 event taps). Indexes and a flag only: the
// sub-steps themselves are api/gameday/subSteps.js, read at the tap (nextSub) and inside SealBox
// reveal functions. The render reads here (nextSub's live-edge flag, stepCapAt, openingChangeHeld)
// return an index or a flag and nothing of a play: what they gate is drawn inside a SealBox.

// The pitch-mode flag (decision 12): one per game under bbsbh:pitchmode:{gamePk}, a flag, never a
// score, so a reload or another tab of the same game keeps it and any other game starts in at-bat mode.
const store = (gamePk) => localStore(`bbsbh:pitchmode:${gamePk}`, (v) => v === '1', (on) => (on ? '1' : '0'))
export const readPitchMode = (gamePk) => (gamePk ? store(gamePk).read() : false)
export function writePitchMode(gamePk, on) {
  if (!gamePk) return
  if (on) store(gamePk).write(true)
  else store(gamePk).drop() // off is the default: no key left behind
  store(gamePk).notify()
}

// ponytail: storage-backed only; where storage is refused the switch stays in at-bat mode.
const subscribe = (fn) => {
  window.addEventListener('storage', fn)
  return () => window.removeEventListener('storage', fn)
}
export function usePitchMode(gamePk) {
  const on = useSyncExternalStore(subscribe, () => readPitchMode(gamePk), () => false)
  return [on, useCallback((v) => writePitchMode(gamePk, v), [gamePk])]
}

// The advance's words follow the mode and nothing else (decision 3, its 2026-10-26 amendment).
export const stepWords = (pitch) => (pitch ? 'Next pitch' : 'Next play')

// The advance at the live edge (ADR-0055). Pitch by pitch, a pitch lands every ~20s against the
// feed's one-minute poll, so it becomes a Refresh: it fetches the feed and reveals nothing. Once
// the poll or the tap brings a new pitch, the advance is "Next pitch" again.
export function caughtUpAdvance(pitch, loading, onReload) {
  if (!pitch || !onReload) return { label: 'Caught up', disabled: true, caughtUp: true }
  return { label: loading ? 'Refreshing…' : 'Refresh', refresh: true, disabled: !!loading, caughtUp: true, reveal: false, onClick: onReload }
}

// One tap inside the open at-bat: the sub-step count after it, or null when this tap reveals the
// at-bat itself (its result, or the event that ends the half: decision 7). Pitch mode shows the next
// sub-step; at-bat mode runs to the next stop. A switch mid-at-bat keeps `sub`, so turning pitch
// mode on reveals the next unseen pitch and turning it off skips to the next stop.
// An at-bat still being played (`live`) has no result yet: its last known sub-step is one more
// sub-step, and past it the advance is CAUGHT_UP until a poll brings the next (ADR-0055).
export const CAUGHT_UP = -1
export function subTap(steps, sub, pitch, live = false) {
  const n = pitch ? sub + 1 : steps.findIndex((s, i) => i >= sub && s.stop) + 1 || steps.length
  if (live) return sub < steps.length ? Math.min(n, steps.length) : CAUGHT_UP
  return n < steps.length ? n : null
}

// The reader's tap on a sealed half: the sub-step count to show next, null to reveal the at-bat
// (InningViewer's revealNextAtBat), or CAUGHT_UP. Reveal-only: call it from the tap; the one render
// read is InningViewer's live-edge label, on a half still being played, which yields that flag alone.
export function nextSub(feed, inning, half, count, sub, pitch) {
  const o = openAtBat(feed, inning, half, count)
  return o ? subTap(o.steps, sub, pitch, o.card.live === true) : null
}

// The engine's cap for the half on screen, given the sub-step (Gary, 2026-10-28: a substitution is
// its own step). The stored count follows nextStepBoundary, whose trailing sweep (ADR-0016) puts a
// change made between batters under the PREVIOUS batter's result tap; the open at-bat then lists
// it again as its first sub-step. So the cap stops before any change of the open at-bat the reader
// has not reached by `sub` (the band, the Pitcher rail and Due up keep the old man until that tap),
// and runs past a mid-at-bat one they have (it leads the step, so the count alone waits for the
// result). An index only; nothing else moves. Same reach as nextSub.
export function stepCapAt(feed, inning, half, count, sub) {
  if (count === 0) return 0
  const floor = Math.max(count, firstStepEnd(feed, inning, half))
  const o = openAtBat(feed, inning, half, count)
  if (!o) return floor
  // The open at-bat's own change sub-steps, by event index: an entry is one of them, or not ours.
  const reach = new Map(o.steps.flatMap((s, i) => (s.kind === 'change' ? [[s.index, i < sub]] : [])))
  const own = (e) => e.kind === 'event' && e.fromAtBat === o.card.atBatIndex && reach.has(e.eventIndex)
  const card = o.entries.findIndex((e) => e.kind === 'atbat' && e.atBatIndex === o.card.atBatIndex)
  // The half's first tap stores 1, and the step it means runs to the first boundary (PlayByPlay
  // snapped to it): measure from there, so only an unreached change comes off it.
  let cap = floor
  for (let i = 0; i < card; i++) {
    const e = o.entries[i]
    if (!own(e)) continue
    if (!reach.get(e.eventIndex)) return Math.min(cap, i)
    if (i >= cap) cap = i + 1
  }
  return cap
}

// The half's OPENING pitching change (in its first at-bat) is no entry: the engine names the
// half's first pitcher at once (selectHalfStartingPitcher). Gameday holds it to its own sub-step like
// any other change: true while the reader is inside the half's first at-bat (count 0) and short of
// that change's sub-step, so the rail and the rest frame keep the club's previous pitcher.
export function openingChangeHeld(feed, inning, half, count, sub) {
  if (count !== 0) return false
  // Before the first pitch or mid-way through the first batter: either way the play's
  // matchup.pitcher (the half's "opener") is the new man, so he waits for his own sub-step.
  const k = (openAtBat(feed, inning, half, 0)?.steps ?? []).findIndex((s) => s.eventType === 'pitching_substitution')
  return k >= 0 && sub <= k
}

// The stage's key for what the cursor shows: a sub-step ({ count, sub, last }) inside the open
// at-bat, else the last finished at-bat. tapRule.js plays a key change only after an armed tap and
// compares keys by value. The result tap drops `sub` to 0 a render before the engine reports the
// new last at-bat, so a sub-step key holds (`prev`) until `last` moves: the armed tap then plays
// the new at-bat, never the old one.
export function stageKey(open, last, prev) {
  if (open?.sub > 0) return { count: open.count, sub: open.sub, last }
  return prev?.sub > 0 && prev.last === last ? prev : last
}
