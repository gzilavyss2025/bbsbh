import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadPostseasonLeaders } from '../src/api/postseason/archive/leaders.js'

// A failed read shows the empty state, but must not stick: the next visit tries again.
test('a failed postseason-leaders read is retried on the next call', async (t) => {
  const real = globalThis.fetch
  t.after(() => { globalThis.fetch = real })
  globalThis.fetch = async () => ({ ok: false, status: 503 })
  const first = await loadPostseasonLeaders()
  assert.equal(first.since, null)
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ since: 2000, batting: { homeRuns: [{ playerId: 1, name: 'A', teamId: 158, value: 9 }] } }) })
  const second = await loadPostseasonLeaders()
  assert.equal(second.since, 2000)
  assert.equal(second.batting.homeRuns[0].display, '9')
})
