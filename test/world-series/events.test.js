// The pure half of the events generator (scripts/lib/world-series/events.mjs): the traps in
// contract.md section 2 that live outside the classifier.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  gamesFromSchedule, gamesFromSeriesJson, numberGames, seasonRange, seriesFacts,
} from '../../scripts/lib/world-series/events.mjs'

const FIX = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'world-series')
const schedule = (y) => JSON.parse(readFileSync(join(FIX, `schedule-${y}.json`), 'utf8'))

test('gamesFromSchedule keeps one row for a postponed game, on its played date (2022 G3)', () => {
  const games = gamesFromSchedule(schedule(2022))
  assert.equal(games.length, 6)
  assert.equal(games.find((g) => g.pk === 715722).date, '2022-11-01')
})

test('numberGames counts a tie: 1912 Game 8 is n 8; 2006 numbers from the order, not seriesGameNumber', () => {
  const g1912 = numberGames(gamesFromSchedule(schedule(1912)))
  assert.equal(g1912.length, 8)
  assert.equal(g1912.at(-1).n, 8)
  const g2006 = numberGames(gamesFromSchedule(schedule(2006)))
  assert.deepEqual(g2006.map((g) => g.n), [1, 2, 3, 4, 5])
})

const game = (pk, away, home, awayRuns, homeRuns) => ({ pk, away, home, awayRuns, homeRuns })

test('seriesFacts: winsNeeded comes from the winner, a tie is not a win, wta is the last decided game', () => {
  // decided games A B B A A B make 3-3; a tie sits in the middle; A wins game 8
  const games = [
    game(1, 'A', 'B', 2, 1), game(2, 'B', 'A', 2, 1), game(3, 'B', 'A', 1, 1), game(4, 'B', 'A', 2, 1),
    game(5, 'A', 'B', 2, 1), game(6, 'A', 'B', 2, 1), game(7, 'B', 'A', 2, 1), game(8, 'A', 'B', 4, 3),
  ]
  const f = seriesFacts(games)
  assert.deepEqual([f.winner, f.winsNeeded, f.wtaPk], ['A', 4, 8])
})

test('seriesFacts: a 4-2 Series has no winner-take-all game; a best-of-nine reads 5', () => {
  const four2 = [1, 2, 3, 4, 5, 6].map((i) => game(i, 'A', 'B', i === 3 || i === 5 ? 0 : 1, i === 3 || i === 5 ? 1 : 0))
  assert.equal(seriesFacts(four2).wtaPk, null)
  assert.equal(seriesFacts(four2).winsNeeded, 4)
  const nine = Array.from({ length: 5 }, (_, i) => game(i + 1, 'A', 'B', 1, 0))
  assert.equal(seriesFacts(nine).winsNeeded, 5)
})

test('gamesFromSeriesJson maps the contract shape', () => {
  const doc = { series: [{ season: 2025, games: [{ pk: 9, date: '2025-10-24', away: 1, home: 2, awayRuns: 0 }] }] }
  assert.deepEqual(gamesFromSeriesJson(doc, 2025), [{ pk: 9, date: '2025-10-24', away: 1, home: 2 }])
  assert.deepEqual(gamesFromSeriesJson(doc, 2024), [])
})

test('seasonRange defaults, validates and refuses an unknown flag', () => {
  assert.deepEqual(seasonRange({}, 2025), { from: 1903, to: 2025 })
  assert.deepEqual(seasonRange({ from: '1950', to: '1960' }, 2025), { from: 1950, to: 1960 })
  assert.throws(() => seasonRange({ from: '1800' }, 2025))
  assert.throws(() => seasonRange({ frm: '1950' }, 2025), /unknown flag/)
})
