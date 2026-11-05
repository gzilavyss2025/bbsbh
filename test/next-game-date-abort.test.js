// #2914: on a November morning the slate's resume lookup (fetchNextGameDate) opened
// for one render before the offseason gate closed it. useAsync aborted the run, but
// the scan ignored the signal and walked all ten days, one request at a time, through
// the whole load. An aborted scan stops before its next hop.
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchNextGameDate } from '../src/api/schedule.js'

test('fetchNextGameDate stops scanning once its signal aborts', async () => {
  const controller = new AbortController()
  const calls = []
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url))
    controller.abort()
    return { ok: true, status: 200, json: async () => ({ dates: [] }) }
  })
  try {
    assert.equal(await fetchNextGameDate(1, '2026-11-05', 10, null, controller.signal), null)
    assert.equal(calls.length, 1)
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
