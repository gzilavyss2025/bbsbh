// A club's schedule carries its postseason games (MLB only), each row tagged with its
// game type. A caller that counts against a regular-season ledger filters on 'R' itself,
// or passes `{ regularSeasonOnly: true }`.
//
// The one rule worth pinning is ADR-0087's: an "if necessary" game drops off the
// schedule the moment a series ends. So a postseason card for a day AFTER the page's
// own game would say how the series went. Those rows are not returned. A regular-
// season row for a later day is still returned, as it always was.
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchTeamSchedule } from '../src/api/schedule.js'
import { postseasonThrough } from '../src/api/scheduleGames.js'

const side = (id, name, extra = {}) => ({ team: { id, name }, ...extra })

function row(gamePk, officialDate, gameType, { final = false, homeWon = true } = {}) {
  return {
    gamePk,
    officialDate,
    gameDate: `${officialDate}T23:05:00Z`,
    gameNumber: 1,
    gameType,
    status: { abstractGameState: final ? 'Final' : 'Preview' },
    teams: {
      away: side(111, 'Away Club', final ? { score: 2, isWinner: !homeWon } : {}),
      home: side(158, 'Milwaukee Brewers', final ? { score: 5, isWinner: homeWon } : {}),
    },
  }
}

function withSchedule(games, run) {
  const calls = []
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url))
    return { ok: true, status: 200, json: async () => ({ dates: [{ games }] }) }
  })
  return Promise.resolve()
    .then(() => run(calls))
    .finally(() => fetchMock.mock.restore())
}

test('regularSeasonOnly asks for the regular season only', () =>
  withSchedule([row(1, '2026-09-27', 'R', { final: true })], async (calls) => {
    await fetchTeamSchedule(158, 2026, 1, null, { regularSeasonOnly: true })
    assert.match(calls[0], /gameType=R&/)
  }))

test('the default asks for every round and keeps each row’s game type', () =>
  withSchedule(
    [row(1, '2026-09-27', 'R', { final: true }), row(2, '2026-10-03', 'D', { final: true })],
    async (calls) => {
      const games = await fetchTeamSchedule(158, 2026, 1, '2026-10-04')
      assert.match(calls[0], /gameType=R,F,D,L,W&/)
      assert.match(calls[0], /fields=[^&]*gameType/)
      assert.deepEqual(
        games.map((g) => [g.gamePk, g.gameType]),
        [[1, 'R'], [2, 'D']],
      )
    },
  ))

test('a minor-league club never asks for postseason rounds', () =>
  withSchedule([], async (calls) => {
    await fetchTeamSchedule(250, 2026, 11)
    assert.match(calls[0], /gameType=R&/)
  }))

test('a postseason game after the page’s own day is not drawn; a regular-season one still is', () =>
  withSchedule(
    [
      row(1, '2026-09-28', 'R', { final: true }),
      row(2, '2026-10-04', 'D', { final: true }),
      row(3, '2026-10-05', 'D'), // the day of the game the page was opened from
      row(4, '2026-10-06', 'D'), // "if necessary": its presence says the series is not over
      row(5, '2026-10-06', 'R'),
    ],
    async () => {
      // cutoff = the day before the game the link carried, so the page's day is 10-05
      const games = await fetchTeamSchedule(158, 2026, 1, '2026-10-04')
      assert.deepEqual(
        games.map((g) => g.gamePk),
        [1, 2, 3, 5],
      )
    },
  ))

test('a postseason game still on the page’s own day carries no result past the cutoff', () =>
  withSchedule([row(3, '2026-10-05', 'D', { final: true })], async () => {
    const [g] = await fetchTeamSchedule(158, 2026, 1, '2026-10-04')
    assert.equal(g.won, null)
    assert.equal(g.runs, null)
  }))

test('postseasonThrough keeps regular-season rows and rows on or before the day', () => {
  const rows = [
    { gamePk: 1, apiDate: '2026-10-09', gameType: 'R' },
    { gamePk: 2, apiDate: '2026-10-05', gameType: 'L' },
    { gamePk: 3, apiDate: '2026-10-06', gameType: 'L' },
    { gamePk: 4, apiDate: '2026-10-06' }, // an untagged row is a regular-season row
  ]
  assert.deepEqual(
    postseasonThrough(rows, '2026-10-05').map((g) => g.gamePk),
    [1, 2, 4],
  )
})
