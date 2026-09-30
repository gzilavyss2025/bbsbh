import test from 'node:test'
import assert from 'node:assert/strict'
import { num, clamp, round1 } from '../src/lib/math/number.js'

test('num is a finite number or 0', () => {
  assert.equal(num('3.5'), 3.5)
  assert.equal(num(7), 7)
  for (const bad of [null, undefined, '', 'x', NaN, Infinity]) assert.equal(num(bad), 0)
})

test('clamp holds a value in [lo, hi]', () => {
  assert.equal(clamp(5, 0, 10), 5)
  assert.equal(clamp(-1, 0, 10), 0)
  assert.equal(clamp(11, 0, 10), 10)
  assert.equal(clamp(0.4, 0, 1), 0.4)
  assert.equal(clamp(-0.5, -1, 1), -0.5)
  assert.ok(Number.isNaN(clamp(NaN, 0, 1)))
})

test('round1 keeps one decimal', () => {
  assert.equal(round1(1.25), 1.3)
  assert.equal(round1(2.04), 2)
  assert.equal(round1(7), 7)
  assert.equal(round1(0.96), 1)
})
