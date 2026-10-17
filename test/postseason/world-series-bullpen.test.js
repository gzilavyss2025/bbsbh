import assert from 'node:assert/strict'
import test from 'node:test'
import { bullpenGrid } from '../../src/lib/postseason/worldseries/bullpen.js'

const CLUB = 119
// A box score for CLUB: pitchers[0] starts. `outs`: [id, pitches] pairs.
const box = (gamePk, date, side, pitches) => ({
  gamePk,
  date,
  boxscore: {
    teams: {
      [side]: { team: { id: CLUB }, pitchers: pitches.map(([id]) => id) },
      [side === 'home' ? 'away' : 'home']: { team: { id: 999 }, pitchers: [] },
    },
    players: Object.fromEntries(pitches.map(([id, n]) => [`ID${id}`, { person: { fullName: `P${id}` }, stats: { pitching: { numberOfPitches: n } } }])),
  },
})
const SLATE = '2026-10-27'

test('cutoff: a box score dated on the slate date is never in the grid', () => {
  const games = [box(1, '2026-10-24', 'home', [[1, 90], [10, 20]]), box(3, SLATE, 'away', [[1, 90], [10, 55], [11, 40]])]
  const g = bullpenGrid(games, CLUB, { slateDate: SLATE })
  assert.deepEqual(g.games.map((x) => x.gamePk), [1])
  assert.ok(!g.rows.some((r) => r.id === 11), 'a pitcher who only appeared on the slate date')
  assert.deepEqual(g.rows.find((r) => r.id === 10).cells, [20])
})

test('starters are excluded; a pitcher with no outing in a game gets an empty cell', () => {
  const games = [box(1, '2026-10-24', 'home', [[1, 90], [10, 20]]), box(2, '2026-10-25', 'away', [[2, 80], [11, 30]])]
  const g = bullpenGrid(games, CLUB, { slateDate: SLATE })
  assert.ok(!g.rows.some((r) => r.id === 1 || r.id === 2))
  assert.deepEqual(g.rows.find((r) => r.id === 10).cells, [20, null])
  assert.deepEqual(g.rows.find((r) => r.id === 11).cells, [null, 30])
})

test('a starter in one game who relieves in another counts only the relief outing', () => {
  const games = [box(1, '2026-10-24', 'home', [[1, 90]]), box(2, '2026-10-25', 'home', [[2, 80], [1, 12]])]
  const g = bullpenGrid(games, CLUB, { slateDate: SLATE })
  assert.deepEqual(g.rows.find((r) => r.id === 1).cells, [null, 12])
})

test('top N by total, ties by name; at most 6 games, the latest six, oldest first', () => {
  const ids = [10, 11, 12, 13]
  const games = Array.from({ length: 8 }, (_, i) =>
    box(i + 1, `2026-10-${String(10 + i).padStart(2, '0')}`, 'home', [[1, 90], ...ids.map((id) => [id, id === 13 ? 1 : (id - 9) * 5])]),
  )
  const g = bullpenGrid(games, CLUB, { slateDate: SLATE })
  assert.equal(g.games.length, 6)
  assert.deepEqual(g.games.map((x) => x.gamePk), [3, 4, 5, 6, 7, 8])
  assert.deepEqual(g.rows.map((r) => r.id), [12, 11, 10])
  assert.equal(g.rows[0].total, 90)
  assert.equal(bullpenGrid(games, CLUB, { slateDate: SLATE, relievers: 4 }).rows.length, 4)
})

test('a game the club did not play (no matching side) is skipped', () => {
  const g = bullpenGrid([box(1, '2026-10-24', 'home', [[1, 90], [10, 20]])], 777, { slateDate: SLATE })
  assert.deepEqual(g.games, [])
  assert.deepEqual(g.rows, [])
})
