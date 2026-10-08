// The primer's pure parts for the main column (ADR-0087, 2026-10-08 addendum):
// the matchup edges (Gary tunes the thresholds in matchupEdges.js) and the
// ribbon's win-chance line.
import assert from 'node:assert/strict'
import test from 'node:test'
import { matchupEdges, matchupEdgeLine } from '../../src/lib/postseason/primer/matchupEdges.js'
import { wpSpark } from '../../src/lib/postseason/primer/wpSpark.js'

const row = (id, name, ab, h, hr = 0, pa = ab) => ({ id, name, ab, h, hr, bb: pa - ab, hbp: 0, k: 0, pa, levels: ['MLB'] })
const side = (pitcherName, ...batters) => ({ pitcher: { id: 1, name: pitcherName }, batters })

test('a hitter edge: 8 PA and .350, or 8 PA and 2 HR', () => {
  const edges = matchupEdges([
    side('Jack Flaherty', row(1, 'Avg Guy', 8, 3), row(2, 'Pop Guy', 8, 2, 2), row(3, 'Cold Guy', 8, 2, 1), row(4, 'Few PA', 7, 4, 2)),
  ])
  assert.deepEqual(edges.map((e) => e.name), ['Avg Guy', 'Pop Guy'])
  assert.ok(edges.every((e) => e.kind === 'hitter'))
})

test('exactly .350 counts (7-for-20)', () => {
  assert.equal(matchupEdges([side('A B', row(1, 'Edge', 20, 7))]).length, 1)
  assert.equal(matchupEdges([side('A B', row(1, 'Edge', 20, 6))]).length, 0)
})

test('a pitcher edge: 10 AB and .150 or lower', () => {
  const edges = matchupEdges([side('Kodai Senga', row(1, 'Cold', 10, 1), row(2, 'Edge', 10, 2), row(3, 'Small', 9, 0))])
  assert.deepEqual(edges.map((e) => [e.kind, e.name]), [['pitcher', 'Cold']])
})

test('at most 2 hitter edges and 1 pitcher edge, best first, hitters before pitchers', () => {
  const edges = matchupEdges([
    side('Jack Flaherty', row(1, 'A', 10, 4), row(2, 'B', 10, 6), row(3, 'C', 10, 5), row(4, 'Z1', 20, 2), row(5, 'Z2', 25, 1)),
    side('Kodai Senga', row(6, 'D', 12, 0)),
  ])
  assert.deepEqual(edges.map((e) => e.name), ['B', 'C', 'D'])
  assert.deepEqual(edges.map((e) => e.kind), ['hitter', 'hitter', 'pitcher'])
})

test('a side with no file row, or no batters, is skipped', () => {
  assert.deepEqual(matchupEdges([null, undefined, side('A B')]), [])
  assert.deepEqual(matchupEdges(), [])
  assert.deepEqual(matchupEdges(null), [])
})

test('no total bases, so no OPS: the line is "3-for-8, 1 HR · 9 PA"', () => {
  assert.equal(matchupEdgeLine(row(1, 'x', 8, 3, 1, 9)), '3-for-8, 1 HR · 9 PA')
  assert.equal(matchupEdgeLine(row(1, 'x', 10, 1, 0, 11)), '1-for-10 · 11 PA')
  const [e] = matchupEdges([side('Jack Flaherty', row(1, 'Jesse Winker', 8, 3, 1, 9))])
  assert.equal(e.line, '3-for-8, 1 HR · 9 PA')
  assert.equal(e.vs, 'Jack Flaherty')
})

test('wpSpark: one point per value, home chance up, flipped for the away club', () => {
  const home = wpSpark([50, 100, 0], { flip: false, w: 100, h: 20 })
  assert.equal(home.line, '0.0,10.0 50.0,0.0 100.0,20.0')
  const away = wpSpark([50, 100, 0], { flip: true, w: 100, h: 20 })
  assert.equal(away.line, '0.0,10.0 50.0,20.0 100.0,0.0')
})

test('wpSpark: the fill polygons clip at the middle line', () => {
  const s = wpSpark([50, 100, 0], { flip: false, w: 100, h: 20 })
  assert.equal(s.up, '0.0,10.0 50.0,0.0 100.0,10.0 100.0,10.0 0.0,10.0')
  assert.equal(s.down, '0.0,10.0 50.0,10.0 100.0,20.0 100.0,10.0 0.0,10.0')
})

test('wpSpark: fewer than two points draw nothing', () => {
  assert.equal(wpSpark([], {}), null)
  assert.equal(wpSpark([50], {}), null)
  assert.equal(wpSpark(undefined, {}), null)
  assert.equal(wpSpark([50, NaN], {}), null)
})
