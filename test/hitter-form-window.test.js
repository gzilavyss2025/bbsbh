import assert from 'node:assert/strict'
import test from 'node:test'
import { rollingSeries } from '../src/api/hitterForm.js'
import { situationalSplitsView } from '../src/api/person.js'

// Rolling windows are built from the game log's own rows, which carry the date,
// so October games count and the newest game is last.

const game = (date, gameType, { ab = 4, h = 1, pa = 4, hr = 0, gamePk = 1, n = 1 } = {}) => ({
  date,
  gameType,
  game: { gamePk, gameNumber: n },
  stat: {
    gamesPlayed: 1, atBats: ab, hits: h, plateAppearances: pa, homeRuns: hr, strikeOuts: 1,
    baseOnBalls: pa - ab, hitByPitch: 0, sacFlies: 0, totalBases: h + hr * 3, doubles: 0, rbi: 0, runs: 0, stolenBases: 0,
  },
})

test('postseason situational splits keep a small sample that the regular table would drop', () => {
  const s = (code, pa) => ({ split: { code }, stat: { plateAppearances: pa, atBats: pa, hits: 1, totalBases: 1 } })
  const rows = [s('r0', 12), s('ron', 9)]
  assert.equal(situationalSplitsView(rows, 'hitting'), null)
  const view = situationalSplitsView(rows, 'hitting', { minRows: 1 })
  assert.equal(view.rows.length, 2)
  assert.equal(view.rows[0].side.count, 12)
})

// rollingSeries: one point per game from game w on, each the OPS of the w games ending there.
// A game with no plate appearance is not a game; a doubleheader runs by game number.

const opp = { id: 112, name: 'Chicago Cubs' }
const withOpp = (g, isHome = true) => ({ ...g, opponent: opp, isHome })
// n games on consecutive days, hitting `h` hits in 4 AB each.
const run = (hits, start = 1) =>
  hits.map((h, i) => withOpp(game(`2026-05-${String(start + i).padStart(2, '0')}`, 'R', { gamePk: 500 + start + i, h })))

test('rollingSeries gives one point per game from game w on, with date, opponent and venue', () => {
  const { points } = rollingSeries(run([1, 1, 1, 2, 2]), 3)
  assert.equal(points.length, 3)
  assert.deepEqual(points[0], { date: '2026-05-03', gamePk: 503, opp: 'CHC', isHome: true, ops: 0.5 })
  // Games 3-5: 5 H in 12 AB, no walks, 5 TB.
  assert.equal(points[2].ops, 0.834)
})

test('rollingSeries is null with fewer than w games', () => {
  assert.equal(rollingSeries(run([1, 1]), 3), null)
})

test('a game with no plate appearance is not counted', () => {
  const log = run([1, 1, 1])
  log.splice(1, 0, withOpp(game('2026-05-01', 'R', { gamePk: 1, ab: 0, h: 0, pa: 0 })))
  assert.equal(rollingSeries(log, 3).points.length, 1)
  assert.equal(rollingSeries(log, 4), null)
})

test('doubleheader games run by game number, whatever the log order', () => {
  const g1 = withOpp(game('2026-05-02', 'R', { gamePk: 9, n: 1, h: 0 }))
  const g2 = withOpp(game('2026-05-02', 'R', { gamePk: 8, n: 2, h: 4 }))
  const log = [g2, g1, ...run([1], 3)]
  const { points } = rollingSeries(log, 2)
  assert.deepEqual(points.map((p) => p.gamePk), [8, 503])
})

test('best and worst stretch name their first and last day', () => {
  const { best, worst } = rollingSeries(run([0, 0, 4, 4, 1, 0, 0]), 2)
  assert.equal(best.startDate, '2026-05-03')
  assert.equal(best.endDate, '2026-05-04')
  assert.equal(best.ops, 2)
  assert.equal(worst.startDate, '2026-05-01')
  assert.equal(worst.endDate, '2026-05-02')
  assert.equal(worst.ops, 0)
})
