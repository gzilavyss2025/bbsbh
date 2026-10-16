import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lastBefore } from '../../src/lib/worldSeries/lastBefore.js'

const rows = [
  { date: '1986-10-25', tag: 'a', v: 1 },
  { date: '1986-10-18', tag: 'a', v: 2 },
  { date: '1986-10-27', tag: 'b', v: 3 },
  { date: '1985-10-20', tag: 'b', v: 4 },
]

test('before is required and must be an ISO date', () => {
  for (const before of [undefined, null, '', '1986', '10/25/1986', 19861025]) {
    assert.throws(() => lastBefore(rows, { before }), /ISO/)
  }
  assert.throws(() => lastBefore(rows), /ISO/)
})

test('before is strict: a same-day row is out; newest first', () => {
  assert.deepEqual(lastBefore(rows, { before: '1986-10-25' }).map((r) => r.v), [2, 4])
  assert.deepEqual(lastBefore(rows, { before: '1986-10-26' }).map((r) => r.v), [1, 2, 4])
})

test('tag and filter narrow the rows', () => {
  assert.deepEqual(lastBefore(rows, { before: '1990-01-01', tag: 'b' }).map((r) => r.v), [3, 4])
  assert.deepEqual(lastBefore(rows, { before: '1990-01-01', filter: (r) => r.v > 2 }).map((r) => r.v), [3, 4])
})
