import assert from 'node:assert/strict'
import test from 'node:test'
import { withRetry } from '../scripts/lib/net/retry.mjs'

const noSleep = async () => {}

test('withRetry returns the first success without retrying', async () => {
  let calls = 0
  const out = await withRetry(async () => { calls += 1; return 'ok' }, { sleep: noSleep })
  assert.equal(out, 'ok')
  assert.equal(calls, 1)
})

test('withRetry survives a dropped socket and returns the later success', async () => {
  let calls = 0
  const out = await withRetry(async () => {
    calls += 1
    if (calls < 3) throw new TypeError('fetch failed')
    return 'ok'
  }, { tries: 3, sleep: noSleep })
  assert.equal(out, 'ok')
  assert.equal(calls, 3)
})

test('withRetry rethrows the last error once every try fails', async () => {
  let calls = 0
  await assert.rejects(
    withRetry(async () => { calls += 1; throw new Error(`boom ${calls}`) }, { tries: 3, sleep: noSleep }),
    /boom 3/,
  )
  assert.equal(calls, 3)
})

test('withRetry pauses longer after each failure', async () => {
  const pauses = []
  await assert.rejects(
    withRetry(async () => { throw new Error('x') }, { tries: 3, delayMs: 100, sleep: async (ms) => { pauses.push(ms) } }),
  )
  assert.deepEqual(pauses, [100, 200])
})

test('withRetry with shouldRetry stops at once on an error it will not retry', async () => {
  let calls = 0
  await assert.rejects(
    withRetry(async () => { calls += 1; throw new Error('nope') }, { tries: 3, sleep: noSleep, shouldRetry: () => false }),
    /nope/,
  )
  assert.equal(calls, 1)
})

test('withRetry with shouldRetry still retries the errors it accepts', async () => {
  let calls = 0
  const out = await withRetry(async () => {
    calls += 1
    if (calls < 3) throw new Error('transient')
    return 'ok'
  }, { tries: 3, sleep: noSleep, shouldRetry: (err) => err.message === 'transient' })
  assert.equal(out, 'ok')
  assert.equal(calls, 3)
})
