import assert from 'node:assert/strict'
import test from 'node:test'
import { hofPaceView } from '../src/api/person/hof/pace.js'

// Hitter lines are [h, hr] cumulative from age `first`.
const hof = (id, first, rows, pitcher = false) => ({ id, name: `HOF${id}`, pitcher, first, rows })
const players = [
  hof(1, 20, [[10, 5], [20, 15], [30, 30]]), // HR at 22: 30
  hof(2, 20, [[10, 2], [20, 10], [30, 20]]), // 20
  hof(3, 20, [[10, 1], [20, 5], [30, 8]]), // 8
  hof(4, 25, [[10, 40]]), // not debuted by 22
]
const season = (season, age, hr, extra = {}) => ({ season: String(season), stat: { age, homeRuns: hr, hits: hr * 5, gamesPlayed: 100, ...extra } })
const base = [season(2020, 20, 5), season(2021, 21, 10), season(2022, 22, 4)] // 19 HR through 22

test('nearest one above and one below, others by gap; later debuts skipped', () => {
  const v = hofPaceView({ players, splits: base, group: 'hitting', stat: 'hr' })
  assert.equal(v.age, 22)
  assert.equal(v.value, 19)
  assert.deepEqual(v.comps.map((c) => [c.id, c.value]), [[1, 30], [2, 20], [3, 8]])
})

test('a traded season counts once (stints summed, team-less roll-up dropped)', () => {
  const traded = [
    ...base.slice(0, 2),
    { season: '2022', team: { id: 1 }, stat: { age: 22, homeRuns: 1, atBats: 90, gamesPlayed: 50 } },
    { season: '2022', team: { id: 2 }, stat: { age: 22, homeRuns: 3, atBats: 110, gamesPlayed: 50 } },
    { season: '2022', numTeams: 2, stat: { age: 22, homeRuns: 4, atBats: 200, gamesPlayed: 100 } },
  ]
  assert.equal(hofPaceView({ players, splits: traded, group: 'hitting', stat: 'hr' }).value, 19)
})

test('age gap respected: a retired player is read at his last age', () => {
  const v = hofPaceView({ players, splits: base.slice(0, 2), group: 'hitting', stat: 'hr' })
  assert.equal(v.age, 21)
  assert.equal(v.value, 15)
  assert.deepEqual(v.comps.map((c) => c.value), [15, 10, 5]) // HOF at 21, not at 22
})

test('under a cutoff the date-cut current-season stat replaces the live row', () => {
  const v = hofPaceView({ players, splits: base, group: 'hitting', stat: 'hr', cutoff: { season: 2022, stat: { homeRuns: 1 } } })
  assert.equal(v.value, 16)
  assert.equal(v.age, 22)
  assert.equal(hofPaceView({ players, splits: base, group: 'hitting', stat: 'hr', cutoff: { season: 2022, stat: null } }).age, 21)
})

test('no card: fewer than two seasons, or a late start', () => {
  assert.equal(hofPaceView({ players, splits: base.slice(0, 1), group: 'hitting', stat: 'hr' }), null)
  const late = [season(2020, 31, 5), season(2021, 32, 5)]
  assert.equal(hofPaceView({ players, splits: late, group: 'hitting', stat: 'hr' }), null)
})

test('pitchers use outs and pitcher comps only', () => {
  const pp = [hof(9, 20, [[1, 10, 30, 0], [3, 40, 90, 0]], true), ...players]
  const sp = [season(2020, 20, 0, { wins: 1, inningsPitched: '10.1' }), season(2021, 21, 0, { wins: 2, inningsPitched: '20.0' })]
  const v = hofPaceView({ players: pp, splits: sp, group: 'pitching', stat: 'outs' })
  assert.equal(v.value, 91)
  assert.deepEqual(v.comps.map((c) => c.id), [9])
})
