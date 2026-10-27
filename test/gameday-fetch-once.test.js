// Gameday's fetch memo (src/lib/gameday/fetchOnce.js): one request per arguments for the session, and
// a failed read is not remembered.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchOnce } from '../src/lib/gameday/fetchOnce.js'

test('the same arguments share one request, even when both start on one tick', async () => {
  let calls = 0
  const f = fetchOnce(async (a, b) => (calls++, { a, b }))
  const [x, y] = await Promise.all([f(1, 'x'), f(1, 'x')])
  assert.equal(calls, 1)
  assert.equal(x, y)
  await f(2, 'x')
  assert.equal(calls, 2, 'other arguments are their own request')
})

test('an empty answer or a throw is forgotten, so the next call asks again', async () => {
  let calls = 0
  const nul = fetchOnce(async () => (calls++, null))
  await nul(1)
  await nul(1)
  assert.equal(calls, 2)
  const bad = fetchOnce(async () => { calls++; throw new Error('down') })
  await assert.rejects(bad(1))
  await assert.rejects(bad(1))
  assert.equal(calls, 4)
  const obj = fetchOnce(async () => (calls++, {}), (v) => !Object.keys(v).length)
  await obj(1)
  await obj(1)
  assert.equal(calls, 6, 'a caller-supplied empty test drops {}')
})
