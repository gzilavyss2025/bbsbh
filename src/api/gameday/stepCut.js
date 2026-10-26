// The step cut every Gameday data module shares (#2606, #2607): which plate
// appearances of the current half the reader has on screen. REVEAL-ONLY
// (ADR-0001) — it reads computeHalfInningFeed's cards.
//
// `step` is the entry count PlayByPlay passes computeHalfInningFeed as its
// `stepCap` (ADR-0016); null means the half is committed in full. The cards are
// built WITH that cap and sliced at it, so no later play writes back onto them.

import { computeHalfInningFeed } from '../playbyplay.js'

export const battingSideOf = (half) => (half === 'top' ? 'away' : 'home')

// Fail closed: `step` null means "the whole half", which is true only for a
// committed half. For the half past `revealedThrough` (the one being stepped),
// a null step reads as 0, never as the whole half. `here` is the half's index.
export const safeStep = (step, here, revealedThrough) =>
  step == null && here > (revealedThrough ?? -1) ? 0 : step

// The at-bat cards of (inning, half) up to `step`, oldest first.
export function visibleAtBatCards(feed, inning, half, step) {
  const cards = computeHalfInningFeed(feed, inning, half, battingSideOf(half), step)
  return (step == null ? cards : cards.slice(0, step)).filter((c) => c.kind === 'atbat')
}

// The atBatIndex of the last plate appearance on screen in (inning, half), or
// -1 when none is yet. A play past it is not on screen. An event that leads the
// NEXT card (a steal mid-count) joins when that card's play does: late by one
// tap at most, never early.
export function stepCutAtBatIndex(feed, inning, half, step) {
  const shown = visibleAtBatCards(feed, inning, half, step).filter((c) => c.atBatIndex != null)
  return shown.length ? shown[shown.length - 1].atBatIndex : -1
}
