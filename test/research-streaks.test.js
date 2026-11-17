// Player streaks on /research (#3142): runs of a player's consecutive games that match a
// condition. src/api/research/streaks.js.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStreakParams, isStreakBlank, parseStreakQuery, streakMatcher, streakRun } from '../src/api/research/streaks.js'

// A player-game line as games.js playerGames makes it.
let pk = 0
const line = (player, date, o = {}) => ({ key: `${++pk}`, gamePk: pk, date, gameType: 'R', home: 'MIL', away: 'CIN', gameNumber: 1, role: 'bat', player, team: 'MIL', pa: 4, h: 1, hr: 0, bb: 0, so: 0, runsOn: 0, ...o })
const pit = (player, date, o = {}) => line(player, date, { role: 'pit', bf: 25, pitches: 100, runs: 0, starter: true, ...o })

const q = (s, extra = {}) => ({ mode: 'streak', chips: {}, s: { side: 'bat', totals: {}, starts: false, ...s }, ...extra })

test('a streak is a run of matching games; a non-matching game ends it', () => {
  const run = streakRun(q({ totals: { h: [1, null] } }))
  run.feed([line(1, '2026-04-01'), line(1, '2026-04-02'), line(1, '2026-04-03'), line(1, '2026-04-04', { h: 0 }), line(1, '2026-04-05')])
  const a = run.finish({ activeFrom: null })
  assert.equal(a.top.length, 1, 'a 1-game run is no streak')
  assert.deepEqual([a.top[0].len, a.top[0].first.date, a.top[0].last.date, a.top[0].active], [3, '2026-04-01', '2026-04-03', false])
})

test('a streak carries across seasons, and games a player sat out neither extend nor break it', () => {
  const run = streakRun(q({ totals: { h: [1, null] } }))
  run.feed([line(1, '2025-09-27'), line(2, '2025-09-28', { h: 0 }), line(1, '2025-09-29')])
  run.feed([line(1, '2026-03-30')])
  const a = run.finish({ activeFrom: '2026-01-01' })
  assert.deepEqual([a.top[0].player, a.top[0].len, a.top[0].active], [1, 3, true])
})

test('a streak still running is active only when its last game is in the latest season searched', () => {
  const run = streakRun(q({ totals: { h: [1, null] } }))
  run.feed([line(1, '2024-05-01'), line(1, '2024-05-02')])
  assert.equal(run.finish({ activeFrom: '2026-01-01' }).top[0].active, false, 'a career that ended mid-streak is not active')
})

test('Starts only skips relief games: they neither extend nor break a run of starts', () => {
  const run = streakRun(q({ side: 'pit', starts: true, totals: { so: [10, null] } }))
  run.feed([pit(5, '2026-05-01', { so: 11 }), pit(5, '2026-05-03', { so: 0, starter: false }), pit(5, '2026-05-06', { so: 10 }), pit(5, '2026-05-11', { so: 3 })])
  const a = run.finish({ activeFrom: null })
  assert.deepEqual(a.top.map((s) => s.len), [2])
})

test('the side picks batting or pitching lines; a pitcher line never counts for a batter search', () => {
  const run = streakRun(q({ totals: { so: [1, null] } }))
  run.feed([pit(5, '2026-05-01', { so: 9 }), pit(5, '2026-05-06', { so: 9 })])
  assert.equal(run.finish({ activeFrom: null }).top.length, 0)
})

test('All-Star games and the postseason are out unless the Game type card picks them', () => {
  const lines = () => [line(1, '2026-07-10'), line(1, '2026-07-14', { gameType: 'A' }), line(1, '2026-07-18'), line(1, '2026-10-01', { gameType: 'F', h: 0 })]
  const reg = streakRun(q({ totals: { h: [1, null] } }))
  reg.feed(lines())
  assert.deepEqual(reg.finish({ activeFrom: null }).top.map((s) => s.len), [2], 'the All-Star game is skipped and the postseason hitless game does not break it')
  const post = streakRun(q({ totals: { h: [1, null] } }, { chips: { gt: { vals: ['R', 'P'], inv: false } } }))
  post.feed(lines())
  assert.equal(post.finish({ activeFrom: null }).top[0].active, false)
  assert.deepEqual(post.finish({ activeFrom: null }).top.map((s) => s.len), [2])
})

test('ranks longest first, ties newest first, tied lengths share a rank; player and club filters narrow', () => {
  const run = streakRun(q({ totals: { h: [1, null] } }))
  run.feed([line(1, '2026-04-01'), line(1, '2026-04-02'), line(2, '2026-05-01', { team: 'CHC' }), line(2, '2026-05-02', { team: 'CHC' }), line(3, '2026-06-01'), line(3, '2026-06-02'), line(3, '2026-06-03')])
  const a = run.finish({ activeFrom: null })
  assert.deepEqual(a.top.map((s) => [s.player, s.rank]), [[3, 1], [2, 2], [1, 2]])
  const club = streakRun(q({ totals: { h: [1, null] } }, { team: 'CHC' }))
  club.feed([line(1, '2026-04-01'), line(1, '2026-04-02'), line(2, '2026-05-01', { team: 'CHC' }), line(2, '2026-05-02', { team: 'CHC' })])
  assert.deepEqual(club.finish({ activeFrom: null }).top.map((s) => s.player), [2])
  const one = streakRun(q({ totals: { h: [1, null] } }, { batter: 1 }))
  one.feed([line(1, '2026-04-01'), line(1, '2026-04-02'), line(3, '2026-06-01'), line(3, '2026-06-02')])
  assert.deepEqual(one.finish({ activeFrom: null }).top.map((s) => s.player), [1])
})

test('the cutoff holds out that day and later', () => {
  const run = streakRun(q({ totals: { h: [1, null] } }), '2026-04-03')
  run.feed([line(1, '2026-04-01'), line(1, '2026-04-02'), line(1, '2026-04-03')])
  assert.equal(run.finish({ activeFrom: null }).top[0].len, 2)
})

test('the top list keeps 25 streaks', () => {
  const run = streakRun(q({ totals: { h: [1, null] } }))
  const lines = []
  for (let p = 1; p <= 40; p++) lines.push(line(p, '2026-04-01'), line(p, '2026-04-02'))
  run.feed(lines)
  assert.equal(run.finish({ activeFrom: null }).top.length, 25)
})

test('the streak URL round-trips', () => {
  const s = { side: 'pit', totals: { so: [10, null], runs: [null, 0] }, starts: true }
  const search = `?mode=streak&${buildStreakParams(s)}`
  assert.deepEqual(parseStreakQuery(search), s)
  assert.equal(parseStreakQuery('?mode=game'), null)
  assert.deepEqual(parseStreakQuery('?mode=streak'), { side: 'bat', totals: {}, starts: false })
})

test('a streak query is blank with no stat card', () => {
  assert.equal(isStreakBlank(q({})), true)
  assert.equal(isStreakBlank(q({ totals: { h: [null, null] } })), true)
  assert.equal(isStreakBlank(q({ totals: { h: [1, null] } })), false)
  assert.equal(streakMatcher(q({ side: 'pit', totals: { runs: [null, 0] } }))(pit(1, '2026-01-01', { runs: 0 })), true)
})
