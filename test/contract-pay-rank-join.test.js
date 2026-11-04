// Pay rank lives in one league file (public/data/pay-ranks.json), not in the 100
// player-contract shards: one signing re-ranks a whole pool, and with the rank
// inside each shard it rewrote all 100 of them (~120 files a night in the
// 2026-11 offseason). fetchPlayerContract joins it back for its callers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withPayRank } from '../src/api/person/contracts.js'

const rank = { pos: 'SP', rank: 3, of: 212, tied: false, onMinimum: false, fractionBelow: 0.99 }

test('a player in the league file gets his pay rank back on the record', () => {
  assert.deepEqual(withPayRank({ club: 'MIL' }, { ranks: { 605400: rank } }, 605400), { club: 'MIL', payRank: rank })
})

test('a player with no rank, or no league file, gets payRank null, never a crash', () => {
  assert.deepEqual(withPayRank({ club: 'MIL' }, { ranks: {} }, 1), { club: 'MIL', payRank: null })
  assert.deepEqual(withPayRank({ club: 'MIL' }, null, 1), { club: 'MIL', payRank: null })
})
