// Issue #1164: '/team/158/media' fired five `schedule?date=null` requests a
// load, and every one came back 400. Two faults met there. The router read an
// unknown team-hub tab as a GAME address (date='team', matchup='158'), so
// GameRoute ran resolveGame with no date. And fetchSchedule spelled that null
// into the URL instead of refusing it, so the bad request looked like a real
// one in the network panel. These tests pin the schedule guard: no date means
// no schedule request, ever. The router half is in route.test.js.
import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchSchedule, resolveGame } from '../src/api/schedule.js'

function withFetchSpy(run) {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    return { ok: true, status: 200, json: async () => ({ dates: [] }) }
  }
  return Promise.resolve()
    .then(() => run(calls))
    .finally(() => {
      globalThis.fetch = originalFetch
    })
}

test('fetchSchedule refuses a missing date and sends no request', () =>
  withFetchSpy(async (calls) => {
    for (const missing of [null, undefined, '']) {
      await assert.rejects(() => fetchSchedule(missing, 1, 'team'), /date/i)
    }
    assert.deepEqual(calls, [])
  }))

test('resolveGame with no date finds no game and sends no request', () =>
  withFetchSpy(async (calls) => {
    assert.equal(await resolveGame(null, '158'), null)
    assert.equal(await resolveGame(undefined, 'milari'), null)
    assert.deepEqual(calls, [])
  }))

test('a dated game address still resolves through the schedule', () =>
  withFetchSpy(async (calls) => {
    await resolveGame('2026-07-05', 'milari')
    assert.ok(calls.length > 0)
    assert.ok(calls.every((u) => u.includes('date=2026-07-05')))
  }))
