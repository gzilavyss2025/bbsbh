import assert from 'node:assert/strict'
import test from 'node:test'
import { paceLine } from '../scripts/lib/hof/pace.mjs'

const row = (season, age, stat, extra = {}) => ({ season, sport: { id: 1 }, gameType: 'R', stat: { age, ...stat }, ...extra })

test('hitter: cumulates by age and repeats the line across a gap', () => {
  const splits = [
    row('1951', 20, { hits: 127, homeRuns: 20 }),
    row('1954', 23, { hits: 195, homeRuns: 41 }),
  ]
  const { first, rows } = paceLine(splits, false)
  assert.equal(first, 20)
  assert.deepEqual(rows, [[127, 20], [127, 20], [127, 20], [322, 61]])
})

test('traded season counts once: the numTeams roll-up replaces the stints', () => {
  const splits = [
    row('2009', 38, { hits: 30, homeRuns: 5 }, { team: { id: 1 } }),
    row('2009', 38, { hits: 29, homeRuns: 4 }, { team: { id: 2 } }),
    row('2009', 38, { hits: 59, homeRuns: 9 }, { numTeams: 2 }),
  ]
  assert.deepEqual(paceLine(splits, false).rows, [[59, 9]])
})

test('pitcher: W, SO, outs (200.1 IP = 601), SV; minor-league and postseason rows are skipped', () => {
  const splits = [
    row('2000', 25, { wins: 10, strikeOuts: 150, inningsPitched: '200.1', saves: 0 }),
    { ...row('2000', 25, { wins: 9, strikeOuts: 9, inningsPitched: '9.0' }), sport: { id: 11 } },
    { ...row('2000', 25, { wins: 9, strikeOuts: 9, inningsPitched: '9.0' }), gameType: 'P' },
  ]
  assert.deepEqual(paceLine(splits, true).rows, [[10, 150, 601, 0]])
})

test('no MLB season gives null', () => {
  assert.equal(paceLine([], false), null)
})

test('WAR column: cumulative by age from a season map, rounded to tenths; null before 1901', () => {
  const splits = [row('1951', 20, { hits: 127, homeRuns: 20 }), row('1953', 22, { hits: 1, homeRuns: 0 })]
  const { rows } = paceLine(splits, false, { 1951: 2.14, 1953: -0.3 })
  assert.deepEqual(rows, [[127, 20, 2.1], [127, 20, 2.1], [128, 20, 1.8]])
  const old = paceLine([row('1899', 20, { hits: 1, homeRuns: 0 }), row('1901', 22, { hits: 1, homeRuns: 0 })], false, { 1901: 3 })
  assert.deepEqual(old.rows.map((r) => r[2]), [null, null, null])
})
