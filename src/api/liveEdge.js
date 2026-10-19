import { halfIndex, selectHasStarted, selectIsFinal } from './select.js'

// ---------------------------------------------------------------------------
// WHICH HALF IS THE GAME IN? (ADR-0055)
//
// The readers below answer that question from the LINESCORE'S OWN live state,
// ungated — because the thing they are asked for is whether the half already
// on screen is FINISHED, and the plays cannot tell you that. A half whose third
// out has just been recorded and a half whose next batter is still walking up
// look identical in `allPlays`: both end with the same last play, and no later
// half exists yet either way. `inningState` is the one field that separates
// them.
//
// WHAT THEY REPORT AND WHAT THEY DO NOT. An inning number and which half.
// Never a run, a hit, an out count, or a base state. That is why they need no
// gate: nothing here is a score, and the callers use the answer to decide
// which BUTTON to draw, never to draw a value. This is NOT a reveal-only module
// (ADR-0001).
//
// (The plays-based reader that once drove the Scores Unlocked pass's
// Follow-Live navigation is gone with the pass, ADR-0116.)
//
//   • `selectLiveHalf` — read by InningViewer, which compares its `idx` against
//     the half on screen to stop a still-being-played half from committing
//     itself the moment the reader catches up to it. See ADR-0055.
//   • `selectCatchUpTarget` — read on the lineup page, to offer "Catch up to
//     live" and to name where it lands. The INNING it names never reaches the
//     screen: the button's label is fixed copy, so a game in the 12th offers
//     the same three words as a game in the 2nd and ADR-0008's extras
//     protection is not spent by the offer, only by the tap.
//
// MiLB DEGRADES GRACEFULLY, AND IN THE SAFE DIRECTION. A feed with no
// `currentInning`/`inningState` reads as "no live half", so no half is ever
// treated as in progress — the pre-ADR-0055 behaviour, where catching up to the
// last fetched play commits the half. That is the right way to fail: the
// alternative (assuming a half is live because we cannot prove otherwise) would
// leave a half that can never commit, and a reader who can never move forward.

// linescore.inningState -> the half it is talking about. 'Middle' is the gap
// after the TOP has ended, 'End' the gap after the BOTTOM has — so both name a
// half that is over, which is exactly the half a reader catching up mid-gap
// wants to land on.
const STATE_HALF = { top: 'top', middle: 'top', bottom: 'bottom', end: 'bottom' }
const STATE_IN_PROGRESS = { top: true, middle: false, bottom: true, end: false }

// { idx, inning, half, inProgress } for the half the game is in (or the half it
// most recently finished, between halves), or null before first pitch, on a
// feed that posts no live inning state, or once the game is Final.
export function selectLiveHalf(feed) {
  if (!selectHasStarted(feed)) return null
  if (selectIsFinal(feed)) return null
  const line = feed?.liveData?.linescore
  const inning = line?.currentInning
  if (!Number.isInteger(inning) || inning < 1) return null
  const state = String(line?.inningState ?? '').toLowerCase()
  const half = STATE_HALF[state]
  if (!half) return null
  return { idx: halfIndex(inning, half), inning, half, inProgress: STATE_IN_PROGRESS[state] }
}

// Where "Catch up to live" lands: the half being played, or — between halves —
// the one most recently completed. The caller reveals through `idx - 1` and
// leaves THIS half sealed, so the reader picks the pencil up at the top of it
// and steps through at-bat by at-bat exactly as they would have all along.
// Null whenever there is no live half to catch up to.
export function selectCatchUpTarget(feed) {
  const live = selectLiveHalf(feed)
  return live == null ? null : { idx: live.idx, inning: live.inning, half: live.half }
}
