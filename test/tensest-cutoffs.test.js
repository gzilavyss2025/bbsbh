// Season leverage cutoffs: the histogram gen-tensest.mjs keeps across runs, the
// percentile edges it derives, and the 1–10 tension bars a play's LI maps to.
import assert from 'node:assert/strict'
import test from 'node:test'
import { BAR_PCTS, cutoffsFromHist, emptyHist, foldHist, histOrNull, quantile } from '../scripts/lib/tensest/cutoffs.mjs'
import { pressureLabel, tenseBars } from '../src/api/tensest/tenseBars.js'

const plays = (...lis) => lis.map((leverageIndex) => ({ leverageIndex }))

test('foldHist counts each play in its 0.01 bucket and skips plays with no LI', () => {
  const h = foldHist(emptyHist(), [...plays(0, 0.004, 1.234, 2), {}, { leverageIndex: null }])
  assert.equal(h.length, 1000)
  assert.equal(h[0], 2)
  assert.equal(h[123], 1)
  assert.equal(h[200], 1)
  assert.equal(h.reduce((a, b) => a + b), 4)
})

test('foldHist puts 9.99 and anything above it in the last bucket', () => {
  const h = foldHist(emptyHist(), plays(9.99, 12))
  assert.equal(h[999], 2)
})

test('foldHist folds into an existing histogram without changing it', () => {
  const a = foldHist(emptyHist(), plays(1))
  const b = foldHist(a, plays(1))
  assert.equal(a[100], 1)
  assert.equal(b[100], 2)
})

test('quantile is the LI where that share of plays sits below, ties included', () => {
  // 10 plays: four at 0.5, four at 1.0, one at 3.0, one at 9.99
  const h = foldHist(emptyHist(), plays(0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1, 3, 9.99))
  assert.equal(quantile(h, 0.2), 0.5)
  assert.equal(quantile(h, 0.4), 1)  // the 5th play starts the 1.0 tie
  assert.equal(quantile(h, 0.8), 3)
  assert.equal(quantile(h, 0.9), 9.99)
  assert.equal(quantile(h, 0.99), 9.99)
})

test('cutoffsFromHist gives one LI edge per bar band, or null with no plays', () => {
  assert.equal(cutoffsFromHist(emptyHist()), null)
  const h = foldHist(emptyHist(), plays(...Array.from({ length: 100 }, (_, i) => i / 10)))
  const c = cutoffsFromHist(h)
  assert.deepEqual(c.pcts, BAR_PCTS)
  assert.equal(c.plays, 100)
  assert.equal(c.li.length, 9)
  assert.equal(c.li[0], 2)     // 20th percentile of 0.0 … 9.9
  assert.equal(c.li[8], 9.9)
})

test('histOrNull accepts only a 1,000-bucket array of counts', () => {
  assert.equal(histOrNull(undefined), null)
  assert.equal(histOrNull([1, 2]), null)
  assert.equal(histOrNull(Array(1000).fill('x')), null)
  assert.equal(histOrNull(emptyHist()).length, 1000)
})

const cutoffs = { li: [0.33, 0.74, 0.9, 1.21, 1.52, 1.9, 2.33, 3.17, 4.47] }

test('tenseBars maps LI to 1–10 at each edge', () => {
  assert.equal(tenseBars(0, cutoffs), 1)
  assert.equal(tenseBars(0.32, cutoffs), 1)
  assert.equal(tenseBars(0.33, cutoffs), 2)
  assert.equal(tenseBars(3.16, cutoffs), 8)
  assert.equal(tenseBars(3.17, cutoffs), 9)
  assert.equal(tenseBars(4.47, cutoffs), 10)
  assert.equal(tenseBars(9.99, cutoffs), 10)
})

test('tenseBars is null with no LI or no cutoffs', () => {
  assert.equal(tenseBars(undefined, cutoffs), null)
  assert.equal(tenseBars(null, cutoffs), null)
  assert.equal(tenseBars(NaN, cutoffs), null)
  assert.equal(tenseBars(2, null), null)
  assert.equal(tenseBars(2, { li: [] }), null)
})

test('pressureLabel reads the rank from the published bands, not a fixed table', () => {
  const c = { pcts: [20, 40, 55, 70, 80, 88, 93, 97, 99], li: cutoffs.li }
  assert.equal(pressureLabel(4, c), 'Pressure 4 of 10')
  assert.equal(pressureLabel(5, c), 'Pressure 5 of 10, top 30% of the season')
  assert.equal(pressureLabel(8, c), 'Pressure 8 of 10, top 7% of the season')
  assert.equal(pressureLabel(10, c), 'Pressure 10 of 10, top 1% of the season')
  // A different band set changes the words with it.
  assert.equal(pressureLabel(10, { pcts: [20, 40, 55, 70, 80, 88, 93, 97, 99.5] }), 'Pressure 10 of 10, top 0.5% of the season')
  assert.equal(pressureLabel(null, c), '')
})
