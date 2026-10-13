import assert from 'node:assert/strict'
import test from 'node:test'
import { hitterFormWindows, rollingSeries } from '../src/api/hitterForm.js'
import { situationalSplitsView } from '../src/api/person.js'

// The Recent form card's windows are built from the game log, because
// `stats=lastXGames` with a mixed game-type list answers one row per type plus
// a total that is not a last-N window (probed live 2026-10-06, Judge 2025). The
// log's own rows carry the date, so the window reads like the Game log above
// it: October games included, the newest game last.

const game = (date, gameType, { ab = 4, h = 1, pa = 4, hr = 0, gamePk = 1, n = 1 } = {}) => ({
  date,
  gameType,
  game: { gamePk, gameNumber: n },
  stat: {
    gamesPlayed: 1, atBats: ab, hits: h, plateAppearances: pa, homeRuns: hr, strikeOuts: 1,
    baseOnBalls: pa - ab, hitByPitch: 0, sacFlies: 0, totalBases: h + hr * 3, doubles: 0, rbi: 0, runs: 0, stolenBases: 0,
  },
})

const september = Array.from({ length: 30 }, (_, i) =>
  game(`2026-09-${String(i + 1).padStart(2, '0')}`, 'R', { gamePk: 100 + i }),
)
const october = [game('2026-10-01', 'F', { gamePk: 200, h: 4, hr: 1 }), game('2026-10-03', 'D', { gamePk: 201, h: 3 })]

test('a window in October takes the last N games across both parts of the year', () => {
  const w = hitterFormWindows([...september, ...october])
  assert.equal(w.last7.gamesPlayed, 7)
  // 5 September games + 2 October games, 4 PA each.
  assert.equal(w.last7.plateAppearances, 28)
  assert.equal(w.last7.hits, 5 + 4 + 3)
  assert.equal(w.last30.gamesPlayed, 30)
})

test('the log order does not matter: the newest game decides the window', () => {
  const shuffled = [...october, ...september].reverse()
  const w = hitterFormWindows(shuffled)
  assert.equal(w.last7.hits, 5 + 4 + 3)
})

test('a September-only log reads as it did before', () => {
  const w = hitterFormWindows(september)
  assert.equal(w.last15.gamesPlayed, 15)
  assert.equal(w.last15.hits, 15)
  assert.equal(w.last15.avg, '.250')
})

test('the second game of a doubleheader is newer than the first', () => {
  const log = [
    game('2026-09-10', 'R', { gamePk: 1, n: 1, h: 0 }),
    game('2026-09-10', 'R', { gamePk: 2, n: 2, h: 4 }),
  ]
  assert.equal(hitterFormWindows(log).last7.hits, 4)
  assert.equal(hitterFormWindows([log[1], log[0]]).last7.hits, 4)
})

test('two games with the same line are both counted', () => {
  const same = [game('2026-09-09', 'R', { gamePk: 1 }), game('2026-09-10', 'R', { gamePk: 2 })]
  assert.equal(hitterFormWindows(same).last7.gamesPlayed, 2)
})

test('a short log leaves a short window, an empty log leaves none', () => {
  assert.equal(hitterFormWindows(october).last7.gamesPlayed, 2)
  assert.equal(hitterFormWindows([]).last7, null)
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
