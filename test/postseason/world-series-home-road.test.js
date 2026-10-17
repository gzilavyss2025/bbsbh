import assert from 'node:assert/strict'
import test from 'node:test'
import { homeRoad, octRecord } from '../../src/lib/postseason/worldseries/homeRoad.js'

const A = 119
const B = 141
const SLATE = '2026-10-27'
// { gamePk, date, final, homeId, awayId, winnerId } as the results fetch will carry.
const g = (gamePk, date, homeId, awayId, winnerId, final = true) => ({ gamePk, date, final, homeId, awayId, winnerId })
const rows = [
  g(1, '2026-10-10', A, 1, A),
  g(2, '2026-10-12', 2, A, 2),
  g(3, '2026-10-14', A, 3, A),
  g(4, '2026-10-20', 4, A, A),
  g(5, SLATE, A, B, A), // Final on the slate date: must not count
  g(6, '2026-10-26', 5, 6, 5), // someone else's game
]

test('cutoff: a game Final on the slate date is in neither the rows nor the record', () => {
  const hr = homeRoad(rows, A, SLATE)
  assert.deepEqual(hr.home, ['W', 'W'])
  assert.deepEqual(octRecord(rows, A, SLATE), { wins: 3, losses: 1 })
})

test('home and road blocks in date order with a W-L count each', () => {
  const hr = homeRoad(rows, A, SLATE)
  assert.deepEqual(hr.road, ['L', 'W'])
  assert.deepEqual(hr.homeRecord, { wins: 2, losses: 0 })
  assert.deepEqual(hr.roadRecord, { wins: 1, losses: 1 })
})

test('unfinished and winner-less rows (a postponed listing) are ignored', () => {
  const extra = [...rows, g(7, '2026-10-22', A, 8, null), g(8, '2026-10-23', A, 8, A, false)]
  assert.deepEqual(octRecord(extra, A, SLATE), { wins: 3, losses: 1 })
})
