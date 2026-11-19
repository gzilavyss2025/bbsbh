// A line's percentile within its own level (src/lib/trade/levelPct.js).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cutPoints, percentileFromCuts } from '../src/lib/trade/levelPct.js'
import { ordinal } from '../src/lib/format.js'

test('cut points cover a level from its lowest value to its highest', () => {
  const cuts = cutPoints(Array.from({ length: 201 }, (_, i) => 0.5 + i * 0.002))
  assert.equal(cuts.length, 101)
  assert.equal(cuts[0], 0.5)
  assert.equal(Math.round(cuts[100] * 1000), 900)
  assert.equal(cutPoints([]), null)
})

test('a high OPS and a low ERA both rank high', () => {
  const ops = cutPoints(Array.from({ length: 101 }, (_, i) => 0.6 + i * 0.003)) // .600 to .900
  assert.equal(percentileFromCuts(0.9, ops, true), 99)
  assert.equal(percentileFromCuts(0.6, ops, true), 0)
  const era = cutPoints(Array.from({ length: 101 }, (_, i) => 2 + i * 0.04)) // 2.00 to 6.00
  assert.equal(percentileFromCuts(2.0, era, false), 99)
  assert.equal(percentileFromCuts(6.0, era, false), 0)
  assert.equal(percentileFromCuts(1.0, null, true), null)
})

test('ordinals read like the rest of the site', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 93].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '93rd'])
})
