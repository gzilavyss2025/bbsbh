import assert from 'node:assert/strict'
import test from 'node:test'
import { getJson } from '../src/api/statsapi.js'

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

test('getJson retries transient API responses once', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return calls === 1 ? response({}, 503) : response({ ok: true })
  }

  try {
    await assert.deepEqual(await getJson('/retry', { retries: 1 }), { ok: true })
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('getJson does not retry ordinary client errors', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return response({}, 404)
  }

  try {
    await assert.rejects(getJson('/missing', { retries: 2 }), /MLB API 404/)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('getJson aborts a request that exceeds its timeout', async () => {
  const originalFetch = globalThis.fetch
  let aborted = false
  globalThis.fetch = async (_, options) =>
    new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => {
        aborted = true
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })

  try {
    await assert.rejects(
      getJson('/slow', { timeoutMs: 5, retries: 0 }),
      /MLB API timeout/,
    )
    assert.equal(aborted, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('getJson honors a caller abort before the request starts', async () => {
  const originalFetch = globalThis.fetch
  const parent = new AbortController()
  parent.abort()
  let called = false
  globalThis.fetch = async (_, options) => {
    called = true
    assert.equal(options.signal.aborted, true)
    const error = new Error('aborted')
    error.name = 'AbortError'
    throw error
  }

  try {
    await assert.rejects(getJson('/cancelled', { signal: parent.signal }), /aborted/)
    assert.equal(called, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})
