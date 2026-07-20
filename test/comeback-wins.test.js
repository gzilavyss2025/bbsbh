// Coverage for the comeback-wins data layer: the generator's pure classifiers
// (gen-comeback-wins.mjs) and the reader/selectors (src/api/comebackWins.js).
import assert from 'node:assert/strict'
import test from 'node:test'
import { winnerMinWinProb, comebackBuckets } from '../scripts/gen-comeback-wins.mjs'
import { comebackWinsFor, leagueComebackWinsFor } from '../src/api/comebackWins.js'

const wp = (...homes) => homes.map((h) => ({ homeTeamWinProbability: h }))

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
  version: 1,
  seasons: {
    2026: {
      byTeamId: {
        110: { sub10: 1, sub20: 2, sub30: 3, wins: 40 },
        111: { sub10: 0, sub20: 0, sub30: 1, wins: 38 },
      },
    },
  },
}

test('comebackWinsFor selects one team/season row, null when absent', () => {
  assert.deepEqual(comebackWinsFor(DATA, 110, 2026), { sub10: 1, sub20: 2, sub30: 3, wins: 40 })
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
