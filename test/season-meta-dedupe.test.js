// Issue #1607: a player page mounts one Milestone Watch card per stat block, and
// each card read the season row on its own. fetchSeasonMeta now shares one
// in-flight read per year. It keeps nothing once the read ends, so a later
// caller always gets a fresh row, and a failed read is never kept.
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchSeasonMeta } from '../src/api/schedule.js'

function withFetch(respond, run) {
  const calls = []
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url))
    return respond(calls.length)
  })
  return Promise.resolve()
    .then(() => run(calls))
    .finally(() => fetchMock.mock.restore())
}

const row = (n) => ({ ok: true, status: 200, json: async () => ({ seasons: [{ seasonId: `row${n}` }] }) })

test('two calls for one year in the same tick send one request', () =>
  withFetch(row, async (calls) => {
    const [a, b] = await Promise.all([fetchSeasonMeta(2026), fetchSeasonMeta(2026)])
    assert.equal(calls.length, 1)
    assert.deepEqual(a, b)
  }))

test('a different year sends its own request', () =>
  withFetch(row, async (calls) => {
    await Promise.all([fetchSeasonMeta(2025), fetchSeasonMeta(2026)])
    assert.equal(calls.length, 2)
  }))

test('a call after the first read ends reads again (nothing is kept)', () =>
  withFetch(row, async (calls) => {
    await fetchSeasonMeta(2026)
    await fetchSeasonMeta(2026)
    assert.equal(calls.length, 2)
  }))

test('a failed read gives null and the next call tries again', () =>
  withFetch(
    (n) => (n === 1 ? { ok: false, status: 404, json: async () => ({}) } : row(n)),
    async (calls) => {
      assert.equal(await fetchSeasonMeta(2026), null)
      assert.deepEqual(await fetchSeasonMeta(2026), { seasonId: 'row2' })
      assert.equal(calls.length, 2)
    },
  ))
