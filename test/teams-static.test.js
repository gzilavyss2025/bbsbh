// Coverage for the static team-identity reader (src/api/teams-static.js), the
// shared once-a-week snapshot fetchTeams (schedule.js) and fetchTeam (team.js)
// both read before falling back to a live statsapi call.
import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchStaticTeams } from '../src/api/teams-static.js'

// This suite is the only place that exercises fetchStaticTeams — its cache is
// module-level singleton state, same convention as test/jerseys.test.js.
test('fetchStaticTeams reads /data/teams.json and caches the parsed result across calls', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  const payload = { generatedAt: '2026-07-01', bySportId: { 1: [{ id: 158, name: 'Brewers' }] } }
  globalThis.fetch = async (url) => {
    calls++
    assert.equal(url, '/data/teams.json')
    return { ok: true, status: 200, json: async () => payload }
  }
  try {
    const first = await fetchStaticTeams()
    assert.deepEqual(first, payload)
    const second = await fetchStaticTeams()
    assert.equal(second, first) // same cached object, no refetch
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// A fresh module instance (via a cache-busting query) so the degrade-on-failure
// path can be exercised independently of the cache the test above already
// populated with a truthy value.
test('fetchStaticTeams degrades to an empty bySportId on a non-ok response', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 500 })
  try {
    const { fetchStaticTeams: freshFetchStaticTeams } = await import('../src/api/teams-static.js?fresh-for-failure-test')
    const data = await freshFetchStaticTeams()
    assert.deepEqual(data, { generatedAt: null, bySportId: {} })
  } finally {
    globalThis.fetch = originalFetch
  }
})
