// historySeriesMode: the World Series mode shape built from one postseason-history.json series.
import assert from 'node:assert/strict'
import test from 'node:test'
import { historySeriesMode, seriesMode } from '../../src/lib/postseason/worldseries/mode.js'

const history = {
  id: '2025-worldseries-119-141',
  teamA: { teamId: 119, wins: 4 },
  teamB: { teamId: 141, wins: 3 },
  games: [
    { gameNumber: 1, date: '2025-10-24', gamePk: 11, awayTeamId: 119, homeTeamId: 141 },
    { gameNumber: 7, date: '2025-11-01', gamePk: 17, awayTeamId: 119, homeTeamId: 141 },
  ],
}

test('slots, games and no games ahead, in the shape seriesMode wants', () => {
  const { mode, cutoff } = historySeriesMode(history)
  assert.deepEqual(mode.series.slots.map((s) => [s.club.id, s.wins]), [[119, 4], [141, 3]])
  assert.equal(mode.series.slots[0].club.abbreviation, 'LAD')
  assert.deepEqual(mode.series.games.map((g) => [g.gamePk, g.gameNumber, g.date]), [[11, 1, '2025-10-24'], [17, 7, '2025-11-01']])
  assert.deepEqual(mode.series.upcoming, [])
  assert.equal(mode.dayType, 'off')
  assert.equal(mode.gameNumber, null)
  assert.deepEqual(mode, seriesMode(mode.series))
  assert.equal(cutoff, '2025-11-02')
})

test('a history series with no games has no mode', () => {
  assert.equal(historySeriesMode({ ...history, games: [] }), null)
})

test('a history series is decided: it names its winner and each game\'s winner from the score', () => {
  const games = [
    { ...history.games[0], awayScore: 4, homeScore: 11 },
    { ...history.games[1], awayScore: 5, homeScore: 4 },
  ]
  const { mode } = historySeriesMode({ ...history, winnerTeamId: 119, games })
  assert.equal(mode.series.decided, true)
  assert.equal(mode.series.winner.id, 119)
  assert.deepEqual(mode.series.games.map((g) => g.winnerId), [141, 119])
})

test('each history game carries its away and home club, for its lineups link', () => {
  const { mode } = historySeriesMode(history)
  assert.deepEqual(mode.series.games.map((g) => [g.awayId, g.homeId]), [[119, 141], [119, 141]])
})
