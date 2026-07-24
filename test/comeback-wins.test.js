// Coverage for the comeback-wins data layer: the generator's pure classifiers
// (gen-comeback-wins.mjs) and the reader/selectors (src/api/comebackWins.js).
import assert from 'node:assert/strict'
import test from 'node:test'
import { winnerMinWinProb, bothMinWinProbs, comebackBuckets } from '../scripts/gen-comeback-wins.mjs'
import { comebackWinsFor, leagueComebackWinsFor, comebackRatesFor } from '../src/api/comebackWins.js'

const wp = (...homes) => homes.map((h) => ({ homeTeamWinProbability: h }))

// --------------------------------------------------------------------------
// bothMinWinProbs — each side's lowest win % across the game.
// --------------------------------------------------------------------------
test('bothMinWinProbs: home min is the low, away min is 100 − the home high', () => {
  // Home ranges 8..100 → home min 8; away min is 100 − 100 = 0.
  assert.deepEqual(bothMinWinProbs(wp(50, 8, 40, 100)), { home: 8, away: 0 })
})

test('bothMinWinProbs: null on absent/empty/non-numeric data', () => {
  assert.equal(bothMinWinProbs([]), null)
  assert.equal(bothMinWinProbs(null), null)
  assert.equal(bothMinWinProbs([{ foo: 1 }]), null)
})

// --------------------------------------------------------------------------
// winnerMinWinProb — the winner's lowest win % across the game.
// --------------------------------------------------------------------------
test('winnerMinWinProb: home winner uses the home min directly', () => {
  // Home dips to 8 before winning → its minimum is 8.
  assert.equal(winnerMinWinProb(wp(50, 8, 40, 100), true), 8)
})

test('winnerMinWinProb: away winner uses 100 − the home max', () => {
  // Home peaks at 82, so the away team once sat at 18 → away min is 18.
  assert.equal(winnerMinWinProb(wp(50, 82, 30, 0), false), 18)
})

test('winnerMinWinProb: null on absent/empty/non-numeric data', () => {
  assert.equal(winnerMinWinProb([], true), null)
  assert.equal(winnerMinWinProb(null, true), null)
  assert.equal(winnerMinWinProb([{ foo: 1 }], true), null)
})

// --------------------------------------------------------------------------
// comebackBuckets — nested thresholds off the winner's minimum.
// --------------------------------------------------------------------------
test('comebackBuckets nests: a sub-10 win also counts sub-20 and sub-30', () => {
  assert.deepEqual(comebackBuckets(8), { sub10: 1, sub20: 1, sub30: 1 })
  assert.deepEqual(comebackBuckets(15), { sub10: 0, sub20: 1, sub30: 1 })
  assert.deepEqual(comebackBuckets(25), { sub10: 0, sub20: 0, sub30: 1 })
  assert.deepEqual(comebackBuckets(45), { sub10: 0, sub20: 0, sub30: 0 })
})

test('comebackBuckets thresholds are strict (< not <=) and null-safe', () => {
  assert.deepEqual(comebackBuckets(10), { sub10: 0, sub20: 1, sub30: 1 })
  assert.deepEqual(comebackBuckets(30), { sub10: 0, sub20: 0, sub30: 0 })
  assert.deepEqual(comebackBuckets(null), { sub10: 0, sub20: 0, sub30: 0 })
})

// --------------------------------------------------------------------------
// reader/selectors
// --------------------------------------------------------------------------
const DATA = {
  version: 2,
  seasons: {
    2026: {
      byTeamId: {
        110: { sub10: 1, sub20: 2, sub30: 3, att10: 4, att20: 8, att30: 12, wins: 40 },
        111: { sub10: 0, sub20: 0, sub30: 1, att10: 5, att20: 9, att30: 15, wins: 38 },
      },
    },
  },
}

test('comebackWinsFor selects one team/season row, null when absent', () => {
  assert.deepEqual(comebackWinsFor(DATA, 110, 2026), {
    sub10: 1, sub20: 2, sub30: 3, att10: 4, att20: 8, att30: 12, wins: 40,
  })
  assert.equal(comebackWinsFor(DATA, 999, 2026), null)
  assert.equal(comebackWinsFor(null, 110, 2026), null)
})

test('leagueComebackWinsFor shapes rows for statRank ({ teamId, stat })', () => {
  const rows = leagueComebackWinsFor(DATA, 2026)
  assert.deepEqual(rows, [
    { teamId: 110, stat: { sub10: 1, sub20: 2, sub30: 3 } },
    { teamId: 111, stat: { sub10: 0, sub20: 0, sub30: 1 } },
  ])
  assert.deepEqual(leagueComebackWinsFor(null, 2026), [])
})

// --------------------------------------------------------------------------
// comebackRatesFor — the card's per-threshold rate + pooled MLB baseline.
// --------------------------------------------------------------------------
test('comebackRatesFor: rate is wins/att, baseline is pooled Σwins/Σatt', () => {
  const out = comebackRatesFor(DATA, 110, 2026)
  assert.equal(out.wins, 40)
  const s10 = out.thresholds.find((t) => t.key === 'sub10')
  // team 110: 1 of 4 = 0.25; league pool: (1+0) / (4+5) = 1/9.
  assert.equal(s10.wins, 1)
  assert.equal(s10.att, 4)
  assert.equal(s10.rate, 0.25)
  assert.equal(s10.leagueRate, 1 / 9)
  assert.equal(s10.pct, 10)
})

test('comebackRatesFor: count-rank with ties shares the best rank', () => {
  const out = comebackRatesFor(DATA, 110, 2026)
  // 110 leads every bucket outright over 111 → rank 1, untied.
  for (const t of out.thresholds) {
    assert.equal(t.rank, 1)
    assert.equal(t.of, 2)
    assert.equal(t.tied, false)
  }
  // 111 trails on sub10/sub20 (rank 2) but matches nobody above on sub30 (=1)
  // where it sits behind 110's 3 → still rank 2.
  const trailing = comebackRatesFor(DATA, 111, 2026)
  assert.deepEqual(trailing.thresholds.map((t) => t.rank), [2, 2, 2])
})

test('comebackRatesFor: null row → null; a threshold never reached → null rate', () => {
  assert.equal(comebackRatesFor(DATA, 999, 2026), null)
  assert.equal(comebackRatesFor(null, 110, 2026), null)
  // A club with zero attempts at a depth reports a null rate (no divide-by-zero).
  const zero = {
    version: 2,
    seasons: { 2026: { byTeamId: { 200: { sub10: 0, sub20: 0, sub30: 0, att10: 0, att20: 0, att30: 0, wins: 5 } } } },
  }
  assert.equal(comebackRatesFor(zero, 200, 2026).thresholds[0].rate, null)
})
