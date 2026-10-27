// The sub-steps inside one at-bat (ADR-0123; #2570 pitch mode, #2571 event
// taps). REVEAL-ONLY (ADR-0001): it reads an at-bat card from
// computeHalfInningFeed and that card's own play.
//
// In feed order: each change (a half's pre-pitch changes are its first play's
// own events, decision 8), each pitch, each automatic call (an intentional
// walk's VB run is ONE, decision 9), each baserunning event, then the result.
// Pitch mode walks every sub-step; at-bat mode walks only the `stop`s: each
// change, each event, the result. `index` is the event's own playEvents index,
// never pitchNumber; a same-pitch event shares its pitch's index.
//
// The last pitch IS the result (decision 2): it rides only on the result
// sub-step, which alone carries the card. An event carries its own runner legs
// and nothing of the play's end state (decision 5). A steal folded onto the
// last pitch comes before the result (decision 6). An interrupted or live card
// has no result (decision 7). A mound visit, a delay, a challenge or a review
// is never a sub-step: it rides on the one it trails, and one with nothing
// before it in this play belongs to the step before (ADR-0016) and is dropped.
// Data only: no words, no timing (ADR-0046).

import { computeHalfInningFeed } from '../playbyplay.js'
import { nextStepBoundary } from '../playbyplay/entriesView.js'
import { NON_PA_EVENT_TYPES, pitchCallCode } from '../playbyplay/eventTypes.js'
import { AUTOMATIC_CODES } from '../playbyplay/pitchInfo.js'
import { battingSideOf } from './stepCut.js'

const CHANGES = new Set([
  'pitching_substitution',
  'defensive_substitution',
  'defensive_switch',
  'offensive_substitution',
])

const leg = (r) => ({
  runnerId: r.details?.runner?.id ?? null,
  from: r.movement?.start ?? null,
  to: r.movement?.end ?? null,
  out: r.movement?.isOut === true,
})

export function subSteps(feed, card) {
  const play = (feed?.liveData?.plays?.allPlays ?? []).find(
    (p) => p.about?.atBatIndex === card.atBatIndex,
  )
  const runners = play?.runners ?? []
  const batterId = play?.matchup?.batter?.id
  const legsAt = (i) => runners.filter((r) => r.details?.playIndex === i)
  const steps = []
  let prev = null // the last sub-step in feed order a rider can trail
  let lastCount = null // the last pitch or automatic call, and the events folded on it
  let pitchNo = 0
  const push = (s) => {
    steps.push({ ...s, riders: [] })
    return steps.at(-1)
  }

  for (const [pos, e] of (play?.playEvents ?? []).entries()) {
    const index = e.index ?? pos
    const et = e.details?.eventType
    // An automatic call is a step; the umpire's No Pitch (N) changes no count
    // and rides like any other no-effect entry (pitchCardInfo skips it too).
    const call = pitchCallCode(e)
    if (e.isPitch || AUTOMATIC_CODES.has(call)) {
      const count = { balls: e.count?.balls ?? null, strikes: e.count?.strikes ?? null }
      if (call === 'VB' && prev?.kind === 'auto' && prev.call === 'VB') {
        // One step for the run; it takes the last VB's index, where the walk's legs sit.
        prev.index = index
        prev.count = count
        continue
      }
      prev = e.isPitch
        ? push({ kind: 'pitch', index, stop: false, pitch: card.pitchDetails?.[pitchNo++] ?? null })
        : push({ kind: 'auto', index, stop: false, call, count })
      // A runner who went on this pitch with no event of his own (gamePk 816025).
      const legs = legsAt(index).filter((r) => r.details?.runner?.id !== batterId)
      const goers = new Set(legs.filter((r) => NON_PA_EVENT_TYPES.has(r.details?.eventType)).map((r) => r.details.runner.id))
      for (const id of goers) {
        const mine = legs.filter((r) => r.details.runner.id === id)
        const eventType = mine.find((r) => NON_PA_EVENT_TYPES.has(r.details.eventType)).details.eventType
        push({ kind: 'event', index, stop: true, eventType, playerId: id, legs: mine.map(leg) })
      }
      lastCount = { step: prev, folded: goers.size }
    } else if (CHANGES.has(et)) {
      prev = push({ kind: 'change', index, stop: true, eventType: et, playerId: e.player?.id ?? null, replacedId: e.replacedPlayer?.id ?? null, position: e.position?.abbreviation ?? null })
    } else if (legsAt(index).length) {
      prev = push({ kind: 'event', index, stop: true, eventType: et ?? null, playerId: e.player?.id ?? null, legs: legsAt(index).map(leg) })
    } else if (prev) {
      prev.riders.push({ index, eventType: et ?? e.type ?? null })
    }
  }

  if (lastCount && !card.interrupted && !card.live) {
    const { step, folded } = lastCount
    const at = steps.indexOf(step)
    steps.splice(at, 1)
    steps.splice(at + folded, 0, { kind: 'result', index: step.index, stop: true, pitch: step.pitch ?? null, card, riders: step.riders })
  }
  return steps
}

// The at-bat the reader is inside: the next step's card past `count` (the stored step cursor,
// atBatCountFor), its sub-steps, and the at-bat cards already on screen (`done`, built with the
// cut, so no later play writes onto them). The step bounds are PlayByPlay's own: a first tap's
// cap snaps forward to the first at-bat (its effectiveCap), and the step runs to nextStepBoundary.
// Null when no at-bat is left in the feed.
export function openAtBat(feed, inning, half, count) {
  const side = battingSideOf(half)
  const raw = computeHalfInningFeed(feed, inning, half, side, count)
  const from = count > 0 ? Math.max(count, nextStepBoundary(raw, 0)) : 0
  const end = nextStepBoundary(raw, from)
  const card = computeHalfInningFeed(feed, inning, half, side, end).slice(from, end).find((c) => c.kind === 'atbat')
  if (!card) return null
  const shown = from > count ? computeHalfInningFeed(feed, inning, half, side, from) : raw
  return { card, steps: subSteps(feed, card), done: shown.slice(0, from).filter((c) => c.kind === 'atbat') }
}
