import assert from 'node:assert/strict'
import test from 'node:test'
import { leadSide, pickHotBat } from '../../src/lib/postseason/worldseries/hotBats.js'

const split = (id, pa, ops, extra = {}) => ({
  player: { id, fullName: `H${id}` },
  position: { abbreviation: 'CF' },
  stat: { plateAppearances: pa, ops, avg: '.300', obp: '.400', slg: '.600', homeRuns: 2, rbi: 5, ...extra },
})

test('most PA among OPS >= 1.000, OPS parsed from its string', () => {
  const splits = [split(1, 40, '1.271'), split(2, 55, '0.999'), split(3, 30, '1.000'), split(4, 12, '2.100'), split(5, 80, '.640')]
  const bat = pickHotBat(splits)
  assert.equal(bat.id, 1)
  assert.deepEqual([bat.name, bat.pos, bat.pa], ['H1', 'CF', 40])
  assert.deepEqual([bat.avg, bat.obp, bat.slg, bat.hr, bat.rbi], ['.300', '.400', '.600', 2, 5])
})

test('splits are not pre-sorted: the pick does not depend on order', () => {
  assert.equal(pickHotBat([split(3, 30, '1.000'), split(1, 40, '1.271')]).id, 1)
  assert.equal(pickHotBat([split(1, 40, '1.271'), split(3, 30, '1.000')]).id, 1)
})

test('null when nobody qualifies; unparseable OPS ("-.--") never qualifies', () => {
  assert.equal(pickHotBat([split(1, 40, '.900'), split(2, 50, '-.--')]), null)
  assert.equal(pickHotBat([]), null)
  assert.equal(pickHotBat(undefined), null)
})

test('leadSide: the higher figure leads; a tie or a missing side leads nothing', () => {
  assert.equal(leadSide(3, 1), 'a')
  assert.equal(leadSide('.250', '.300'), 'b')
  assert.equal(leadSide(2, 2), null)
  assert.equal(leadSide(null, 2), null)
  assert.equal(leadSide(3.1, 4.5, { lowerWins: true }), 'a')
})
