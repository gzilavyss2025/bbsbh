// Shared primitives for the "entering the half" selectors — the fielding
// alignment (api/defense.js's defenseEntering) and batting lineup
// (api/battingorder.js's lineupEntering) as they stand at a half's own first
// pitch. Both need the same walk over pre-pitch substitution events and the
// same player-id -> display-name lookup, so those live here once instead of
// twice.
//
// THE SPOILER-SAFETY CONTRACT LIVES HERE, NOT AT THE CALLERS. Substitution
// *timing* is spoiler-adjacent — a flurry of subs telegraphs a still-sealed
// blowout — so "entering state" for a half may only be shown for the half
// that is the user's own NEXT one to reveal, never one further out. Every
// selector below that reads across a half boundary (forEachEventBeforeFirstPitch,
// entrantsBeforeFirstPitch) is safe to CALL for any half — it just walks
// event data — but defenseEntering/lineupEntering, the two public "entering
// the half" selectors built on it, take `revealedThrough` directly and
// enforce the boundary themselves via safeToShowEntering() below, returning
// null rather than trusting the caller to gate rendering.

import { halfIndex, lastName, personNameParts } from './select.js'

// Whether the "entering the half" state for (throughInning, throughHalf) is
// safe to compute/show for a caller who has revealed up through
// `revealedThrough` (a half-index; see halfIndex). True only for a half at or
// before the user's own next one to reveal. Pass revealedThrough = Infinity
// for an already-fully-revealed context (the box score reads the whole-game
// alignment from inside its own SealBox, so it is exempt from this gate).
export function safeToShowEntering(revealedThrough, throughInning, throughHalf) {
  return halfIndex(throughInning, throughHalf) <= revealedThrough + 1
}

// Player ids that count as "entered" the game via a sub/pitching change
// rather than starting it — shared by the walk below and by select.js's
// entryIndexById (which also serves the Bench/Bullpen cards' unrelated
// "when did this reliever/pinch-hitter make his season debut" badge, so it
// stays a select.js export rather than moving here wholesale).
const ENTRY_EVENT_TYPES = new Set([
  'pitching_substitution',
  'offensive_substitution',
  'defensive_substitution',
])

// Walk every playEvent that occurred strictly before the first pitch of
// (inning, half), in chronological order, invoking fn(ev, play) for each. It
// stops the moment it reaches that half's first pitch, so the events it
// yields are exactly the game's state *entering* the half: all of every prior
// half's events, plus this half's own pre-pitch events (subs/switches
// announced before the leadoff pitch — see select.js's selectPrePitchChanges),
// and nothing from the half's actual at-bats. Pass Infinity as the inning to
// walk the whole game (the box score's final-alignment case).
//
// This itself reads only eventType/position/player ids/inning numbers, never
// a score — but see the module doc above: callers that render its result
// outside a SealBox must go through defenseEntering/lineupEntering, which
// enforce the reveal boundary, rather than calling this directly.
export function forEachEventBeforeFirstPitch(feed, inning, half, fn) {
  const cutoff = halfIndex(inning, half)
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inn = play?.about?.inning
    const ha = play?.about?.halfInning
    if (!inn || !ha) continue
    const idx = halfIndex(inn, ha)
    if (idx > cutoff) return // allPlays is chronological
    const atTarget = idx === cutoff
    for (const ev of play.playEvents ?? []) {
      if (atTarget && ev.isPitch) return // reached the half's first pitch
      fn(ev, play)
    }
  }
}

// The set of player ids who have ENTERED the game — as a pitching change,
// pinch-hitter/runner, or defensive substitution — strictly before the first
// pitch of (inning, half). That's everyone in the game as the half begins who
// wasn't a starter. Same gating note as forEachEventBeforeFirstPitch.
export function entrantsBeforeFirstPitch(feed, inning, half) {
  const ids = new Set()
  forEachEventBeforeFirstPitch(feed, inning, half, (ev) => {
    if (ENTRY_EVENT_TYPES.has(ev?.details?.eventType) && ev.player?.id != null) {
      ids.add(ev.player.id)
    }
  })
  return ids
}

// The two id -> display-name lookups defenseEntering and lineupEntering each
// need, resolved against a feed's gameData.players. Both previously
// re-derived these as local closures; factored out once they turned out
// identical.
export function enteringLastName(feed, id) {
  const players = feed?.gameData?.players ?? {}
  return lastName(players[`ID${id}`] ?? {}) || '—'
}

export function enteringFirstName(feed, id) {
  const players = feed?.gameData?.players ?? {}
  return personNameParts(players[`ID${id}`] ?? {}).first
}
