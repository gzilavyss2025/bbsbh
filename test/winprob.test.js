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
import { selectWinProbPath, winProbSplit, selectWinProbBigPlays } from '../src/api/winprob.js'

// A tiny win-probability array shaped like the /winProbability endpoint's rows:
// one entry per completed play, carrying the cumulative home win % and `about`.
// atBatIndex counts up play-by-play, same field play-by-play.js's own entries
// carry off `play.about.atBatIndex` — the join key the at-bat-stepping clamp
// (stepHalfIndex/throughAtBatIndex) matches against. Bottom 1 deliberately
// carries TWO rows (not one) so a step-clamp test can tell "only the first
// at-bat of this half" apart from "the whole half" — a single-row-per-half
// fixture can't distinguish those, which is exactly how an earlier draft of
// the step clamp shipped a whole-half leak undetected (see the adjacency
// tests below).
function buildWinProb() {
  const row = (home, inning, isTopInning, isScoringPlay, description, atBatIndex) => ({
    homeTeamWinProbability: home,
    about: { inning, isTopInning, isScoringPlay, atBatIndex },
    result: { description },
  })
  return [
    row(52, 1, true, false, 'Flyout', 0), // top 1
    row(55, 1, false, false, 'Groundout', 1), // bottom 1, first at-bat
    row(58, 1, false, true, 'RBI single', 2), // bottom 1, second at-bat — home takes the lead
    row(46, 2, true, true, 'Two-run double', 3), // away answers, top 2
    row(70, 2, false, true, 'Three-run homer', 4), // home pulls away, bottom 2
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
    'about', // e.about.{inning,isTopInning,isScoringPlay,atBatIndex}
    'inning',
    'isTopInning',
    'isScoringPlay',
    'atBatIndex', // the at-bat-stepping clamp (stepHalfIndex/throughAtBatIndex)
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
  assert.equal(points.length, 5)
  for (const p of points) assert.equal(typeof p.home, 'number')
  assert.deepEqual(
    points.map((p) => [p.home, p.inning, p.half, p.isScoring]),
    [
      [52, 1, 'top', false],
      [55, 1, 'bottom', false],
      [58, 1, 'bottom', true],
      [46, 2, 'top', true],
      [70, 2, 'bottom', true],
    ],
  )
})

test('selectWinProbPath clamps to the revealed half (throughHalf)', () => {
  // halfIndex(1,'bottom') === 1, so throughHalf=1 keeps only top1 + bottom1
  // (both of bottom 1's rows — throughHalf is a committed-half clamp, not a
  // per-play one).
  const points = selectWinProbPath(buildWinProb(), { throughHalf: 1 })
  assert.equal(points.length, 3)
  assert.deepEqual(points.map((p) => p.home), [52, 55, 58])
})

// --------------------------------------------------------------------------
// At-bat stepping (ADR-0016): stepHalfIndex/throughAtBatIndex grow the line
// one point at a time within the ONE half being stepped through, without
// ever reaching past what PlayByPlay has actually rendered for it — and
// ONLY for the half immediately after the reveal mark (throughHalf + 1),
// never a half further out (see the adjacency guard's own doc in
// winprob.js — win probability is cumulative, so leaking a point from a
// non-adjacent half spoils the whole game up to that moment, not just that
// half's own events).
// --------------------------------------------------------------------------
test('selectWinProbPath plots only the first stepped at-bat, not the whole half', () => {
  // throughHalf=0 (only top 1 committed); bottom 1 is being stepped through
  // and only its FIRST at-bat (atBatIndex 1) has been revealed — its second
  // (atBatIndex 2, home win % 58) must NOT appear yet. A fixture with one row
  // per half can't catch a "whole half leaked" bug; this one can.
  const points = selectWinProbPath(buildWinProb(), {
    throughHalf: 0,
    stepHalfIndex: 1,
    throughAtBatIndex: 1,
  })
  assert.deepEqual(points.map((p) => p.home), [52, 55])
})

test('selectWinProbPath grows to the second stepped at-bat once its boundary is reported', () => {
  const points = selectWinProbPath(buildWinProb(), {
    throughHalf: 0,
    stepHalfIndex: 1,
    throughAtBatIndex: 2,
  })
  assert.deepEqual(points.map((p) => p.home), [52, 55, 58])
})

test('selectWinProbPath never plots past the reported step boundary', () => {
  // Even though top 2 (atBatIndex 3) and bottom 2 (atBatIndex 4) exist in the
  // data, throughAtBatIndex=1 must not surface them.
  const points = selectWinProbPath(buildWinProb(), {
    throughHalf: 0,
    stepHalfIndex: 1,
    throughAtBatIndex: 1,
  })
  assert.equal(points.length, 2)
})

test('selectWinProbPath ignores stepHalfIndex without a throughAtBatIndex', () => {
  // Passing curIdx unconditionally (InningViewer's own usage) must be a no-op
  // until a real boundary is reported — not stepHalfIndex alone.
  const points = selectWinProbPath(buildWinProb(), { throughHalf: 0, stepHalfIndex: 1 })
  assert.deepEqual(points.map((p) => p.home), [52])
})

test('selectWinProbPath applies the step clamp only to the named half', () => {
  // stepHalfIndex targets bottom 1 (idx 1); a boundary that happens to reach
  // an atBatIndex belonging to a DIFFERENT, not-yet-reached half (bottom 2's
  // atBatIndex 4) must not leak that half's points in — only bottom 1's own
  // two rows show, never top 2's or bottom 2's.
  const points = selectWinProbPath(buildWinProb(), {
    throughHalf: 0,
    stepHalfIndex: 1,
    throughAtBatIndex: 4,
  })
  assert.deepEqual(points.map((p) => p.home), [52, 55, 58])
})

test('selectWinProbPath rejects a non-adjacent stepHalfIndex (spoiler guard)', () => {
  // The exact bug this guards against: a user can navigate straight to a
  // half further out than the reveal frontier (RollingLine's navigator isn't
  // gated by revealedThrough) and start stepping it there. stepHalfIndex=2
  // (top 2) is NOT throughHalf+1 (=1, bottom 1) — even with a generous
  // throughAtBatIndex, top 2's cumulative win-probability point (which alone
  // would spoil the whole game through that moment) must not appear.
  const points = selectWinProbPath(buildWinProb(), {
    throughHalf: 0,
    stepHalfIndex: 2,
    throughAtBatIndex: 3,
  })
  assert.deepEqual(points.map((p) => p.home), [52])
})

test('selectWinProbBigPlays grows with the in-progress step too', () => {
  // Both plotted points clear minSwing=1 (deltas from even: +2 top 1, +3 the
  // first bottom-1 at-bat) — newest (the in-progress step's own point) first.
  const plays = selectWinProbBigPlays(buildWinProb(), {
    throughHalf: 0,
    stepHalfIndex: 1,
    throughAtBatIndex: 1,
    minSwing: 1,
  })
  assert.deepEqual(
    plays.map((p) => [p.inning, p.half, p.delta]),
    [
      [1, 'bottom', 3],
      [1, 'top', 2],
    ],
  )
})

test('selectWinProbBigPlays rejects a non-adjacent stepHalfIndex too', () => {
  const plays = selectWinProbBigPlays(buildWinProb(), {
    throughHalf: 0,
    stepHalfIndex: 2,
    throughAtBatIndex: 3,
    minSwing: 1,
  })
  assert.deepEqual(
    plays.map((p) => [p.inning, p.half]),
    [[1, 'top']],
  )
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
