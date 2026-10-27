import { useCallback, useSyncExternalStore } from 'react'
import { openAtBat } from '../../../../api/gameday/subSteps.js'
import { localStore } from '../../../../lib/account/localStore.js'

// Sub-step stepping (ADR-0123; #2570 pitch mode, #2571 event taps). Indexes and a flag only: the
// sub-steps themselves are api/gameday/subSteps.js, read at the tap (nextSub) and inside SealBox
// reveal functions, never at render.

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

// The stage's key for what the cursor shows: a sub-step ({ count, sub, last }) inside the open
// at-bat, else the last finished at-bat. tapRule.js plays a key change only after an armed tap and
// compares keys by value. The result tap drops `sub` to 0 a render before the engine reports the
// new last at-bat, so a sub-step key holds (`prev`) until `last` moves: the armed tap then plays
// the new at-bat, never the old one.
export function stageKey(open, last, prev) {
  if (open?.sub > 0) return { count: open.count, sub: open.sub, last }
  return prev?.sub > 0 && prev.last === last ? prev : last
}
