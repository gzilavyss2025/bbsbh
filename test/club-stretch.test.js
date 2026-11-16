// Club Stretch (/club-stretch): a club's best 162 and 154 games in a row, one row per player.
import assert from 'node:assert/strict'
import test from 'node:test'
import { toGame } from '../src/api/streaks/bestStretch.js'
import { cacheLine, playerRows, rankBoards, readCache } from '../scripts/lib/franchise/club-stretch.mjs'
import { measureByKey, playerBest, stintsFor } from '../src/api/streaks/bestStretch.js'

const d0 = Date.UTC(1950, 3, 1)
const day = (i) => new Date(d0 + i * 86400000).toISOString().slice(0, 10)
const game = (i, teamId, s = {}) => toGame({ date: day(i), game: { gameNumber: 1 }, team: { id: teamId, name: `Club ${teamId}` }, stat: { atBats: 4, plateAppearances: 4, ...s } })
const run = (from, len, teamId, s) => Array.from({ length: len }, (_, k) => game(from + k, teamId, s))

test('a game for another club ends the stint; a return starts a new one', () => {
  const games = [...run(0, 3, 158), game(3, 147), ...run(4, 2, 158)]
  assert.deepEqual(stintsFor(games, 158).map((s) => s.length), [3, 2])
})

test('a run never joins two stints, even when together they are long enough', () => {
  const games = [...run(0, 100, 158, { homeRuns: 1 }), game(100, 147), ...run(101, 100, 158, { homeRuns: 1 })]
  assert.equal(playerBest(games, 158, 154, measureByKey('hr')), null)
})

test('a run crosses seasons inside one stint', () => {
  const b = playerBest(run(200, 200, 158, { homeRuns: 1 }), 158, 162, measureByKey('hr'))
  assert.equal(b.homeRuns, 162)
  assert.notEqual(b.first.slice(0, 4), b.last.slice(0, 4))
})

test('AVG needs 3.1 PA per game; counting stats do not', () => {
  const thin = run(0, 162, 158, { atBats: 3, plateAppearances: 3, hits: 2, homeRuns: 1 })
  assert.equal(playerBest(thin, 158, 162, measureByKey('avg')), null)
  assert.equal(playerBest(thin, 158, 162, measureByKey('hr')).homeRuns, 162)
})

test('an old log with no PA rebuilds it from AB, BB, HBP and SF', () => {
  const old = run(0, 162, 158, { atBats: 4, plateAppearances: 0, hits: 1 })
  assert.equal(playerBest(old, 158, 162, measureByKey('avg')).value, 0.25)
})

test('boards: one row per player, best first, top twenty', () => {
  const players = Array.from({ length: 22 }, (_, p) => ({ id: p + 1, name: `P${p + 1}`, games: run(0, 170, 158, { homeRuns: p % 3 === 0 ? 1 : 0, hits: 1 }) }))
  const b = rankBoards(players.map((p) => playerRows(p, 158)))
  assert.equal(b[162].hr.length, 20)
  assert.equal(new Set(b[162].hr.map((r) => r.id)).size, 20)
  assert.equal(b[162].hr[0].value, '162')
  assert.equal(b[162].hr[0].team, 'Club 158')
  assert.ok(b[154].avg[0].value.startsWith('.'))
})

test('the cache ignores lines from a run with another --through', () => {
  const text = cacheLine(2026, 1, { 158: { x: 1 } }) + cacheLine(2027, 2, { 158: { x: 2 } })
  const rows = readCache(text, 2027)
  assert.equal(rows.has(1), false)
  assert.deepEqual(rows.get(2), { 158: { x: 2 } })
})

test('the cache ignores lines from the other --group', () => {
  const text = cacheLine(2026, 1, { 158: { x: 1 } }) + cacheLine(2026, 2, { 158: { x: 2 } }, 'pitching')
  assert.deepEqual([...readCache(text, 2026, 'pitching').keys()], [2])
  assert.deepEqual([...readCache(text, 2026).keys()], [1])
})

// Pitching: 32 starts or 65 relief outings in a row, no innings floor, lower ERA and WHIP win.
const outing = (i, teamId, s = {}) => toGame({ date: day(i), game: { gameNumber: 1 }, team: { id: teamId, name: `Club ${teamId}` }, stat: { outs: 18, ...s } }, 'pitching')

test('pitching: the lowest ERA ranks first, and relief outings do not join a run of starts', () => {
  const ace = { id: 1, name: 'Ace', games: Array.from({ length: 40 }, (_, k) => outing(k, 158, { gamesStarted: 1, earnedRuns: 1 })) }
  const meh = { id: 2, name: 'Meh', games: Array.from({ length: 40 }, (_, k) => outing(k, 158, { gamesStarted: 1, earnedRuns: 3 })) }
  const b = rankBoards([meh, ace].map((p) => playerRows(p, 158, 'pitching')), 'pitching')
  assert.deepEqual(b[32].era.map((r) => r.id), [1, 2])
  assert.equal(b[32].era[0].value, '1.50')
  assert.equal(b[65].era.length, 0)
})

test('pitching: a start between relief outings is set aside, not a break', () => {
  const games = [...Array.from({ length: 40 }, (_, k) => outing(k, 158, { outs: 3 })), outing(40, 158, { gamesStarted: 1 }), ...Array.from({ length: 30 }, (_, k) => outing(41 + k, 158, { outs: 3, strikeOuts: 1 }))]
  const rows = playerRows({ id: 3, name: 'Pen', games }, 158, 'pitching')
  assert.equal(rows['65:k'].value, '30')
  assert.equal(rows['32:k'], undefined)
})

test('pitching: a run with no outs ranks last on ERA', () => {
  const ok = playerRows({ id: 4, name: 'Ok', games: Array.from({ length: 65 }, (_, k) => outing(k, 158, { outs: 3, earnedRuns: 2 })) }, 158, 'pitching')
  const none = playerRows({ id: 5, name: 'None', games: Array.from({ length: 65 }, (_, k) => outing(k, 158, { outs: 0, earnedRuns: 1 })) }, 158, 'pitching')
  const b = rankBoards([none, ok], 'pitching')
  assert.deepEqual(b[65].era.map((r) => r.id), [4, 5])
  assert.equal(b[65].era[1].value, '—')
})
