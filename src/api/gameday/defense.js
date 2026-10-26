// The Field tab's defense (#2566, round 2 item 8): the fielding side's
// alignment as of the reader's step, pitcher included. REVEAL-ONLY (ADR-0001):
// a substitution can telegraph a sealed blowout, so call it only inside a
// SealBox's reveal render function (ADR-0002).
//
// THE CLAMP. It starts from the side's starters (selectLineup's starting
// positions) and replays the side's own fielding halves in order. Earlier
// halves are read whole; the reader's half only up to `step`, sliced the way
// ./stepCut.js slices it. So a change counts only once its own entry is on
// screen (ADR-0016): Muñoz's change trails the at-bat before his, and lands
// with that step. Every at-bat card on screen also names its pitcher, which
// carries the half's opening pitching change (computeHalfInningFeed drops that
// one's entry; it lands with the half's first at-bat). A half past
// revealedThrough + 1 answers null.
//
// ponytail: pre-pitch changes land with the step that holds them, not one tap
// each (ADR-0123 decision 8); take a sub-step here when the sub-step list exists.

import { computeHalfInningFeed } from '../playbyplay.js'
import { halfIndex, selectLineup, derivedHalfStartingPitcherId, lastName } from '../select.js'
import { battingSideOf, fieldingSideOf, safeStep } from './stepCut.js'

const MOVES = new Set(['defensive_substitution', 'defensive_switch'])

// { pos -> { id, last } } for the side in the field in (inning, half), or null.
export function defenseAt(feed, { inning, half, step = null, revealedThrough }) {
  if (!inning || !half) return null
  const here = halfIndex(inning, half)
  if (here > (revealedThrough ?? -1) + 1) return null
  const at = {}
  for (const p of selectLineup(feed, fieldingSideOf(half))) if (p.position) at[p.position] = p.id
  at.P = derivedHalfStartingPitcherId(feed, 1, half)
  const put = (pos, id) => {
    for (const k of Object.keys(at)) if (at[k] === id) delete at[k]
    at[pos] = id
  }
  for (let inn = 1; inn <= inning; inn++) {
    const cap = inn === inning ? safeStep(step, here, revealedThrough) : null
    const cards = computeHalfInningFeed(feed, inn, half, battingSideOf(half), cap)
    for (const c of cap == null ? cards : cards.slice(0, cap)) {
      if (c.kind === 'atbat' && c.pitcher?.id != null) at.P = c.pitcher.id
      else if (c.eventType === 'pitching_substitution' && c.playerId != null) at.P = c.playerId
      else if (MOVES.has(c.eventType) && c.playerId != null && c.position) put(c.position, c.playerId)
    }
  }
  const players = feed?.gameData?.players ?? {}
  return Object.fromEntries(
    Object.entries(at)
      .filter(([, id]) => id != null)
      .map(([pos, id]) => [pos, { id, last: lastName(players[`ID${id}`]) }]),
  )
}
