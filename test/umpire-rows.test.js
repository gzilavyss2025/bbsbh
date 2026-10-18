import test from 'node:test'
import assert from 'node:assert/strict'
import { packUmpireGames, unpackUmpireGames } from '../src/lib/umpire/rows.js'

const row = (o) => ({
  gamePk: 1, date: '2026-05-01', awayId: 158, awayAbbr: 'MIL', homeId: 112, homeAbbr: 'CHC',
  venueId: 17, venueName: 'Wrigley Field', awayScore: 3, homeScore: 5,
  awayIsWinner: false, homeIsWinner: true, role: 'HP', ...o,
})
const roundTrip = (games) => unpackUmpireGames(packUmpireGames(games))

test('pack moves abbreviations, venue and winner flags out of the row and back, losslessly', () => {
  const games = [row({}), row({ gamePk: 2, awayScore: 6, awayIsWinner: true, homeIsWinner: false })]
  const packed = packUmpireGames(games)
  assert.deepEqual(packed.teams, { 158: 'MIL', 112: 'CHC' })
  assert.deepEqual(packed.venues, { 17: 'Wrigley Field' })
  for (const g of packed.games) {
    assert.ok(!('awayAbbr' in g) && !('venueName' in g) && !('awayIsWinner' in g))
  }
  assert.deepEqual(unpackUmpireGames(packed), games)
})

test('a tie keeps its null flags: the scores cannot say it was suspended, not lost', () => {
  const games = [row({ awayScore: 4, homeScore: 4, awayIsWinner: null, homeIsWinner: null })]
  assert.deepEqual(roundTrip(games), games)
  const flags = [row({ awayScore: 4, homeScore: 4, awayIsWinner: false, homeIsWinner: false })]
  assert.deepEqual(roundTrip(flags), flags)
})

test('a missing id or a club whose abbreviation changed stays on its row', () => {
  const games = [row({ awayId: null, awayAbbr: '' }), row({ gamePk: 2, homeAbbr: 'CHW' })]
  assert.deepEqual(roundTrip(games), games)
})

test('a shard written before the pack passes through unchanged', () => {
  const games = [row({})]
  assert.deepEqual(unpackUmpireGames({ games }), games)
  assert.deepEqual(unpackUmpireGames(null), [])
})
