// #2914: on a November morning the slate's resume lookup (fetchNextGameDate) opened
// for one render before the offseason gate closed it. useAsync aborted the run, but
// the scan ignored the signal and walked all ten days, one request at a time. The
// signal now reaches the request in flight, and a cancelled scan throws instead of
// answering null, so it can never read as "no game within ten days" (ADR-0074).
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchNextGameDate, fetchSchedule } from '../src/api/schedule/fetch.js'

// A fetch that never answers until its own signal aborts, as a slow statsapi would.
function hangingFetch(calls) {
  return mock.method(globalThis, 'fetch', (url, init) => {
    calls.push({ url: String(url), signal: init?.signal })
    return new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    })
  })
}

test('fetchSchedule aborts its request in flight', async () => {
  const calls = []
  const fetchMock = hangingFetch(calls)
  try {
    const controller = new AbortController()
    const read = fetchSchedule('2026-11-06', 1, 'team', null, { signal: controller.signal })
    await new Promise((r) => setImmediate(r))
    controller.abort()
    await assert.rejects(read, { name: 'AbortError' })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].signal.aborted, true)
  } finally {
    fetchMock.mock.restore()
  }
})

test('an aborted fetchNextGameDate cancels its hop and throws, never null', async () => {
  const calls = []
  const fetchMock = hangingFetch(calls)
  try {
    const controller = new AbortController()
    const scan = fetchNextGameDate(1, '2026-11-05', 10, null, { signal: controller.signal })
    await new Promise((r) => setImmediate(r))
    controller.abort()
    await assert.rejects(scan, { name: 'AbortError' })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].signal.aborted, true)
  } finally {
    fetchMock.mock.restore()
  }
})

test('fetchNextGameDate aborted before it starts sends nothing', async () => {
  const calls = []
  const fetchMock = hangingFetch(calls)
  try {
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(fetchNextGameDate(1, '2026-11-05', 10, null, { signal: controller.signal }), { name: 'AbortError' })
    assert.equal(calls.length, 0)
  } finally {
    fetchMock.mock.restore()
  }
})

test('fetchNextGameDate without a signal still scans the whole window', async () => {
  const calls = []
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url))
    return { ok: true, status: 200, json: async () => ({ dates: [] }) }
  })
  try {
    assert.equal(await fetchNextGameDate(1, '2026-12-05', 3), null)
    assert.equal(calls.length, 3)
  } finally {
    fetchMock.mock.restore()
  }
})
