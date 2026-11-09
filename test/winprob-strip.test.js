// The pressure strip under the win-probability plot (#2980): one segment per
// revealed play, sized by its Pressure meter bars, aligned to the plot's x.
import assert from 'node:assert/strict'
import test from 'node:test'
import { pressureStrip, stripLevel } from '../src/components/charts/winprob/pressure/strip.js'

const cutoffs = { li: [0.33, 0.64, 0.9, 1.2, 1.49, 1.88, 2.32, 3.17, 4.56] }
const pt = (li) => ({ li, home: 50 })

test('stripLevel: none, low 1–4, mid 5–7, high 8–10', () => {
  assert.equal(stripLevel(null), null)
  assert.equal(stripLevel(1), 'low')
  assert.equal(stripLevel(4), 'low')
  assert.equal(stripLevel(5), 'mid')
  assert.equal(stripLevel(7), 'mid')
  assert.equal(stripLevel(8), 'high')
  assert.equal(stripLevel(10), 'high')
})

test('one segment per play with an LI, spanning the step the line draws for it', () => {
  // 3 plays + the synthetic origin = 4 x-stops across a 100-wide plot from 0.
  const segs = pressureStrip([pt(null), pt(2.5), pt(5)], cutoffs, { left: 0, width: 90 })
  assert.deepEqual(segs, [
    { idx: 1, x0: 30, x1: 60, bars: 8, level: 'high' },
    { idx: 2, x0: 60, x1: 90, bars: 10, level: 'high' },
  ])
})

test('no cutoffs or no points: no segments', () => {
  assert.deepEqual(pressureStrip([pt(2)], null, { left: 0, width: 90 }), [])
  assert.deepEqual(pressureStrip([], cutoffs, { left: 0, width: 90 }), [])
  assert.deepEqual(pressureStrip(null, cutoffs, { left: 0, width: 90 }), [])
})
