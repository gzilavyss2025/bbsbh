// Unit coverage for the win-probability chart's data layer — the reveal-only
// selector (winprob.js) that feeds WinProbChart, plus a REGRESSION GUARD on the
// `fields=` allowlist the fetch prunes with (game.js).
//
// Why the guard exists: WIN_PROB_FIELDS is a hand-maintained allowlist. The chart
// line reads the CUMULATIVE `homeTeamWinProbability`, but the list was once tuned
// only for the box-score three stars (which read the per-play DELTA
// `homeTeamWinProbabilityAdded`). The cumulative field was missing, statsapi
// pruned it, `selectWinProbPath` skipped every entry, and the chart silently drew
// nothing on every game. This pins the allowlist to what the selector actually
// reads so that regression can't recur unnoticed.
import assert from 'node:assert/strict'
import test from 'node:test'
import { WIN_PROB_FIELDS } from '../src/api/game.js'
import {
  selectWinProbPath,
  winProbSplit,
  selectWinProbSwings,
  selectWinProbBigPlays,
} from '../src/api/winprob.js'

// A tiny win-probability array shaped like the /winProbability endpoint's rows:
// one entry per completed play, carrying the cumulative home win % and `about`.
function buildWinProb() {
  const row = (home, inning, isTopInning, isScoringPlay, description) => ({
    homeTeamWinProbability: home,
    about: { inning, isTopInning, isScoringPlay },
    result: { description },
  })
  return [
    row(52, 1, true, false, 'Flyout'),
    row(58, 1, false, true, 'RBI single'), // home takes the lead, bottom 1
    row(46, 2, true, true, 'Two-run double'), // away answers, top 2
    row(70, 2, false, true, 'Three-run homer'), // home pulls away, bottom 2
  ]
}

// --------------------------------------------------------------------------
// Regression guard: the allowlist must cover every field the selector reads.
// --------------------------------------------------------------------------
test('WIN_PROB_FIELDS covers every field selectWinProbPath reads', () => {
  // The `fields=` filter matches key names at any depth, so a nested read like
  // `about.isScoringPlay` needs BOTH the parent (`about`) and the leaf
  // (`isScoringPlay`) present. This is the exact set winprob.js dereferences.
  const required = [
    'homeTeamWinProbability', // e.homeTeamWinProbability — the chart line
    'about', // e.about.{inning,isTopInning,isScoringPlay}
    'inning',
    'isTopInning',
    'isScoringPlay',
    'result', // e.result.description
    'description',
  ]
  const present = new Set(WIN_PROB_FIELDS)
  for (const field of required) {
    assert.ok(present.has(field), `WIN_PROB_FIELDS is missing "${field}"`)
  }
})

// --------------------------------------------------------------------------
// selectWinProbPath — the reveal-gated shaper.
// --------------------------------------------------------------------------
test('selectWinProbPath shapes ordered points carrying a numeric home win %', () => {
  const points = selectWinProbPath(buildWinProb())
  assert.equal(points.length, 4)
  for (const p of points) assert.equal(typeof p.home, 'number')
  assert.deepEqual(
    points.map((p) => [p.home, p.inning, p.half, p.isScoring]),
    [
      [52, 1, 'top', false],
      [58, 1, 'bottom', true],
      [46, 2, 'top', true],
      [70, 2, 'bottom', true],
    ],
  )
})

test('selectWinProbPath clamps to the revealed half (throughHalf)', () => {
  // halfIndex(1,'bottom') === 1, so throughHalf=1 keeps only top1 + bottom1.
  const points = selectWinProbPath(buildWinProb(), { throughHalf: 1 })
  assert.equal(points.length, 2)
  assert.deepEqual(points.map((p) => p.home), [52, 58])
})

test('selectWinProbPath skips entries with a missing/non-numeric win %', () => {
  // This is precisely the field-pruned failure mode: no homeTeamWinProbability.
  const pruned = [{ about: { inning: 1, isTopInning: true } }]
  assert.deepEqual(selectWinProbPath(pruned), [])
})

test('selectWinProbPath degrades to [] on absent data (MiLB null)', () => {
  assert.deepEqual(selectWinProbPath(null), [])
  assert.deepEqual(selectWinProbPath([]), [])
})

test('winProbSplit reads the last plotted point and inherits the gate', () => {
  const points = selectWinProbPath(buildWinProb())
  assert.deepEqual(winProbSplit(points), { home: 70, away: 30 })
  const thru1 = selectWinProbPath(buildWinProb(), { throughHalf: 1 })
  assert.deepEqual(winProbSplit(thru1), { home: 58, away: 42 })
  assert.equal(winProbSplit([]), null)
})

// --------------------------------------------------------------------------
// selectWinProbSwings — per-half net swing (the Swing Stubs strip).
// --------------------------------------------------------------------------
test('selectWinProbSwings gives one signed net swing per revealed half', () => {
  // Halves end at 52, 58, 46, 70; entered on 50, 52, 58, 46 → swings +2,+6,-12,+24.
  const swings = selectWinProbSwings(buildWinProb())
  assert.deepEqual(
    swings.map((s) => [s.inning, s.half, s.swing]),
    [
      [1, 'top', 2],
      [1, 'bottom', 6],
      [2, 'top', -12],
      [2, 'bottom', 24],
    ],
  )
})

test('selectWinProbSwings sums multiple plays within a half into one bar', () => {
  // Two plays in top 1 (48 then 44) collapse to a single half entry: 44-50 = -6.
  const wp = [
    { homeTeamWinProbability: 48, about: { inning: 1, isTopInning: true } },
    { homeTeamWinProbability: 44, about: { inning: 1, isTopInning: true } },
    { homeTeamWinProbability: 55, about: { inning: 1, isTopInning: false } },
  ]
  const swings = selectWinProbSwings(wp)
  assert.deepEqual(
    swings.map((s) => [s.inning, s.half, s.swing]),
    [
      [1, 'top', -6],
      [1, 'bottom', 11],
    ],
  )
})

test('selectWinProbSwings clamps to the revealed half and degrades to []', () => {
  assert.equal(selectWinProbSwings(buildWinProb(), { throughHalf: 1 }).length, 2)
  assert.deepEqual(selectWinProbSwings(null), [])
  assert.deepEqual(selectWinProbSwings([]), [])
})

// --------------------------------------------------------------------------
// selectWinProbBigPlays — the "how we got here" ledger.
// --------------------------------------------------------------------------
test('selectWinProbBigPlays returns the biggest swings, newest first', () => {
  // Per-play deltas from even: +2, +6, -12, +24. With minSwing 8 only the last
  // two qualify; newest-first ⇒ the +24 (idx 3) then the -12 (idx 2).
  const plays = selectWinProbBigPlays(buildWinProb(), { minSwing: 8 })
  assert.deepEqual(
    plays.map((p) => [p.inning, p.half, p.delta, p.desc]),
    [
      [2, 'bottom', 24, 'Three-run homer'],
      [2, 'top', -12, 'Two-run double'],
    ],
  )
})

test('selectWinProbBigPlays caps at limit and inherits the reveal gate', () => {
  assert.equal(selectWinProbBigPlays(buildWinProb(), { minSwing: 1, limit: 2 }).length, 2)
  // Through bottom 1 only, nothing clears an 8-point swing yet.
  assert.deepEqual(selectWinProbBigPlays(buildWinProb(), { throughHalf: 1 }), [])
  assert.deepEqual(selectWinProbBigPlays(null), [])
})
