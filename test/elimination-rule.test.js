// The games-after-elimination rule (scripts/lib/elimination/rule.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eliminatedIds, berthsPerLeague } from '../scripts/lib/elimination/rule.mjs'

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
  assert.deepEqual([2019, 2020, 2021, 2022].map(berthsPerLeague), [5, 8, 5, 6])
})
