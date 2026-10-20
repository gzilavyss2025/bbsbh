import test from 'node:test'
import assert from 'node:assert/strict'
import { umpireCareer } from '../src/lib/umpire/career.js'

// The umpire page's career chart and "record with this umpire" line (#1565): two
// stores joined into one span. Store 1 is umpire-history (2000-2022), store 2 is
// the umpires/ game rows (2023 on, with AAA rows and the All-Star Game in them).

const hist = (season, HP, other = 0) => ({ season, games: HP + other, byRole: { HP, '1B': other } })
const row = (date, role, { away = 158, home = 112, as = 3, hs = 2, level = 'MLB', gameType = 'R' } = {}) => ({
  date, role, level, gameType, awayId: away, homeId: home, awayScore: as, homeScore: hs,
})
const base = { name: 'Al Plate', clubName: 'Brewers', teamId: 158 }

test('both stores: one span, gaps filled with zero, record summed', () => {
  const c = umpireCareer({
    ...base,
    history: [hist(2021, 100), hist(2022, 90, 30)],
    record: { wins: 40, losses: 50 },
    rows: [row('2024-04-02', 'HP'), row('2024-04-03', 'HP', { as: 1, hs: 5 })],
  })
  assert.deepEqual(c.seasons.map((s) => [s.season, s.plate]), [[2021, 100], [2022, 90], [2023, 0], [2024, 2]])
  assert.equal(c.seasons[0].share, 1)
  assert.equal(c.seasons[2].share, 0)
  assert.deepEqual([c.record.wins, c.record.losses], [41, 51])
  assert.equal(c.caption, 'Brewers with Al Plate behind the plate, 2021-2024')
})

test('store 1 only', () => {
  const c = umpireCareer({ ...base, history: [hist(2000, 10), hist(2001, 20)], record: { wins: 3, losses: 4 }, rows: [] })
  assert.deepEqual(c.seasons.map((s) => s.season), [2000, 2001])
  assert.deepEqual([c.record.wins, c.record.losses], [3, 4])
  assert.equal(c.caption, 'Brewers with Al Plate behind the plate, 2000-2001')
})

test('store 2 only: starts in 2023, no history row', () => {
  const c = umpireCareer({ ...base, history: [], record: null, rows: [row('2023-05-01', 'HP'), row('2025-05-01', 'HP')] })
  assert.deepEqual(c.seasons.map((s) => s.season), [2023, 2024, 2025])
  assert.deepEqual([c.record.wins, c.record.losses], [2, 0])
})

test('AAA rows and the All-Star Game are left out, a base row counts for no plate game', () => {
  const c = umpireCareer({
    ...base,
    history: [],
    record: null,
    rows: [
      row('2023-05-01', 'HP', { level: 'AAA' }),
      row('2023-07-11', 'HP', { gameType: 'A' }),
      row('2023-05-02', '1B'),
      row('2024-05-02', 'HP'),
    ],
  })
  // 2023 holds only a base game: the span still starts there, with no plate game.
  assert.deepEqual(c.seasons.map((s) => [s.season, s.plate]), [[2023, 0], [2024, 1]])
  assert.deepEqual([c.record.wins, c.record.losses], [1, 0])
})

test('a tie is a game worked and in no record; the club on either side counts', () => {
  const c = umpireCareer({
    ...base,
    history: [],
    record: null,
    rows: [
      row('2024-05-01', 'HP', { as: 2, hs: 2 }),
      row('2024-05-02', 'HP', { away: 112, home: 158, as: 4, hs: 1 }), // lost at home
      row('2024-05-03', 'HP', { away: 111, home: 112 }), // not this club
    ],
  })
  assert.equal(c.seasons[0].plate, 3)
  assert.deepEqual([c.record.wins, c.record.losses], [0, 1])
})

test('a club with 0 decided games: no record', () => {
  const c = umpireCareer({ ...base, history: [hist(2000, 10)], record: null, rows: [row('2024-05-01', 'HP', { as: 1, hs: 1 })] })
  assert.equal(c.record, null)
  assert.ok(c.seasons.length > 0)
})

test('a club with one game', () => {
  const c = umpireCareer({ ...base, history: [], record: null, rows: [row('2024-05-01', 'HP', { as: 0, hs: 1 })] })
  assert.deepEqual([c.record.wins, c.record.losses], [0, 1])
  assert.equal(c.record.winShare, 0)
  assert.equal(c.caption, 'Brewers with Al Plate behind the plate, 2024')
})

test('no data at all', () => {
  const c = umpireCareer({ ...base, history: [], record: null, rows: [] })
  assert.deepEqual(c.seasons, [])
  assert.equal(c.record, null)
  assert.equal(c.caption, '')
})
