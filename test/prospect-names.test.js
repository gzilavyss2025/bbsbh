// The Pipeline page spells a name with or without its accents from one scrape
// to the next (Joshua Báez / Joshua Baez), and every flip committed and
// deployed top-prospects.json. fetch-top-prospects.mjs now takes the name from
// the Stats API person, which spells it one way.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withStatsapiNames } from '../scripts/lib/milb/prospect-names.mjs'

const rows = [
  { playerId: 1, name: 'Joshua Baez', orgRank: 3 },
  { playerId: 2, name: 'Elmer Rodriguez', orgRank: 4 },
]

test('the Stats API name wins over the scraped one', () => {
  const out = withStatsapiNames(rows, new Map([[1, 'Joshua Báez'], [2, 'Elmer Rodríguez']]))
  assert.deepEqual(out.map((r) => r.name), ['Joshua Báez', 'Elmer Rodríguez'])
  assert.equal(out[0].orgRank, 3)
})

test('a player the Stats API did not return keeps the scraped name', () => {
  assert.deepEqual(withStatsapiNames(rows, new Map([[1, 'Joshua Báez']])).map((r) => r.name), ['Joshua Báez', 'Elmer Rodriguez'])
  assert.deepEqual(withStatsapiNames(rows, new Map()).map((r) => r.name), ['Joshua Baez', 'Elmer Rodriguez'])
})

test('a player in a failed Stats API batch keeps the name already on disk, not the scraped one', async () => {
  const { namesWithFallback } = await import('../scripts/lib/milb/prospect-names.mjs')
  const onDisk = { players: [{ playerId: 1, name: 'Joshua Báez' }], orgProspects: [{ playerId: 2, name: 'Rolddy Muñoz' }, { playerId: 3, name: 'Old Spelling' }] }
  const names = namesWithFallback(new Map([[2, 'Rolddy Muñoz Jr.']]), onDisk, new Set([1]))
  assert.equal(names.get(1), 'Joshua Báez', 'failed batch: the disk name')
  assert.equal(names.get(2), 'Rolddy Muñoz Jr.', 'a fresh Stats API name still wins')
  // Id 3 was in a batch that answered but has no person: the scrape, not a stale disk name.
  assert.equal(names.has(3), false)
  assert.deepEqual(withStatsapiNames([{ playerId: 1, name: 'Joshua Baez' }], names).map((r) => r.name), ['Joshua Báez'])
})
