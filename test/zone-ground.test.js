import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groundBoxes } from '../src/lib/zone/ground.js'

const xs = (points) => points.split(' ').map((p) => Number(p.split(',')[0]))

test('groundBoxes: two batter\'s boxes, one each side of the plate', () => {
  const boxes = groundBoxes(100, 200, 80)
  assert.equal(boxes.length, 2)
  assert.ok(Math.max(...xs(boxes[0])) < 100, 'the first box is left of the plate centre')
  assert.ok(Math.min(...xs(boxes[1])) > 100, 'the second box is right of it')
})

test('groundBoxes: mirror-symmetric about the plate centre', () => {
  const [l, r] = groundBoxes(100, 200, 80).map(xs)
  const left = l.map((x) => +(200 - x).toFixed(1)).sort((a, b) => a - b)
  const right = [...r].sort((a, b) => a - b)
  assert.deepEqual(left, right)
})

test('groundBoxes: scales with the plate width', () => {
  const span = (zw) => {
    const [l] = groundBoxes(0, 0, zw).map(xs)
    return Math.max(...l) - Math.min(...l)
  }
  assert.ok(Math.abs(span(160) / span(80) - 2) < 0.02)
})
