// #2579 slice 3: the card's season runs and position tags.
import assert from 'node:assert/strict'
import test from 'node:test'

import { seasonRuns } from '../src/components/team/ladder/layout.js'
import { fetchPositionTags } from '../src/api/person-fetch.js'

test('seasonRuns joins consecutive years and shows the gaps', () => {
  assert.equal(seasonRuns([2017, 2018, 2019, 2020]), '’17–’20')
  assert.equal(seasonRuns([2024, 2018, 2023]), '’18, ’23–’24')
  assert.equal(seasonRuns([2025]), '’25')
  assert.equal(seasonRuns([2020, 2025]), '’20, ’25')
  assert.equal(seasonRuns([]), '')
})

async function withFetch(body, run) {
  const real = globalThis.fetch
  globalThis.fetch = typeof body === 'function' ? body : async () => ({ ok: true, json: async () => body })
  try { return await run() } finally { globalThis.fetch = real }
}

test('fetchPositionTags: RHP/LHP for a pitcher, the abbreviation otherwise', async () => {
  const out = await withFetch({ people: [
    { id: 1, primaryPosition: { abbreviation: 'P' }, pitchHand: { code: 'R' } },
    { id: 2, primaryPosition: { abbreviation: 'P' }, pitchHand: { code: 'L' } },
    { id: 3, primaryPosition: { abbreviation: 'CF' }, pitchHand: { code: 'L' } },
  ] }, () => fetchPositionTags([1, 2, 3]))
  assert.deepEqual(out, { 1: 'RHP', 2: 'LHP', 3: 'CF' })
})

test('fetchPositionTags: {} on failure or no ids', async () => {
  assert.deepEqual(await withFetch(async () => { throw new Error('offline') }, () => fetchPositionTags([1])), {})
  assert.deepEqual(await fetchPositionTags([]), {})
})
