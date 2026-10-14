import { test } from 'node:test'
import assert from 'node:assert/strict'
import { barAxisMax, batterCounts, lookAfterSideChange, looksFor, mixRows, totalPitches } from '../src/screens/lineup/next/logic/pitchMix.js'

const arsenal = [
  { code: 'FF', description: 'Four-Seam Fastball', pct: 60, avgVelo: 95, pitches: 600 },
  { code: 'SL', description: 'Slider', pct: 40, avgVelo: 87, pitches: 400 },
]
const tto = [{ look: 1, rows: [{ code: 'FF', usage: 0.7, velo: 96, delta: null }, { code: 'SL', usage: 0.3, velo: 88, delta: null }] }]
const sides = {
  L: { rows: [{ code: 'FF', description: 'Four-Seam Fastball', pct: 80, avgVelo: 95 }], tto: [] },
}

test('the season rows are the default', () => {
  const rows = mixRows(arsenal, tto, sides, null, null)
  assert.deepEqual(rows.map((r) => [r.code, r.pct, r.velo]), [['FF', 60, 95], ['SL', 40, 87]])
})

test('a look reads its own shares and keeps the season name', () => {
  const rows = mixRows(arsenal, tto, sides, null, 1)
  assert.deepEqual(rows.map((r) => [r.name, r.pct]), [['Four-Seam Fastball', 70], ['Slider', 30]])
})

test('a side narrows the rows', () => {
  assert.deepEqual(mixRows(arsenal, tto, sides, 'L', null).map((r) => r.code), ['FF'])
})

test('a look the side never reached is dropped on crossing to it', () => {
  assert.equal(lookAfterSideChange(1, tto, sides, 'L'), null)
  assert.equal(lookAfterSideChange(1, tto, sides, null), 1)
  assert.equal(lookAfterSideChange(null, tto, sides, 'L'), null)
  assert.deepEqual(looksFor(tto, sides, 'L'), [])
})

test('no arsenal gives no rows', () => {
  assert.deepEqual(mixRows(null, null, null, null, null), [])
})

test('a switch-hitter bats from the side opposite the pitcher', () => {
  assert.deepEqual(batterCounts(['L', 'R', 'R', 'S'], 'L'), { L: 1, R: 3 })
  assert.deepEqual(batterCounts(['L', 'R', 'R', 'S'], 'R'), { L: 2, R: 2 })
  assert.deepEqual(batterCounts(['', 'S'], ''), { L: 0, R: 0 })
})

test('the caption sums the pitches thrown', () => {
  assert.equal(totalPitches(arsenal), 1000)
  assert.equal(totalPitches(null), 0)
})

test('the bar axis ends at the next ten past the biggest share', () => {
  assert.equal(barAxisMax([{ pct: 38 }, { pct: 12 }]), 40)
  assert.equal(barAxisMax([{ pct: 40 }]), 40)
  assert.equal(barAxisMax([{ pct: 3 }]), 10)
  assert.equal(barAxisMax([]), 10)
})
