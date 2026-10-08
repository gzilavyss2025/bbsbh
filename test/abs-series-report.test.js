// The ABS challenge report card on the postseason series page (#1769).
//
// Two halves, each pinned here:
//   1. the generator's pure export, scripts/lib/abs/postgames.mjs — one entry a
//      postseason game, each player's challenges SUMMED OVER ROLES;
//   2. the reader, src/api/around-the-game/absSeries.js — cuts that file to one
//      series and the page's cutoff, and sorts it.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPostGamesExport } from '../scripts/lib/abs/index.mjs'
import { seriesAbsRows, fmtWinPct } from '../src/api/around-the-game/absSeries.js'

const row = (over) => ({
  game_pk: 1, seq: 0, season: 2026, date: '2026-10-03', level: 'MLB', team_id: 158, opp_id: 135,
  side: 'away', player_id: 11, player_name: 'A Hitter', role: 'batter', outcome: 'success', ...over,
})
const game = (over) => ({
  game_pk: 1, date: '2026-10-03', season: 2026, level: 'MLB', away_team_id: 158, home_team_id: 135, scope: 'P', ...over,
})

// ---- generator ----------------------------------------------------------

test('export: one player in two roles is ONE entry with the roles added', () => {
  const rows = [
    row({ seq: 0, role: 'batter', outcome: 'success' }),
    row({ seq: 1, role: 'catcher', outcome: 'fail' }),
    row({ seq: 2, role: 'catcher', outcome: 'success' }),
  ]
  const out = buildPostGamesExport(rows, [game()], { season: 2026 })
  assert.equal(out.games.length, 1)
  assert.deepEqual(out.games[0].players, [{ playerId: 11, name: 'A Hitter', teamId: 158, n: 3, success: 2 }])
  assert.deepEqual(
    { gamePk: out.games[0].gamePk, date: out.games[0].date, away: out.games[0].away, home: out.games[0].home },
    { gamePk: 1, date: '2026-10-03', away: 158, home: 135 },
  )
})

test('export: postseason games only, and only the asked season', () => {
  const rows = [row({ game_pk: 1 }), row({ game_pk: 2 }), row({ game_pk: 3, season: 2025 })]
  const games = [game({ game_pk: 1 }), game({ game_pk: 2, scope: 'R' }), game({ game_pk: 3, season: 2025 })]
  const out = buildPostGamesExport(rows, games, { season: 2026 })
  assert.deepEqual(out.games.map((g) => g.gamePk), [1])
})

test('export: a game nobody challenged in, and a row with no player id, leave no entry', () => {
  const rows = [row({ game_pk: 1, player_id: null })]
  const out = buildPostGamesExport(rows, [game({ game_pk: 1 }), game({ game_pk: 2 })], { season: 2026 })
  assert.deepEqual(out.games, [])
})

test('export: players of both clubs share a game entry, sorted by id', () => {
  const rows = [
    row({ seq: 0, player_id: 30, team_id: 135, side: 'home' }),
    row({ seq: 1, player_id: 20, team_id: 158, outcome: 'fail' }),
  ]
  const [g] = buildPostGamesExport(rows, [game()], { season: 2026 }).games
  assert.deepEqual(g.players.map((p) => [p.playerId, p.teamId, p.n, p.success]), [[20, 158, 1, 0], [30, 135, 1, 1]])
})

// ---- reader -------------------------------------------------------------

const p = (playerId, name, teamId, n, success) => ({ playerId, name, teamId, n, success })
const file = {
  games: [
    { gamePk: 1, date: '2026-10-03', away: 158, home: 135, players: [p(1, 'Ann', 158, 2, 1), p(2, 'Bob', 135, 1, 1)] },
    { gamePk: 2, date: '2026-10-04', away: 158, home: 135, players: [p(1, 'Ann', 158, 2, 2), p(9, 'Zed', 135, 3, 0)] },
    { gamePk: 3, date: '2026-10-05', away: 158, home: 135, players: [p(2, 'Bob', 135, 4, 0)] },
    { gamePk: 7, date: '2026-10-01', away: 158, home: 143, players: [p(5, 'Cy', 158, 9, 9)] },
  ],
}
const ask = (over) => seriesAbsRows(file, { gamePks: [1, 2, 3], clubIds: [158, 135], cutoff: '2026-10-06', ...over })

test('reader: sums a player across games and gives wins, losses and rate', () => {
  const ann = ask().find((r) => r.playerId === 1)
  assert.deepEqual(ann, { playerId: 1, name: 'Ann', teamId: 158, wins: 3, losses: 1, n: 4, rate: 0.75 })
})

test('reader: only the series games count, so an earlier series cannot leak in', () => {
  assert.equal(ask().some((r) => r.playerId === 5), false)
})

test('reader: a game on or after the cutoff day does not count', () => {
  const rows = ask({ cutoff: '2026-10-05' })
  assert.equal(rows.find((r) => r.playerId === 2).n, 1) // game 3, on the cutoff day, is out
  assert.equal(ask({ cutoff: '2026-10-03' }).length, 0)
})

test('reader: a player of a club outside the series is dropped', () => {
  assert.equal(ask({ clubIds: [158, 144] }).some((r) => r.teamId === 135), false)
})

test('reader: sorts by win %, then more challenges, then name', () => {
  const f = {
    games: [{ gamePk: 1, date: '2026-10-03', away: 158, home: 135, players: [
      p(1, 'Zoe', 158, 1, 1), p(2, 'Amy', 158, 2, 2), p(3, 'Bea', 158, 2, 2),
      p(4, 'Cal', 158, 4, 2), p(5, 'Dee', 158, 2, 0),
    ] }],
  }
  const names = seriesAbsRows(f, { gamePks: [1], clubIds: [158, 135], cutoff: '2026-10-09' }).map((r) => r.name)
  assert.deepEqual(names, ['Amy', 'Bea', 'Zoe', 'Cal', 'Dee'])
})

test('reader: no floor, a lone 1-for-1 player is listed', () => {
  assert.equal(ask().find((r) => r.playerId === 2) != null, true)
})

test('reader: no file, no games and no matches all give an empty list', () => {
  assert.deepEqual(seriesAbsRows(null, { gamePks: [1], clubIds: [158, 135], cutoff: '2026-10-06' }), [])
  assert.deepEqual(ask({ gamePks: [] }), [])
  assert.deepEqual(ask({ gamePks: [999] }), [])
})

test('fmtWinPct prints baseball style', () => {
  assert.equal(fmtWinPct(0.75), '.750')
  assert.equal(fmtWinPct(1), '1.000')
  assert.equal(fmtWinPct(0), '.000')
  assert.equal(fmtWinPct(2 / 3), '.667')
})
