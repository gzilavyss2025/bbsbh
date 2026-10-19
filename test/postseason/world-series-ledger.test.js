// Ledger cells (#1906, slice 2). Games are shaped like the bracket's
// worldSeries.games / .upcoming (src/api/postseason/bracket.js); runsByGame is
// foldRunsByGame's output, keyed by CLUB id.
import assert from 'node:assert/strict'
import test from 'node:test'
import { ledgerModel } from '../../src/lib/postseason/worldseries/ledger.js'

const A = 119
const B = 141
const run = (pk, a, b) => ({ [pk]: { awayId: A, homeId: B, runs: { away: a, home: b } } })

// G1 10-24, G2 10-25 (played), then a travel day, G3 10-27 (today), G4 10-28.
const games = [
  { gamePk: 1, gameNumber: 1, date: '2026-10-24', winnerId: A },
  { gamePk: 2, gameNumber: 2, date: '2026-10-25', winnerId: B },
]
const upcoming = [
  { gameNumber: 3, gamePk: 3, date: '2026-10-27', ifNecessary: false },
  { gameNumber: 4, gamePk: 4, date: '2026-10-28', ifNecessary: false },
  { gameNumber: 5, gamePk: 5, date: '2026-10-29', ifNecessary: false },
  { gameNumber: 6, gamePk: null, date: null, ifNecessary: true },
]
// Game 3 is Final already, and its runs sit in the feed: they must not leak.
const runsByGame = { ...run(1, 5, 3), ...run(2, 1, 4), ...run(3, 9, 8) }
const base = { clubIds: [A, B], games, upcoming, runsByGame, slateDate: '2026-10-27' }
const cellsOf = (m, clubId) => m.rows.find((r) => r.clubId === clubId).cells

test('cutoff: a game Final on the slate date shows no runs and no number', () => {
  const m = ledgerModel(base)
  const json = JSON.stringify(m)
  assert.ok(!json.includes('"value":9') && !json.includes('"value":8'), 'today runs leaked')
  assert.deepEqual(cellsOf(m, A)[3], { kind: 'seal', lead: true })
  assert.deepEqual(cellsOf(m, B)[3], { kind: 'seal', lead: false })
})

test('cutoff: even a bracket that counted the slate-date game keeps it sealed', () => {
  const m = ledgerModel({ ...base, games: [...games, { gamePk: 3, gameNumber: 3, date: '2026-10-27', winnerId: A }], upcoming: upcoming.slice(1) })
  assert.ok(!JSON.stringify(m).includes('"value":9'))
})

test('past games show each club\'s runs, mapped by club id', () => {
  const m = ledgerModel(base)
  assert.deepEqual(cellsOf(m, A).slice(0, 2), [{ kind: 'runs', value: 5 }, { kind: 'runs', value: 1 }])
  assert.deepEqual(cellsOf(m, B).slice(0, 2), [{ kind: 'runs', value: 3 }, { kind: 'runs', value: 4 }])
})

test('runs map by club id even when the home and away roles swap', () => {
  const swapped = { 1: { awayId: B, homeId: A, runs: { away: 2, home: 7 } } }
  const m = ledgerModel({ ...base, runsByGame: swapped })
  assert.deepEqual(cellsOf(m, A)[0], { kind: 'runs', value: 7 })
  assert.deepEqual(cellsOf(m, B)[0], { kind: 'runs', value: 2 })
})

test('a past game with no box score is empty, not 0', () => {
  const m = ledgerModel({ ...base, runsByGame: run(1, 5, 3) })
  assert.deepEqual(cellsOf(m, A)[1], { kind: 'empty' })
})

test('future games are empty and a runsByGame entry for one is ignored', () => {
  const m = ledgerModel({ ...base, runsByGame: { ...runsByGame, ...run(4, 6, 6) } })
  assert.deepEqual(cellsOf(m, A).at(-1), { kind: 'empty' })
  assert.ok(!JSON.stringify(m).includes('"value":6'))
})

test('off-day columns sit between games with a date gap, and only there', () => {
  const m = ledgerModel(base)
  assert.deepEqual(m.columns.map((c) => (c.kind === 'off' ? `off>${c.afterGame}` : `g${c.gameNumber}`)), ['g1', 'g2', 'off>2', 'g3', 'g4', 'g5', 'g6'])
})

test('if-necessary game: flagged, no date, empty, no off column before it', () => {
  const m = ledgerModel(base)
  const g6 = m.columns.at(-1)
  assert.equal(g6.ifNecessary, true)
  assert.equal(g6.date, null)
})

test('today on an off day marks the off column, and no game column is today', () => {
  const m = ledgerModel({ ...base, slateDate: '2026-10-26', upcoming })
  const off = m.columns.find((c) => c.kind === 'off')
  assert.equal(off.today, true)
  assert.ok(!m.columns.some((c) => c.state === 'today'))
  assert.deepEqual(cellsOf(m, A)[2], { kind: 'off', today: true })
})

test('column states: past, today, future', () => {
  const m = ledgerModel(base)
  assert.deepEqual(m.columns.filter((c) => c.kind === 'game').map((c) => c.state), ['past', 'past', 'today', 'future', 'future', 'future'])
})
