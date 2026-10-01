import assert from 'node:assert/strict'
import test from 'node:test'
import { getJson } from '../src/api/statsapi.js'

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

test('getJson retries transient API responses once', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1
    return calls === 1 ? response({}, 503) : response({ ok: true })
  })

  await assert.deepEqual(await getJson('/retry', { retries: 1 }), { ok: true })
  assert.equal(calls, 2)
})

test('getJson does not retry ordinary client errors', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1
    return response({}, 404)
  })

  await assert.rejects(getJson('/missing', { retries: 2 }), /MLB API 404/)
  assert.equal(calls, 1)
})

test('getJson aborts a request that exceeds its timeout', async (t) => {
  let aborted = false
  t.mock.method(globalThis, 'fetch', async (_, options) =>
    new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => {
        aborted = true
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    }))

  await assert.rejects(
    getJson('/slow', { timeoutMs: 5, retries: 0 }),
    /MLB API timeout/,
  )
  assert.equal(aborted, true)
})

test('getJson honors a caller abort before the request starts', async (t) => {
  const parent = new AbortController()
  parent.abort()
  let called = false
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    called = true
    assert.equal(options.signal.aborted, true)
    const error = new Error('aborted')
    error.name = 'AbortError'
    throw error
  })

  await assert.rejects(getJson('/cancelled', { signal: parent.signal }), /aborted/)
  assert.equal(called, true)
})
