// The Streak Finder's window search (/streaks): n games in a row, never across a
// season or the regular/postseason line, overlapping windows collapsed to the best.
import assert from 'node:assert/strict'
import test from 'node:test'
import { findStretches, gameRow, labelRanks, rankStretches } from '../src/api/streaks/streaks.js'

const g = (season, day, value, post = false) => ({ season, date: `${season}-07-${String(day).padStart(2, '0')}`, value, post, gameNumber: 1 })
const seq = (season, values, post = false) => values.map((v, i) => g(season, i + 1, v, post))

test('a hot week of overlapping windows is one row: its best window', () => {
  // 1987's shape: 1,0,5,5,5,0,2 — windows of 5 total 16,15,17.
  const out = findStretches(seq(1987, [1, 0, 5, 5, 5, 0, 2]), { n: 5, threshold: 15 })
  assert.equal(out.length, 1)
  assert.equal(out[0].total, 17)
  assert.deepEqual(out[0].games.map((x) => x.value), [5, 5, 5, 0, 2])
})

test('windows that do not share a game are separate rows', () => {
  const out = findStretches(seq(2000, [3, 3, 0, 0, 3, 3]), { n: 2, threshold: 6 })
  assert.deepEqual(out.map((w) => w.total), [6, 6])
})

test('a window never crosses seasons or into the postseason', () => {
  const games = [...seq(2001, [0, 5]), ...seq(2002, [5, 0]), ...seq(2001, [5], true)]
  assert.equal(findStretches(games, { n: 2, threshold: 6 }).length, 0)
})

test('"at most" finds the lowest total and best means fewest', () => {
  const out = findStretches(seq(2003, [1, 0, 0, 4]), { n: 2, op: 'max', threshold: 1 })
  assert.equal(out.length, 1)
  assert.equal(out[0].total, 0)
})

test('firstOnly keeps only each sequence\'s opening window', () => {
  const games = [...seq(2026, [1, 7, 1, 2, 2, 9]), ...seq(2024, [1, 4, 3, 3, 0])]
  const out = findStretches(games, { n: 5, threshold: 11, firstOnly: true })
  assert.deepEqual(out.map((w) => [w.season, w.total]), [[2024, 11], [2026, 13]])
})

test('a game with no record of the stat cannot qualify a window', () => {
  assert.equal(findStretches(seq(1970, [null, 0]), { n: 2, op: 'max', threshold: 3 }).length, 0)
})

test('gameRow reads the split and marks a missing stat null', () => {
  const r = gameRow({ season: '2025', date: '2025-10-04', isHome: true, opponent: { id: 112 }, game: { gamePk: 813047, gameNumber: 1 }, stat: { stolenBases: 2 } }, 'stolenBases', true)
  assert.deepEqual(r, { date: '2025-10-04', season: 2025, post: true, value: 2, gamePk: 813047, gameNumber: 1, isHome: true, oppId: 112 })
  assert.equal(gameRow({ season: '1969', stat: {} }, 'caughtStealing', false).value, null)
})

test('rankStretches takes the best windows that share no game, top or bottom', () => {
  const games = seq(2010, [5, 5, 0, 1, 4, 4])
  assert.deepEqual(rankStretches(games, { n: 2, limit: 2 }).map((w) => w.total), [10, 8])
  assert.deepEqual(rankStretches(games, { n: 2, dir: 'bottom', limit: 2 }).map((w) => w.total), [1, 8])
})

test('rankStretches stops at the limit', () => {
  assert.equal(rankStretches(seq(2011, [1, 2, 3, 4, 5, 6]), { n: 1, limit: 3 }).length, 3)
})

test('rankStretches keeps windows that tie the last one taken', () => {
  const out = rankStretches(seq(2012, [9, 3, 3, 3, 1]), { n: 1, limit: 2 })
  assert.deepEqual(out.map((w) => w.total), [9, 3, 3, 3])
})

test('rankStretches with firstOnly ranks each season\'s opening window only', () => {
  const games = [...seq(2013, [1, 1, 9, 9]), ...seq(2014, [3, 3, 0])]
  assert.deepEqual(rankStretches(games, { n: 2, firstOnly: true }).map((w) => [w.season, w.total]), [[2014, 6], [2013, 2]])
})

test('labelRanks: 1 is the most, ties share a T rank', () => {
  const r = labelRanks([{ total: 5 }, { total: 9 }, { total: 5 }, { total: 2 }], false)
  assert.deepEqual(r.map((w) => w.rank), ['T2', '1', 'T2', '4'])
})

test('labelRanks lowFirst ("at most", "bottom") ranks the lowest first', () => {
  const r = labelRanks([{ total: 5 }, { total: 0 }, { total: 0 }], true)
  assert.deepEqual(r.map((w) => w.rank), ['3', 'T1', 'T1'])
})
