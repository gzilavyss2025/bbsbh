import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hofPaceRows } from '../src/screens/player/next/modules/hofpace/hofpaceView.js'

const players = [
  { id: 1, name: 'Arm A', pitcher: true, first: 22, rows: [[10, 100, 300, 0], [20, 200, 600, 40]] },
  { id: 2, name: 'Arm B', pitcher: true, first: 22, rows: [[5, 50, 150, 0], [12, 120, 450, 2]] },
]
const line = (season, age, s) => ({ season: String(season), stat: { age, ...s } })

test('a starter gets W, SO and IP rows, no SV row; IP prints as innings', () => {
  const splits = [line(2020, 22, { wins: 8, strikeOuts: 90, inningsPitched: '100.1', saves: 0 }), line(2021, 23, { wins: 9, strikeOuts: 100, inningsPitched: '100.0', saves: 0 })]
  const v = hofPaceRows({ players, splits, role: 'pitching' })
  assert.equal(v.age, 23)
  assert.deepEqual(v.rows.map((r) => r.label), ['W', 'SO', 'IP'])
  assert.equal(v.rows[2].value, '200.1')
  assert.equal(v.rows[2].comps[0].value, '200.0')
})

test('a reliever with 20+ saves gets the SV row', () => {
  const splits = [line(2020, 22, { saves: 10, inningsPitched: '60.0' }), line(2021, 23, { saves: 15, inningsPitched: '60.0' })]
  assert.deepEqual(hofPaceRows({ players, splits, role: 'pitching' }).rows.map((r) => r.label), ['W', 'SO', 'IP', 'SV'])
})

test('no card for one season or an empty pool', () => {
  const one = [line(2021, 23, { wins: 1 })]
  assert.equal(hofPaceRows({ players, splits: one, role: 'pitching' }), null)
  assert.equal(hofPaceRows({ players: [], splits: [line(2020, 22, {}), line(2021, 23, {})], role: 'pitching' }), null)
})

test('a Hall of Famer is never his own comp', () => {
  const splits = [line(2020, 22, { wins: 10 }), line(2021, 23, { wins: 10 })]
  const v = hofPaceRows({ id: 1, players, splits, role: 'pitching' })
  assert.deepEqual(v.rows[0].comps.map((c) => c.id), [2])
})

test('the WAR row comes last, as a tenth', () => {
  const pool = players.map((p) => ({ ...p, rows: p.rows.map((r) => [...r, 2.5]) }))
  const splits = [line(2020, 22, { wins: 8 }), line(2021, 23, { wins: 9 })]
  const v = hofPaceRows({ players: pool, splits, role: 'pitching', war: { 2020: 1, 2021: 1.5 } })
  assert.deepEqual(v.rows.map((r) => r.label), ['W', 'SO', 'IP', 'WAR'])
  assert.equal(v.rows.at(-1).value, '2.5')
  assert.equal(v.rows.at(-1).comps[0].value, '2.5')
})

test('IP over 1,000 gets a thousands comma and keeps its thirds', () => {
  const pool = players.map((p) => ({ ...p, rows: p.rows.map(([w, so, , sv]) => [w, so, 15025, sv]) }))
  const splits = [line(2020, 22, { inningsPitched: '2500.1' }), line(2021, 23, { inningsPitched: '2500.0' })]
  const ip = hofPaceRows({ players: pool, splits, role: 'pitching' }).rows.find((r) => r.label === 'IP')
  assert.equal(ip.value, '5,000.1')
  assert.equal(ip.comps[0].value, '5,008.1')
})
