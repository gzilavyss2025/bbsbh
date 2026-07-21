import assert from 'node:assert/strict'
import test from 'node:test'
import { seasonSeriesCells } from '../src/api/seasonSeries.js'

const NYM = 121
const MIL = 158

test('seasonSeriesCells: winner/loser and score ordering for a finished game', () => {
  const games = [
    { gamePk: 1, apiDate: '2026-07-20', gameDate: '2026-07-20T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: 3, homeScore: 8 },
  ]
  const [cell] = seasonSeriesCells(games, MIL, /* currentGamePk */ 2)
  assert.equal(cell.final, true)
  assert.equal(cell.winnerId, MIL)
  assert.equal(cell.winnerScore, 8)
  assert.equal(cell.loserScore, 3)
  assert.equal(cell.loserAbbr, 'NYM')
  assert.equal(cell.isHome, true)
  assert.equal(cell.opponentAbbr, 'NYM')
})

test('seasonSeriesCells: the currently-viewed game never carries a score, even if the feed marks it Final', () => {
  const games = [
    { gamePk: 2, apiDate: '2026-07-21', gameDate: '2026-07-21T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: 5, homeScore: 1 },
  ]
  const [cell] = seasonSeriesCells(games, MIL, /* currentGamePk */ 2)
  assert.equal(cell.isCurrent, true)
  assert.equal(cell.final, false)
  assert.equal(cell.winnerId, null)
  assert.equal(cell.winnerScore, null)
  assert.equal(cell.loserScore, null)
})

test('seasonSeriesCells: a not-yet-played game carries no score or winner, and passes its venue tz through', () => {
  const games = [
    { gamePk: 3, apiDate: '2026-08-25', gameDate: '2026-08-25T23:10:00Z', gameNumber: 1, awayId: MIL, homeId: NYM, final: false, awayScore: null, homeScore: null, tzId: 'America/New_York' },
  ]
  const [cell] = seasonSeriesCells(games, MIL, /* currentGamePk */ 2)
  assert.equal(cell.final, false)
  assert.equal(cell.winnerId, null)
  assert.equal(cell.isHome, false)
  assert.equal(cell.opponentAbbr, 'NYM')
  assert.equal(cell.tzId, 'America/New_York')
})

test('seasonSeriesCells: degrades to no winner on a tied/incomplete score pair', () => {
  const games = [
    { gamePk: 4, apiDate: '2026-06-01', gameDate: '2026-06-01T23:10:00Z', gameNumber: 1, awayId: NYM, homeId: MIL, final: true, awayScore: null, homeScore: 4 },
  ]
  const [cell] = seasonSeriesCells(games, MIL, 2)
  assert.equal(cell.winnerId, null)
  assert.equal(cell.winnerScore, null)
  assert.equal(cell.loserAbbr, null)
})
