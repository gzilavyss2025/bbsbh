// Club Stretch (/club-stretch): a club's best 162 and 154 games in a row, one row per player.
import assert from 'node:assert/strict'
import test from 'node:test'
import { toGame } from '../src/api/streaks/bestStretch.js'
import { clubBoards, playerBest, stintsFor } from '../scripts/lib/franchise/club-stretch.mjs'
import { measureByKey } from '../src/api/streaks/bestStretch.js'

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

test('boards: one row per player, best first, top ten', () => {
  const players = Array.from({ length: 12 }, (_, p) => ({ id: p + 1, name: `P${p + 1}`, games: run(0, 170, 158, { homeRuns: p % 3 === 0 ? 1 : 0, hits: 1 }) }))
  const b = clubBoards(players, 158)
  assert.equal(b[162].hr.length, 10)
  assert.equal(new Set(b[162].hr.map((r) => r.id)).size, 10)
  assert.equal(b[162].hr[0].value, '162')
  assert.equal(b[162].hr[0].team, 'Club 158')
  assert.ok(b[154].avg[0].value.startsWith('.'))
})

// Season lines built from the same games, so a ceiling can be checked against the real run.
import { bestFirst, ceilingFor, playerRows } from '../scripts/lib/franchise/club-stretch.mjs'
const seasonsOf = (games) => {
  const by = new Map()
  for (const g of games) {
    const y = Number(g.date.slice(0, 4))
    const s = by.get(y) ?? { season: y, gamesPlayed: 0, homeRuns: 0, hits: 0, rbi: 0, stolenBases: 0, atBats: 0, baseOnBalls: 0, hitByPitch: 0, sacFlies: 0, sacBunts: 0, totalBases: 0 }
    s.gamesPlayed++
    for (const k of ['homeRuns', 'hits', 'rbi', 'stolenBases', 'atBats', 'baseOnBalls', 'hitByPitch', 'sacFlies', 'totalBases']) s[k] += g[k]
    by.set(y, s)
  }
  return [...by.values()]
}

test('a ceiling is never under the real best run, in every stat', () => {
  // 600 days from April 1950: three seasons' worth, with a hot streak across a year end.
  const games = Array.from({ length: 600 }, (_, i) => game(i, 158, i > 200 && i < 320
    ? { atBats: 4, plateAppearances: 4, hits: 2, homeRuns: 1, rbi: 2, stolenBases: 1, totalBases: 5 }
    : { atBats: 4, plateAppearances: 4, hits: 1, totalBases: 1 }))
  const real = playerRows({ id: 1, name: 'P', games }, 158)
  for (const n of [162, 154]) {
    for (const key of ['hr', 'h', 'rbi', 'sb', 'avg', 'ops']) {
      const r = real[`${n}:${key}`]
      assert.ok(ceilingFor(seasonsOf(games), n, key) >= r.raw - 1e-12, `${n} ${key}`)
    }
  }
})

test('no span long enough is no ceiling', () => {
  assert.equal(ceilingFor([{ season: 1950, gamesPlayed: 100, homeRuns: 9, hits: 0, rbi: 0, stolenBases: 0, atBats: 0, baseOnBalls: 0, hitByPitch: 0, sacFlies: 0, sacBunts: 0, totalBases: 0 }], 154, 'hr'), null)
})

test('best-first fetches only while a ceiling can still beat tenth place', async () => {
  const fetched = []
  const cands = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, ceiling: 100 - i }))
  // Each real value is its ceiling less 5: once ten are in, tenth place is 86 (id 10's 91 - 5).
  const rows = await bestFirst(cands, async (id) => {
    fetched.push(id)
    return { id, raw: 100 - (id - 1) - 5, first: '1950-04-01' }
  })
  assert.equal(rows.length, 10)
  assert.equal(rows[0].id, 1)
  assert.equal(fetched.length, 15) // ids 11..15 have ceilings 90..86, not under 86
})
