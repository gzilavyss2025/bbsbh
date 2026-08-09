import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEAN_TIERS,
  LEAN_TIER_LABELS,
  leanTierForZ,
  leanCaretFraction,
} from '../src/lib/statTiers.js'
import { leanInputFromRows, umpireLeanFor, umpireWatchArea } from '../src/api/umpires.js'

// --- the five-band lean scale -------------------------------------------------

test('leanTierForZ buckets both directions, with a neutral band', () => {
  assert.equal(leanTierForZ(-3), 'veryPitcher')
  assert.equal(leanTierForZ(-1.2), 'veryPitcher')
  assert.equal(leanTierForZ(-0.6), 'pitcher')
  assert.equal(leanTierForZ(0), 'neutral')
  assert.equal(leanTierForZ(0.6), 'hitter')
  assert.equal(leanTierForZ(1.2), 'veryHitter')
  assert.equal(leanTierForZ(3), 'veryHitter')
})

test('leanTierForZ boundaries are exact and symmetric', () => {
  // -1 and -0.35 belong to the OUTER band on the pitcher side (<=), while
  // +0.35 and +1 belong to the outer band on the hitter side (not <). Pinned
  // because an off-by-one here silently moves a whole tier of umpires.
  assert.equal(leanTierForZ(-1), 'veryPitcher')
  assert.equal(leanTierForZ(-0.35), 'pitcher')
  assert.equal(leanTierForZ(0.35), 'hitter')
  assert.equal(leanTierForZ(1), 'veryHitter')
  // …and the band just inside each of those is the softer one.
  assert.equal(leanTierForZ(-0.9999), 'pitcher')
  assert.equal(leanTierForZ(-0.3499), 'neutral')
  assert.equal(leanTierForZ(0.3499), 'neutral')
  assert.equal(leanTierForZ(0.9999), 'hitter')
})

test('every tier has a label, and LEAN_TIERS is the render order', () => {
  assert.deepEqual(LEAN_TIERS, ['veryPitcher', 'pitcher', 'neutral', 'hitter', 'veryHitter'])
  for (const t of LEAN_TIERS) assert.ok(LEAN_TIER_LABELS[t], `no label for ${t}`)
})

// The one bug this geometry could have: a caret pointing at a row other than
// the one the label highlights. Swept across the whole domain rather than
// spot-checked, because the failure would be a single band's width.
test('the caret always lands inside its own highlighted band', () => {
  for (let z = -4; z <= 4; z += 0.01) {
    const tier = leanTierForZ(z)
    const band = LEAN_TIERS.indexOf(tier)
    const f = leanCaretFraction(z)
    const lo = band / LEAN_TIERS.length
    const hi = (band + 1) / LEAN_TIERS.length
    assert.ok(
      f >= lo - 1e-9 && f <= hi + 1e-9,
      `z=${z.toFixed(2)} tier=${tier} band=[${lo},${hi}] caret=${f}`,
    )
  }
})

test('the caret clamps into the scale at the extremes', () => {
  assert.ok(leanCaretFraction(-99) >= 0)
  assert.ok(leanCaretFraction(99) <= 1)
  assert.equal(leanCaretFraction(0), 0.5) // dead average sits dead centre
})

// --- the lean figure itself ---------------------------------------------------

const gameWithFavor = (over, away, home) => ({
  level: 'MLB',
  gameType: 'R',
  favorAway: away,
  favorHome: home,
  ...over,
})

// The lean is summed at BUILD time (leanInputFromRows, called by
// gen-umpire-accuracy.mjs into the season aggregate) and divided at READ time
// (umpireLeanFor, off that aggregate). Both halves are tested here, because the
// sign convention has to survive the trip.

test('the lean signs positive toward HITTERS', () => {
  // favorAway/favorHome are signed toward whoever was BATTING, so a positive
  // sum is runs handed to hitters. A flip here inverts the entire card and is
  // invisible in review — this is the assertion most worth having.
  const hitterFriendly = umpireLeanFor(
    leanInputFromRows([gameWithFavor({}, 0.5, 0.3), gameWithFavor({}, 0.2, 0.4)]),
  )
  assert.equal(hitterFriendly.source, 'favor')
  assert.ok(hitterFriendly.lean > 0)
  assert.ok(Math.abs(hitterFriendly.lean - 0.7) < 1e-9)

  const pitcherFriendly = umpireLeanFor(leanInputFromRows([gameWithFavor({}, -0.4, -0.2)]))
  assert.ok(pitcherFriendly.lean < 0)
})

test('leanInputFromRows counts only the requested level and regular season', () => {
  const games = [
    gameWithFavor({}, 1, 0), // MLB R    — counts
    gameWithFavor({ level: 'AAA' }, 9, 9), // AAA — excluded
    gameWithFavor({ gameType: 'W' }, 9, 9), // World Series — excluded
    { level: 'MLB', gameType: 'R', favorAway: null, favorHome: null }, // no favor — excluded
  ]
  const mlb = umpireLeanFor(leanInputFromRows(games, 'MLB'))
  assert.equal(mlb.games, 1)
  assert.equal(mlb.lean, 1)

  const aaa = umpireLeanFor(leanInputFromRows(games, 'AAA'))
  assert.equal(aaa.games, 1)
  assert.equal(aaa.lean, 18)
})

test('the lean falls back to zone lean, with the sign still toward hitters', () => {
  // No row carried favor (run-expectancy.json was never built), so the
  // aggregate has favorNetGames 0. A GENEROUS zone — more expanded than
  // squeezed — helps pitchers, so it must come back negative.
  const generous = umpireLeanFor({ called: 1000, expanded: 120, squeezed: 20, games: 10 })
  assert.equal(generous.source, 'zone')
  assert.ok(generous.lean < 0)

  const tight = umpireLeanFor({ called: 1000, expanded: 20, squeezed: 120, games: 10 })
  assert.ok(tight.lean > 0)
})

test('the lean returns null with nothing to go on', () => {
  assert.equal(umpireLeanFor(null), null)
  assert.equal(umpireLeanFor({ called: 0 }), null)
  assert.deepEqual(leanInputFromRows([]), { favorNet: 0, favorNetGames: 0 })
})

// --- area to watch ------------------------------------------------------------

// A season aggregate carrying just enough for umpireZoneCells + the floors.
function season({ cellMiss, missL = null, missR = null, misses = 200 }) {
  return {
    called: 2000,
    expanded: Math.floor(misses / 2),
    squeezed: Math.ceil(misses / 2),
    cellCalled: Array(9).fill(200),
    cellStrikeCall: Array(9).fill(100),
    cellMiss,
    missL,
    missR,
  }
}
const FLAT_LEAGUE = Array(9).fill(1 / 9)

test('umpireWatchArea names the cell the zone map flags hardest', () => {
  // All the excess in cell 0 — high and outside.
  const s = season({ cellMiss: [60, 5, 5, 5, 5, 5, 5, 5, 5] })
  const w = umpireWatchArea(s, FLAT_LEAGUE)
  assert.equal(w.cell, 0)
  assert.equal(w.phrase, 'Up and outside')
})

test('umpireWatchArea stays quiet when nothing clears the league baseline', () => {
  // Exactly league-average everywhere: no cell is a tendency.
  assert.equal(umpireWatchArea(season({ cellMiss: Array(9).fill(10) }), FLAT_LEAGUE), null)
})

test('umpireWatchArea stays quiet below the missed-call floor', () => {
  const s = season({ cellMiss: [60, 0, 0, 0, 0, 0, 0, 0, 0], misses: 2 })
  assert.equal(umpireWatchArea(s, FLAT_LEAGUE), null)
})

test('umpireWatchArea returns null when the rows predate the cell grid', () => {
  assert.equal(umpireWatchArea({ called: 100, expanded: 50, squeezed: 50 }, FLAT_LEAGUE), null)
})

test('the handedness clause only appears when a side is clearly worse', () => {
  const cellMiss = [60, 5, 5, 5, 5, 5, 5, 5, 5] // cell 0 -> region 'outside'

  // Bacchus' real shape: outside runs 14.8% of right-handed misses against
  // 7.7% of left-handed ones. Names the hand.
  const lopsided = umpireWatchArea(
    season({
      cellMiss,
      missL: { high: 27, low: 30, inside: 27, outside: 7 },
      missR: { high: 34, low: 40, inside: 30, outside: 18 },
    }),
    FLAT_LEAGUE,
  )
  assert.equal(lopsided.hand, 'R')

  // …and his LOW misses, which split 33.0% / 32.8%, must NOT get one. This is
  // the case the margin gate exists for: without it the card publishes a
  // handedness finding that isn't in the data.
  const even = umpireWatchArea(
    season({
      cellMiss: [5, 5, 5, 5, 5, 5, 5, 60, 5], // cell 7 -> region 'low'
      missL: { high: 27, low: 30, inside: 27, outside: 7 },
      missR: { high: 34, low: 40, inside: 30, outside: 18 },
    }),
    FLAT_LEAGUE,
  )
  assert.equal(even.hand, null)
})

test('the centre cell never takes a hand', () => {
  const w = umpireWatchArea(
    season({
      cellMiss: [5, 5, 5, 5, 60, 5, 5, 5, 5],
      missL: { high: 1, low: 1, inside: 1, outside: 90 },
      missR: { high: 90, low: 1, inside: 1, outside: 1 },
    }),
    FLAT_LEAGUE,
  )
  assert.equal(w.phrase, 'Over the middle')
  assert.equal(w.hand, null)
})

test('handedness degrades quietly on rows swept before missL/missR', () => {
  const w = umpireWatchArea(season({ cellMiss: [60, 5, 5, 5, 5, 5, 5, 5, 5] }), FLAT_LEAGUE)
  assert.equal(w.hand, null)
  assert.equal(w.phrase, 'Up and outside')
})
