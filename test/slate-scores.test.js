// Unit coverage for the slate's score-free model. The slate model
// (normalizeGame) NEVER carries a score-bearing field, even handed a raw
// schedule row that has them — the spoiler-critical guarantee that a
// render-gate bug on the slate has nothing to leak. The slate's live score
// line that once rode a second fetch is gone (ADR-0116).
import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeGame } from '../src/api/schedule.js'

// A raw schedule row LADEN with every score-bearing field the real feed can
// carry — exactly what fetchSchedule receives before normalizeGame runs.
const scoreLadenRow = {
  gamePk: 777001,
  gameDate: '2026-07-24T23:05:00Z',
  status: { statusCode: 'I', abstractGameState: 'Live' },
  teams: {
    away: {
      team: { id: 158, name: 'Milwaukee Brewers', teamName: 'Brewers' },
      score: 4,
      isWinner: false,
      leagueRecord: { wins: 60, losses: 40 },
    },
    home: {
      team: { id: 109, name: 'Arizona Diamondbacks', teamName: 'D-backs' },
      score: 2,
      isWinner: true,
      leagueRecord: { wins: 50, losses: 50 },
    },
  },
  linescore: {
    currentInning: 7,
    inningState: 'Bottom',
    teams: { away: { runs: 4, hits: 8, errors: 0 }, home: { runs: 2, hits: 5, errors: 1 } },
  },
}

// --------------------------------------------------------------------------
// 1. The default slate model is score-free — the spoiler invariant
// --------------------------------------------------------------------------
test('normalizeGame copies no score-bearing field into the slate model', () => {
  const model = normalizeGame(scoreLadenRow, 1)
  const forbidden = /score|isWinner|runs|hits|errors|linescore|leagueRecord|inningState|currentInning/i
  const scan = (obj, path = '') => {
    for (const [k, v] of Object.entries(obj)) {
      assert.ok(!forbidden.test(k), `slate model leaks a score field at ${path}${k}`)
      if (v && typeof v === 'object') scan(v, `${path}${k}.`)
    }
  }
  scan(model)
  // The coarse, spoiler-free state DOES survive — the score line's Live/Final
  // branch keys off it, so its presence is intentional and asserted.
  assert.equal(model.abstractState, 'Live')
})

// Test 7 of #1227 (build prompt trap 1). On a postseason game, `seriesStatus`
// and `teams.{side}.leagueRecord` give the state AFTER that game: the
// 2025-10-04 NLDS Game 1 row reads "MIL leads 1-0" and a 1-0 leagueRecord,
// and on today's game both change the moment it ends. The slate model must
// carry neither, even handed a row that has them. The bracket reads the state
// heading in from src/api/postseason/ instead.
test('normalizeGame carries no seriesStatus or leagueRecord from a postseason row', () => {
  const postseasonRow = {
    ...scoreLadenRow,
    gamePk: 813047,
    gameType: 'D',
    officialDate: '2025-10-04',
    status: { statusCode: 'F', abstractGameState: 'Final' },
    seriesStatus: {
      gameNumber: 1,
      totalGames: 5,
      isTied: false,
      isOver: false,
      wins: 1,
      losses: 0,
      winningTeam: { id: 158 },
      losingTeam: { id: 112 },
      description: 'NLDS Game 1',
      shortDescription: 'NLDS',
      result: 'MIL leads 1-0',
      shortName: 'NLDS',
    },
    teams: {
      away: { ...scoreLadenRow.teams.away, leagueRecord: { wins: 0, losses: 1, pct: '.000' } },
      home: { ...scoreLadenRow.teams.home, leagueRecord: { wins: 1, losses: 0, pct: '1.000' } },
    },
  }
  const model = normalizeGame(postseasonRow, 1)
  const text = JSON.stringify(model)
  assert.ok(!/seriesStatus|leagueRecord|leads|isOver|isTied|winningTeam|losingTeam/.test(text), text)
  for (const side of ['away', 'home']) assert.deepEqual(Object.keys(model[side]).sort(), ['abbreviation', 'id', 'name', 'teamName'])
})
