// check-feed-shape-drift.mjs compares a captured finished game's feed with a
// fresh fetch. A finished game's players block carries each player's CURRENT
// bio, so one released player losing a field (Jake Bauers' jersey number,
// 2026-11-04) is roster state, not API shape. A field every player lost is.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { missingPaths } from '../scripts/check-feed-shape-drift.mjs'

const feed = (players) => ({ gameData: { players, game: { pk: 1 } } })

test('one player losing a bio field is not drift', () => {
  const captured = feed({ ID1: { fullName: 'A', primaryNumber: '9' }, ID2: { fullName: 'B', primaryNumber: '33' } })
  const fresh = feed({ ID1: { fullName: 'A' }, ID2: { fullName: 'B', primaryNumber: '33' } })
  assert.deepEqual(missingPaths(captured, fresh), [])
})

test('a field no player has any more is drift', () => {
  const captured = feed({ ID1: { fullName: 'A', primaryNumber: '9' } })
  const fresh = feed({ ID1: { fullName: 'A' }, ID2: { fullName: 'B' } })
  assert.deepEqual(missingPaths(captured, fresh), ['gameData.players.ID*.primaryNumber'])
})

test('a removed non-player path is still drift', () => {
  assert.deepEqual(missingPaths(feed({}), { gameData: { players: {} } }), ['gameData.game', 'gameData.game.pk'])
})
