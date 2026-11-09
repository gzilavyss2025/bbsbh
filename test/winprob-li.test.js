// Leverage index on the win-probability points (#2978): each point carries the
// play's `li`, the swing ledger reads it for its Pressure meter, and it flows
// only through winprob.js' reveal clamp (ADR-0001).
import assert from 'node:assert/strict'
import test from 'node:test'
import { WIN_PROB_FIELDS } from '../src/api/game.js'
import { selectWinProbBigPlays, selectWinProbPath } from '../src/api/winprob.js'
import { halfIndex } from '../src/api/select.js'

const row = (home, inning, isTopInning, atBatIndex, leverageIndex) => ({
  homeTeamWinProbability: home,
  ...(leverageIndex === undefined ? {} : { leverageIndex }),
  about: { inning, isTopInning, isScoringPlay: false, atBatIndex },
  result: { description: `play ${atBatIndex}` },
})
// The feed's first play has no leverageIndex (seen in every game sampled).
const game = () => [
  row(52, 1, true, 0),
  row(40, 1, false, 1, 1.4),
  row(70, 2, true, 2, 3.2),
  row(90, 2, false, 3, 5.1),
]

test('WIN_PROB_FIELDS asks the feed for leverageIndex', () => {
  assert.ok(WIN_PROB_FIELDS.includes('leverageIndex'))
})

test('each point carries the play LI, and null on the first play', () => {
  const pts = selectWinProbPath(game())
  assert.deepEqual(pts.map((p) => p.li), [null, 1.4, 3.2, 5.1])
})

test('a non-number LI is null, never NaN', () => {
  const pts = selectWinProbPath([row(52, 1, true, 0, 'x'), row(40, 1, false, 1, null)])
  assert.deepEqual(pts.map((p) => p.li), [null, null])
})

test('big plays carry li', () => {
  const big = selectWinProbBigPlays(game(), { minSwing: 1 })
  assert.ok(big.length > 0)
  for (const b of big) assert.ok('li' in b)
  assert.equal(big.find((b) => b.idx === 2).li, 3.2)
})

test('the reveal clamp keeps a sealed half\'s LI out', () => {
  const through = halfIndex(1, 'bottom')
  const pts = selectWinProbPath(game(), { throughHalf: through })
  assert.deepEqual(pts.map((p) => p.li), [null, 1.4])
  // Unclamped, the sealed half's two plays rank first (deltas 30 and 20).
  assert.deepEqual(selectWinProbBigPlays(game(), { minSwing: 1 }).map((b) => [b.idx, b.li]), [[2, 3.2], [3, 5.1], [1, 1.4], [0, null]])
  const big = selectWinProbBigPlays(game(), { throughHalf: through, minSwing: 1 })
  assert.deepEqual(big.map((b) => [b.idx, b.li]), [[1, 1.4], [0, null]])
})
