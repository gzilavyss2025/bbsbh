// A notable baserunning event (steal, caught stealing, pickoff, wild pitch,
// passed ball, balk) that carries NO playEvent of its own — the feed folds it
// straight into `play.runners[]` with nothing in `playEvents` to hoist a card
// from, when it happens on the SAME pitch that ends the plate appearance (the
// runner breaks as the pitch is thrown; the batter's own result and the
// runner's leg both land as that one pitch's aftermath). Verified against
// gamePk 816025's bottom 2nd: Jud Fabian's strikeout carries four `isPitch`
// playEvents and nothing else — no `stolen_base_2b` action, no error — while
// `runners[]` holds three legs: Fabian's own K, Luis Vázquez's steal of 2nd,
// and (same runner, same play) a further leg to 3rd on a throwing error. With
// nothing hoisted, the whole story sat buried inside the strikeout's own
// prose ("Jud Fabian strikes out swinging. Luis Vázquez to 3rd. Luis Vázquez
// steals (7) 2nd base. Luis Vázquez to 3rd. Throwing error by catcher Sandy
// León.") instead of getting the same leading notification card every OTHER
// steal/wild pitch/balk already gets (see halfInningFeed.js's playEvents
// scan). This file builds that missing card straight from `runners[]`
// instead — the same structured fields the diamond's own leg notation
// (advanceCode.js) already reads, not a re-parse of the prose.
//
// See ../playbyplay.js's header for the module's overall spoiler footing.
// Barrel-internal, called only from halfInningFeed.js (spoiler-manifest.json).

import { NON_PA_EVENT_TYPES } from './eventTypes.js'
import { runnerLastName } from './notificationCards.js'

const BASE_WORD = { '1B': 'first', '2B': 'second', '3B': 'third', '4B': 'home', score: 'home' }

// The sentence fragment for a runner's own notable movement — never "to
// first" for a steal (scorebook English says "steals second", not "steals to
// second"); everything else reads naturally with "to".
function noteClause(eventType, base) {
  if (!base) return null
  if (eventType.startsWith('stolen_base')) return `steals ${base}`
  if (eventType.startsWith('caught_stealing')) return `is caught stealing ${base}`
  if (eventType.startsWith('pickoff')) return `is picked off at ${base}`
  if (eventType === 'wild_pitch') return `advances to ${base} on a wild pitch`
  if (eventType === 'passed_ball') return `advances to ${base} on a passed ball`
  if (eventType === 'balk') return `advances to ${base} on a balk`
  return null
}

// The trailing clause for an error-credited leg — named the same way
// PitcherNotice/FielderNotice name whoever a card is about, off
// `feed.gameData.players` rather than the credit itself (which carries a
// fielder id but never a name). The error's OWN kind ("throwing"/"fielding")
// comes straight off the credit string (`f_throwing_error` / `f_fielding_error`)
// rather than being guessed, so a card never says "throwing" for a botched
// catch.
function errorSegments(feed, r) {
  const base = BASE_WORD[r.movement?.end] ?? ''
  const cred = (r.credits ?? []).find((c) => /error/.test(c.credit ?? ''))
  if (!base || !cred) return null
  const kind = (cred.credit ?? '').replace(/^f_/, '').replace(/_/g, ' ') || 'error'
  const posName = (cred.position?.name ?? '').toLowerCase()
  const fielderId = cred.player?.id ?? null
  const fielderLast = fielderId != null ? runnerLastName(feed, fielderId) : ''
  const lead = ` Advances to ${base} on a ${kind}${posName ? ` by ${posName}` : ''}`
  return fielderLast
    ? [{ text: `${lead} ` }, { id: fielderId, text: fielderLast }, { text: '.' }]
    : [{ text: `${lead}.` }]
}

// One `entries`-shaped 'event' card per runner leg this play's playEvents
// scan never saw — `coveredRunnerEvents` is the `${runnerId}:${eventType}`
// set halfInningFeed.js's own scan already built, so a steal that DID get its
// usual playEvent-sourced card is never doubled up here. The one leg
// immediately following an uncovered lead, for the SAME runner, folds into
// that lead's card when it carries an error credit (the exact gamePk 816025
// shape); anything else — a second runner, a leg two slots later — starts
// its own note rather than being guessed into this one.
export function uncoveredRunnerNotes(feed, play, batterId, coveredRunnerEvents, midAtBat) {
  const legs = play.runners ?? []
  const notes = []
  for (let i = 0; i < legs.length; i++) {
    const r = legs[i]
    const rid = r.details?.runner?.id
    if (rid == null || rid === batterId) continue
    const et = r.details?.eventType ?? ''
    if (!NON_PA_EVENT_TYPES.has(et) || coveredRunnerEvents.has(`${rid}:${et}`)) continue
    const base = BASE_WORD[r.movement?.isOut ? r.movement?.outBase : r.movement?.end] ?? ''
    const clause = noteClause(et, base)
    if (!clause) continue

    const segments = [
      { id: rid, text: r.details?.runner?.fullName ?? '' },
      { text: ` ${clause}.` },
    ]
    const next = legs[i + 1]
    if (next?.details?.runner?.id === rid) {
      const errSeg = errorSegments(feed, next)
      if (errSeg) segments.push(...errSeg)
    }
    notes.push({ kind: 'event', eventType: et, midAtBat, playerId: rid, segments })
  }
  return notes
}
