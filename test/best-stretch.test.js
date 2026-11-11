// Best Stretch (/best-stretch): a hitter's best N games in a row, across seasons.
import assert from 'node:assert/strict'
import test from 'node:test'
import { bestStretch, measureByKey, obp, slg, toGame } from '../src/api/streaks/bestStretch.js'

const day = (i) => `20${String(18 + Math.floor(i / 200)).padStart(2, '0')}-${String(4 + Math.floor((i % 200) / 31)).padStart(2, '0')}-${String(((i % 200) % 31) + 1).padStart(2, '0')}`
const game = (i, s) => toGame({ date: day(i), game: { gameNumber: 1 }, team: { id: 158 }, stat: { atBats: 4, plateAppearances: 4, ...s } })

test('finds the hottest window, and a window may cross a season', () => {
  const games = Array.from({ length: 400 }, (_, i) => game(i, i >= 190 && i < 200 + 3 ? { hits: 3, homeRuns: 1, totalBases: 6 } : { hits: 1, totalBases: 1 }))
  const b = bestStretch(games, 13, measureByKey('hr'))
  assert.equal(b.homeRuns, 13)
  assert.equal(b.first, day(190))
  assert.equal(b.last, day(202))
  assert.notEqual(b.first.slice(0, 4), b.last.slice(0, 4))
})

test('games arrive out of order: the window still runs by date', () => {
  const games = [game(2, { hits: 4 }), game(0, {}), game(1, { hits: 4 })]
  const b = bestStretch(games, 2, measureByKey('h'))
  assert.equal(b.hits, 8)
  assert.equal(b.first, day(1))
})

test('fewer games than the window is no stretch', () => {
  assert.equal(bestStretch([game(0, {})], 162, measureByKey('ops')), null)
})

test('a tie keeps the earlier window', () => {
  const b = bestStretch([game(0, { hits: 1 }), game(1, { hits: 1 })], 1, measureByKey('h'))
  assert.equal(b.first, day(0))
})

test('OBP counts walks, HBP and sac flies; SLG is total bases over at-bats', () => {
  const t = { hits: 3, baseOnBalls: 1, hitByPitch: 1, sacFlies: 1, atBats: 10, totalBases: 7 }
  assert.equal(obp(t), 5 / 13)
  assert.equal(slg(t), 0.7)
  assert.equal(obp({ hits: 0, baseOnBalls: 0, hitByPitch: 0, sacFlies: 0, atBats: 0 }), 0)
})
