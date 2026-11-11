// The games-after-elimination rule (scripts/lib/elimination/rule.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eliminatedIds, berthsPerLeague, isPlayed } from '../scripts/lib/elimination/rule.mjs'

const t = (id, elim, wc, clinched = false) => ({
  team: { id },
  eliminationNumber: elim,
  wildCardEliminationNumber: wc,
  clinched,
})

test('out when both elimination numbers read E', () => {
  assert.deepEqual([...eliminatedIds([t(1, 'E', 'E'), t(2, 'E', '3')], 2019)], [1])
})

test('a division leader with no wild-card number is not out', () => {
  assert.deepEqual([...eliminatedIds([t(1, '2', '-')], 2019)], [])
})

test('out on a tiebreaker once every berth is clinched (Brewers, 2022-10-04)', () => {
  const clinchers = [10, 11, 12, 13, 14, 15].map((id) => t(id, '-', '-', true))
  assert.deepEqual([...eliminatedIds([...clinchers, t(158, 'E', '1')], 2022)], [158])
})

test('five clinched clubs leave a 2022 team alive', () => {
  const clinchers = [10, 11, 12, 13, 14].map((id) => t(id, '-', '-', true))
  assert.deepEqual([...eliminatedIds([...clinchers, t(158, 'E', '1')], 2022)], [])
})

test('berths by season', () => {
  assert.deepEqual([1995, 2011, 2012, 2019, 2020, 2021, 2022].map(berthsPerLeague), [4, 4, 5, 5, 8, 5, 6])
})

test('four clinched clubs fill a 2005 league', () => {
  const clinchers = [10, 11, 12, 13].map((id) => t(id, '-', '-', true))
  assert.deepEqual([...eliminatedIds([...clinchers, t(1, 'E', '1')], 2005)], [1])
})

test('a Final entry with no score was never played; a scored tie was', () => {
  const g = (state, a, h) => ({ status: { codedGameState: state }, teams: { away: { score: a }, home: { score: h } } })
  assert.equal(isPlayed(g('F', 3, 3)), true)
  assert.equal(isPlayed(g('F', undefined, undefined)), false)
  assert.equal(isPlayed(g('D', 0, 0)), false)
})
