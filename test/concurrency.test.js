import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapConcurrent } from '../scripts/lib/concurrency.mjs'

test('mapConcurrent keeps input order and passes the index', async () => {
  const out = await mapConcurrent(['a', 'b', 'c'], 2, async (x, i) => `${x}${i}`)
  assert.deepEqual(out, ['a0', 'b1', 'c2'])
})

test('mapConcurrent never runs more than `limit` mappers at once', async () => {
  let live = 0
  let peak = 0
  await mapConcurrent([1, 2, 3, 4, 5, 6], 2, async () => {
    peak = Math.max(peak, ++live)
    await new Promise((r) => setTimeout(r, 5))
    live -= 1
  })
  assert.equal(peak, 2)
})

test('mapConcurrent gives an empty list for no items', async () => {
  assert.deepEqual(await mapConcurrent([], 4, async () => 1), [])
})

test('mapConcurrent turns a failed item into null by default', async () => {
  const out = await mapConcurrent([1, 2, 3], 2, async (x) => {
    if (x === 2) throw new Error('boom')
    return x
  })
  assert.deepEqual(out, [1, null, 3])
})

test('mapConcurrent with { strict: true } rejects on the first failed item', async () => {
  await assert.rejects(
    mapConcurrent(
      [1, 2, 3],
      2,
      async (x) => {
        if (x === 2) throw new Error('boom')
        return x
      },
      { strict: true },
    ),
    /boom/,
  )
})

test('mapConcurrent with { strict: true } still returns results when nothing fails', async () => {
  assert.deepEqual(await mapConcurrent([1, 2], 2, async (x) => x * 2, { strict: true }), [2, 4])
})
