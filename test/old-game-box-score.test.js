// An old game's box score must not print values the record does not hold
// (ADR-0101, prompt 2a-3). The three shapes are real: PHA@BOS 1927 (gamePk
// 102436, 0 plays, a boxscore that holds per-pitcher totals), DET@CWS 1979
// (177426, a forfeit with a duration of 0), and a current game with plays.
import assert from 'node:assert/strict'
import test from 'node:test'
import { selectBoxscore } from '../src/api/boxscore.js'
import { revealBoxScore } from '../src/screens/boxscore/revealBoxScore.js'

const pitching = (o) => ({ inningsPitched: '9.0', numberOfPitches: 0, battersFaced: 34, hits: 6, runs: 2, earnedRuns: 2, baseOnBalls: 2, strikeOuts: 10, ...o })

function feedWith({ plays = [], pitchStats = pitching(), teamEr = 0, gameInfo = {}, info = [] } = {}) {
  const side = (id) => ({
    team: { id, name: `Club ${id}` },
    pitchers: [id],
    players: { [`ID${id}`]: { person: { id }, stats: { pitching: pitchStats } } },
    teamStats: { pitching: { inningsPitched: '9.0', battersFaced: 34, hits: 6, runs: 2, earnedRuns: teamEr, baseOnBalls: 2, strikeOuts: 10 } },
    battingOrder: [], batters: [], info: [], note: [],
  })
  return {
    gamePk: 1,
    gameData: { players: {}, gameInfo, teams: { away: { id: 1 }, home: { id: 2 } }, venue: { timeZone: { id: 'America/New_York', tz: 'EDT' } } },
    liveData: {
      plays: { allPlays: plays },
      linescore: { innings: [{ num: 1, away: { runs: 0 }, home: { runs: 0 } }], teams: { away: {}, home: {} } },
      boxscore: { teams: { away: side(1), home: side(2) }, info },
      decisions: {},
    },
  }
}

const reveal = (feed) => revealBoxScore({ current: {} }, feed, null, null, null, null)

test('digest: a feed with 0 plays has no tally rows, even with innings on the line score', () => {
  assert.deepEqual(reveal(feedWith()).inningDigest, [])
})

test('digest: a feed with plays keeps its rows', () => {
  const play = { about: { inning: 1, halfInning: 'top' }, count: { outs: 3 }, playEvents: [], runners: [] }
  assert.equal(reveal(feedWith({ plays: [play] })).inningDigest.length, 2)
})

test('pitcher line: a 0-play feed reads the pitcher\'s own record and agrees with the totals', () => {
  const a = selectBoxscore(feedWith()).away
  const p = a.pitchers[0]
  assert.equal(p.ip, a.pitchTotals.ip)
  assert.equal(p.bf, a.pitchTotals.bf)
  assert.equal(p.so, a.pitchTotals.so)
  // The feed holds 0 pitches and an ER the team total contradicts: neither is printed.
  assert.equal(p.pitches, '—')
  assert.equal(p.er, '—')
})

test('pitcher line: a pitcher with plays is unchanged', () => {
  const play = {
    about: { inning: 1, halfInning: 'top' }, count: { outs: 3 }, result: { type: 'atBat', eventType: 'strikeout' },
    matchup: { pitcher: { id: 2 } }, playEvents: [{ isPitch: true }], runners: [],
  }
  const p = selectBoxscore(feedWith({ plays: [play], pitchStats: pitching({ numberOfPitches: 97, earnedRuns: 0 }) })).home.pitchers[0]
  assert.equal(p.pitches, 97)
  assert.equal(p.er, 0)
})

test('times: a duration of 0 or none is no duration and no game end', () => {
  const first = [{ label: 'First pitch', value: '7:00 PM.' }]
  for (const gameInfo of [{ gameDurationMinutes: 0 }, {}]) {
    const t = selectBoxscore(feedWith({ gameInfo, info: first })).times
    assert.equal(t.duration, '')
    assert.equal(t.end, '')
    assert.equal(t.firstPitch, '7:00 PM EDT')
  }
})

test('times: a real duration reads as before', () => {
  const t = selectBoxscore(feedWith({ gameInfo: { gameDurationMinutes: 126 }, info: [{ label: 'First pitch', value: '12:00 PM.' }] })).times
  assert.equal(t.duration, '2 HRS 6 MINS')
  assert.equal(t.end, '2:06 PM EDT')
})

test('times: a duration of 0 falls back to the T line, and a pitcher with null stats does not throw', () => {
  const f = feedWith({ gameInfo: { gameDurationMinutes: 0 }, info: [{ label: 'T', value: '2:30.' }] })
  assert.equal(selectBoxscore(f).times.duration, '2 HRS 30 MINS')
  f.liveData.boxscore.teams.away.players.ID1.stats.pitching = null
  assert.equal(selectBoxscore(f).away.pitchers[0].ip, '0.0')
})
