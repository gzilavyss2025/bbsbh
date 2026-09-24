// A season store keeps every season (ADR-0086). umpires/ and spray/ keep one
// folder per season beside a seasons.json that names the season the app
// serves. #1168's simulated January 1 found the old layout losing 2026: the
// umpire run swept every shard, and the spray run wrote 100 empty buckets.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { seasonsAfter } from '../scripts/lib/io.js'

const STORES = ['umpires', 'spray']
const storeUrl = (store) => new URL(`../public/data/${store}/`, import.meta.url)

test('a new season is added to the index, and the old one stays', () => {
  assert.deepEqual(seasonsAfter({ seasons: [], current: null }, 2026), { seasons: [2026], current: 2026 })
  assert.deepEqual(seasonsAfter({ seasons: [2026], current: 2026 }, 2027), {
    seasons: [2026, 2027],
    current: 2027,
  })
  // A backfill of an older season does not move `current` back.
  assert.deepEqual(seasonsAfter({ seasons: [2026, 2027], current: 2027 }, 2025), {
    seasons: [2025, 2026, 2027],
    current: 2027,
  })
  // A second night of the same season changes nothing.
  assert.deepEqual(seasonsAfter({ seasons: [2026], current: 2026 }, 2026), { seasons: [2026], current: 2026 })
})

for (const store of STORES) {
  test(`${store}/ keeps one folder per season, and seasons.json names them`, () => {
    const index = JSON.parse(readFileSync(new URL('seasons.json', storeUrl(store)), 'utf8'))
    assert.ok(index.seasons.length > 0, `${store}: no season on file`)
    assert.equal(index.current, Math.max(...index.seasons), `${store}: current is not the latest season`)
    for (const season of index.seasons) {
      const dir = new URL(`${season}/`, storeUrl(store))
      assert.ok(existsSync(dir), `${store}: ${season} is listed but has no folder`)
      assert.ok(readdirSync(dir).some((f) => f.endsWith('.json')), `${store}/${season}/ is empty`)
    }
    // No shard left at the top level: a reader never looks there.
    const loose = readdirSync(storeUrl(store)).filter((f) => f.endsWith('.json') && f !== 'seasons.json')
    assert.deepEqual(loose, [], `${store}: shards outside a season folder`)
  })
}

test('the spray card reads the season that seasons.json names', async () => {
  const fetched = []
  globalThis.fetch = async (url) => {
    fetched.push(url)
    const body = url === '/data/spray/seasons.json' ? { seasons: [2026, 2027], current: 2026 } : { season: 2026, bat: {} }
    return { ok: true, status: 200, json: async () => body }
  }
  const { fetchSprayFor } = await import('../src/api/spray.js?case=season')
  await fetchSprayFor(660271)
  assert.deepEqual(fetched, ['/data/spray/seasons.json', '/data/spray/2026/71.json'])
})
