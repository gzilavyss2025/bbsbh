import { defenseEntering } from './defense.js'

// WHO WAS CATCHING — the catcher of record for a given half-inning, and the
// whole game's chart of them.
//
// WHY THIS EXISTS. OpenCommand carries no catcher identity anywhere. Confirmed
// by reading its pipeline: the method detects an anonymous glove per pitcher per
// game and was never told, and never infers, whose glove it was. So every
// catcher-side reading of that data — "which pitchers hit this catcher's target
// best" — rests on a join bbsbh has to make itself, out of a game's own feed.
//
// IT REPLAYS NOTHING. defense.js already turns a feed's
// defensive_substitution/defensive_switch events into a per-position chain
// (starter first, then each replacement tagged with the inning he entered), and
// a second copy of that walk is exactly the drift this repo keeps paying for.
// This module only ASKS that chain a narrower question, one position and one
// half at a time.
//
// THE HALF IS THE UNIT, and it comes free. `defenseEntering` is already
// "the alignment as this half begins", so calling it per half gets the answer at
// half granularity with no new logic — and, importantly, no need to compare a
// chain entry's `inning` tag against a target inning by hand, which is where a
// hand-rolled lookup would get the boundary wrong (an entry is tagged with the
// inning a man ENTERED, not the innings he then caught).
//
// WHAT IT CANNOT SEE is a change made mid-half: `defenseEntering` deliberately
// stops at a half's first pitch, so a catcher who comes in with one out is
// credited from the NEXT half. That is a real and accepted limit rather than an
// oversight — it is rare in a real game, and the alternative is re-implementing
// the substitution walk at pitch granularity, which is the duplication this
// module exists to avoid.
//
// SPOILER FOOTING — caller-gated, inherited whole from defense.js. Substitution
// TIMING is spoiler-adjacent (a flurry of pre-half changes telegraphs a sealed
// blowout), and nothing here weakens that: `defenseEntering`'s own
// `revealedThrough` gate is passed straight through, so a caller that has not
// reached a half gets null from this module too. Its ONE consumer today is the
// nightly precompute (scripts/gen-command-received.mjs) over games already
// final, where the whole-game read is the same one BoxScore.jsx makes from
// inside its own seal. A live surface calling this must gate it exactly as it
// would gate defenseEntering.

// The catcher standing behind the plate as (inning, half) begins, for the side
// that is FIELDING it. Null when the feed has no catcher for that side — a thin
// MiLB feed with no posted lineup, or a half the caller has not revealed.
export function catcherEntering(feed, fieldingSide, inning, half, revealedThrough = Infinity) {
  const rows = defenseEntering(feed, fieldingSide, inning, half, revealedThrough)
  const chain = rows?.find((row) => row.position === 'C')
  // The surviving occupant is the one entry not struck through — the same
  // reading the box score's alignment table renders.
  const active = chain?.entries?.find((entry) => !entry.replaced)
  return active ? { id: active.id, last: active.last } : null
}

// Which side is on defense for a half. The visiting team bats in the top, so
// the HOME team is the one crouching behind the plate.
export function fieldingSideFor(half) {
  return half === 'top' ? 'home' : 'away'
}

// Every half the game actually played, as { inning, half } in order. Taken from
// the plays themselves rather than from a 1..9 assumption: a game can be
// shortened, walked off before its bottom half, or run to extras.
export function halvesPlayed(feed) {
  const seen = new Set()
  const out = []
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inning = play?.about?.inning
    const half = play?.about?.halfInning
    if (!inning || !half) continue
    const key = `${inning}:${half}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ inning, half })
  }
  return out
}

// The whole game's chart: `${inning}:${half}` -> { id, last } for the catcher
// who was behind the plate. One lookup a per-pitch join can hit directly.
//
// Whole-game read (revealedThrough defaults to Infinity), which is what the
// nightly precompute over completed games wants. A live caller must pass its
// own mark, exactly as it would to defenseEntering.
export function catcherChart(feed, revealedThrough = Infinity) {
  const chart = new Map()
  for (const { inning, half } of halvesPlayed(feed)) {
    const catcher = catcherEntering(feed, fieldingSideFor(half), inning, half, revealedThrough)
    if (catcher) chart.set(`${inning}:${half}`, catcher)
  }
  return chart
}
