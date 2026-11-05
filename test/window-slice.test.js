// windowSlice: which rows of a fixed-height list to draw for a scroll position.
import test from 'node:test'
import assert from 'node:assert/strict'
import { windowSlice } from '../src/lib/react/windowSlice.js'

test('top of the list: starts at 0, ends past the view by the buffer', () => {
  assert.deepEqual(windowSlice({ scrollTop: 0, viewH: 275, rowH: 55, total: 851, buffer: 3 }), { start: 0, end: 8 })
})

test('middle: the first visible row less the buffer, the last plus it', () => {
  // rows 10..14 are visible at 550..825
  assert.deepEqual(windowSlice({ scrollTop: 550, viewH: 275, rowH: 55, total: 851, buffer: 3 }), { start: 7, end: 18 })
})

test('end: clamped to the total', () => {
  const max = 851 * 55 - 275
  assert.deepEqual(windowSlice({ scrollTop: max, viewH: 275, rowH: 55, total: 851, buffer: 3 }), { start: 843, end: 851 })
})

test('a short list draws every row', () => {
  assert.deepEqual(windowSlice({ scrollTop: 0, viewH: 275, rowH: 55, total: 4, buffer: 3 }), { start: 0, end: 4 })
})

test('unmeasured geometry draws a real first screenful (five rows) plus the buffer, never NaN', () => {
  assert.deepEqual(windowSlice({ scrollTop: 0, viewH: 0, rowH: 0, total: 851, buffer: 3 }), { start: 0, end: 8 })
  assert.deepEqual(windowSlice({ scrollTop: 0, viewH: 0, rowH: 0, total: 6, buffer: 3 }), { start: 0, end: 6 })
})

test('a stale scrollTop past a shrunken list stays in range', () => {
  const s = windowSlice({ scrollTop: 99999, viewH: 275, rowH: 55, total: 10, buffer: 3 })
  assert.ok(s.start >= 0 && s.end <= 10 && s.start <= s.end)
})
