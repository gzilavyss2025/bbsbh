import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prospectTrendById } from '../src/api/prospectTrend.js'

const SNAPSHOT = {
  generatedAt: '2026-08-10',
  dataThrough: '2026-08-10',
  players: [
    { playerId: 111, group: 'hitting', sportId: 12, percentile: 72, qualified: true, movement: null },
    { playerId: 222, group: 'pitching', sportId: 11, percentile: null, qualified: false, movement: null },
  ],
}

test('prospectTrendById returns the row for a known playerId', () => {
  assert.deepEqual(prospectTrendById(SNAPSHOT, 111), SNAPSHOT.players[0])
})

test('prospectTrendById returns the unqualified row as-is, not null', () => {
  assert.deepEqual(prospectTrendById(SNAPSHOT, 222), SNAPSHOT.players[1])
})

test('prospectTrendById returns null for a player with no current-level line', () => {
  assert.equal(prospectTrendById(SNAPSHOT, 999), null)
})

test('prospectTrendById degrades to null on a missing/empty snapshot', () => {
  assert.equal(prospectTrendById(null, 111), null)
  assert.equal(prospectTrendById({}, 111), null)
})
