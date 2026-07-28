// Coverage for the WAR reader (src/api/war.js): the static-file fetch/cache
// wrappers plus the pure year-union helper the player page reads.
import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchWarData, fetchWarHistory, warByYearFor } from '../src/api/war.js'

// --------------------------------------------------------------------------
// warByYearFor — pure, no fetch involved
// --------------------------------------------------------------------------
test('warByYearFor unions history seasons with the live current-season file, current wins its own year', () => {
  const history = {
    seasons: [2023, 2024],
    bat: { 2023: { 660271: 3.2 }, 2024: { 660271: 4.1 } },
    pit: {},
  }
  const current = { season: 2024, bat: { 660271: 4.5 }, pit: {} }
  assert.deepEqual(warByYearFor(660271, 'hitting', current, history), {
    2023: 3.2,
    2024: 4.5, // live file's 2024 value wins over history's own 4.1
  })
})

test('warByYearFor reads the pitching group from the pit maps', () => {
  const history = { seasons: [2023], bat: {}, pit: { 2023: { 543037: 5.5 } } }
  const current = { season: 2024, bat: {}, pit: { 543037: 2.1 } }
  assert.deepEqual(warByYearFor(543037, 'pitching', current, history), { 2023: 5.5, 2024: 2.1 })
})

test('warByYearFor skips a season/current entry the player has no value in', () => {
  const history = { seasons: [2023], bat: { 2023: {} }, pit: {} }
  const current = { season: 2024, bat: {}, pit: {} }
  assert.deepEqual(warByYearFor(1, 'hitting', current, history), {})
})

test('warByYearFor degrades to {} for missing/null history or current', () => {
  assert.deepEqual(warByYearFor(1, 'hitting', null, null), {})
  assert.deepEqual(warByYearFor(1, 'hitting', undefined, undefined), {})
})

// --------------------------------------------------------------------------
// fetchWarData — cached in-memory for the session; this suite is the only
// place that exercises it (module-level singleton cache), same convention as
// test/jerseys.test.js's fetchJerseysData suite.
// --------------------------------------------------------------------------
test('fetchWarData reads the static file and caches it across calls', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (url) => {
    calls++
    assert.equal(url, '/data/war.json')
    return { ok: true, status: 200, json: async () => ({ season: 2026, bat: { 1: 3 }, pit: {}, pa: {} }) }
  }
  try {
    const first = await fetchWarData()
    assert.deepEqual(first, { season: 2026, bat: { 1: 3 }, pit: {}, pa: {} })
    const second = await fetchWarData()
    assert.equal(second, first) // same cached object, no refetch
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// --------------------------------------------------------------------------
// fetchWarHistory — separate cache from fetchWarData, so it can be exercised
// once more independently for the degrade-on-failure path.
// --------------------------------------------------------------------------
test('fetchWarHistory degrades to empty season/bat/pit maps on a non-ok response', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 404 })
  try {
    const data = await fetchWarHistory()
    assert.deepEqual(data, { seasons: [], bat: {}, pit: {} })
  } finally {
    globalThis.fetch = originalFetch
  }
})
