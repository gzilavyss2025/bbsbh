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
  store(gamePk).write(on)
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
export function subTap(steps, sub, pitch) {
  const n = pitch ? sub + 1 : steps.findIndex((s, i) => i >= sub && s.stop) + 1 || steps.length
  return n < steps.length ? n : null
}

// The reader's tap on a sealed half: the sub-step count to show next, or null to reveal the at-bat
// (InningViewer's revealNextAtBat). Reveal-only: call it from the tap, never at render.
export function nextSub(feed, inning, half, count, sub, pitch) {
  const o = openAtBat(feed, inning, half, count)
  return o ? subTap(o.steps, sub, pitch) : null
}

// The stage's key for what the cursor shows: a sub-step ("count.sub") inside the open at-bat, else
// the last finished at-bat. tapRule.js plays a key change only after an armed tap.
export const stageKey = (count, sub, last) => (sub > 0 ? `${count}.${sub}` : last)
