// The weekly Top-100 history append (#2970, scripts/lib/milb/top100-history.mjs).
import test from 'node:test'
import assert from 'node:assert/strict'
import { appendWeeklySnapshot, isoWeek } from '../scripts/lib/milb/top100-history.mjs'

const players = [{ playerId: 815908, rank: 1 }, { playerId: 1, rank: 2 }]

test('the first run starts the history with one dated snapshot', () => {
  assert.deepEqual(appendWeeklySnapshot(null, '2026-11-16', players), {
    snapshots: [{ date: '2026-11-16', ranks: { 815908: 1, 1: 2 } }],
  })
})

test('a second scrape in the same ISO week adds nothing; the next week adds one', () => {
  const h1 = appendWeeklySnapshot(null, '2026-11-16', players) // Monday
  const same = appendWeeklySnapshot(h1, '2026-11-22', [{ playerId: 815908, rank: 3 }]) // Sunday
  assert.equal(same.snapshots.length, 1)
  assert.equal(same.snapshots[0].ranks[815908], 1)
  const h2 = appendWeeklySnapshot(same, '2026-11-23', [{ playerId: 815908, rank: 3 }])
  assert.equal(h2.snapshots.length, 2)
  assert.deepEqual(h2.snapshots[1], { date: '2026-11-23', ranks: { 815908: 3 } })
})

test('ISO weeks cross the new year by the Thursday rule', () => {
  assert.equal(isoWeek('2026-12-31'), '2026-W53')
  assert.equal(isoWeek('2027-01-01'), '2026-W53')
  assert.equal(isoWeek('2027-01-04'), '2027-W01')
})
