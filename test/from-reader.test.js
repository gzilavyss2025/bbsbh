import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchFromCountry, fetchFromIndex, fetchFromLookup, fetchFromMap, fetchFromPlace, fetchFromPlaces, fetchFromStateMap } from '../src/api/from/whereFrom.js'

// The readers of the Where they're from files (#1526) ask for the right URL, memoize it, and
// answer a missing file with their fallback. fetch is faked, so the suite stays offline.
function fakeFetch(files) {
  const asked = []
  globalThis.fetch = async (url) => {
    asked.push(url)
    return files[url] ? { ok: true, status: 200, json: async () => files[url] } : { ok: false, status: 404, json: async () => ({}) }
  }
  return asked
}

test('each reader asks for its own file under /data/from/', async () => {
  const asked = fakeFetch({
    '/data/from/index.json': { counts: {} },
    '/data/from/map/us.json': { states: {} },
    '/data/from/map/GA.json': { zones: [] },
    '/data/from/lookup/hometown.json': [['PA', 'donora', 'Donora']],
    '/data/from/college/GA.json': { places: [] },
  })
  assert.deepEqual(await fetchFromIndex(), { counts: {} })
  assert.deepEqual(await fetchFromMap(), { states: {} })
  assert.deepEqual(await fetchFromStateMap('ga'), { zones: [] }) // the state code is upper-cased
  assert.deepEqual(await fetchFromLookup('hometown'), [['PA', 'donora', 'Donora']])
  assert.deepEqual(await fetchFromPlaces('college', 'GA'), { places: [] })
  assert.deepEqual(asked, [
    '/data/from/index.json', '/data/from/map/us.json', '/data/from/map/GA.json',
    '/data/from/lookup/hometown.json', '/data/from/college/GA.json',
  ])
})

test('a file read once is not asked for again', async () => {
  const asked = fakeFetch({ '/data/from/college/TX.json': { places: [] } })
  await fetchFromPlaces('college', 'TX')
  await fetchFromPlaces('college', 'TX')
  assert.equal(asked.length, 1)
})

test('a missing file answers with the reader\'s fallback, never a throw', async () => {
  fakeFetch({})
  assert.deepEqual(await fetchFromLookup('nonesuch'), [])
  assert.equal(await fetchFromPlaces('high-school', 'WY'), null)
  assert.equal(await fetchFromStateMap('ZZ'), null)
})

test('the committed files have the shapes the page reads', async () => {
  const { readFileSync } = await import('node:fs')
  const read = (p) => JSON.parse(readFileSync(new URL(`../public/data/from/${p}`, import.meta.url), 'utf8'))
  const index = read('index.json')
  assert.ok(index.generatedAt && index.counts.college.TN > 0 && index.zoneCounts.hometown['ga-atlanta'] > 0)
  assert.ok(index.countries.length > 50 && Array.isArray(index.countries[0]))
  const row = read('lookup/college.json')[0]
  assert.equal(row.length, 3)
  const place = read('college/TN.json').places.find((p) => p.slug === 'vanderbilt')
  assert.equal(place.state, 'TN')
  assert.ok(Array.isArray(place.players[0]) && place.players[0].length === 4)
})

test('fetchFromPlace finds a school through the lookup, a hometown by state, an abroad town by country', async () => {
  const vandy = { slug: 'vanderbilt', name: 'Vanderbilt', state: 'TN', players: [[1, 'A', 'P', 2000]] }
  const nowhere = { slug: 'nowhere-tech', name: 'Nowhere Tech', players: [[2, 'B', 'C', 1950]] }
  const donora = { slug: 'donora', name: 'Donora', state: 'PA', players: [[3, 'C', 'LF', 1941]] }
  const sd = { slug: 'santo-domingo', name: 'Santo Domingo', players: [[4, 'D', 'SS', 2001]] }
  fakeFetch({
    '/data/from/lookup/college.json': [['vanderbilt', 'Vanderbilt', 'TN'], ['nowhere-tech', 'Nowhere Tech', null]],
    '/data/from/college/TN.json': { places: [vandy] },
    '/data/from/college/_unplaced.json': { places: [nowhere] },
    '/data/from/hometown/PA.json': { places: [donora] },
    '/data/from/country/dominican-republic.json': { name: 'Dominican Republic', places: [sd] },
  })
  assert.deepEqual(await fetchFromPlace({ kind: 'college', slug: 'vanderbilt' }), { place: vandy, state: 'TN', countryName: null })
  assert.deepEqual(await fetchFromPlace({ kind: 'college', slug: 'nowhere-tech' }), { place: nowhere, state: null, countryName: null })
  assert.deepEqual(await fetchFromPlace({ kind: 'hometown', state: 'PA', city: 'donora' }), { place: donora, state: 'PA', countryName: null })
  assert.deepEqual(await fetchFromPlace({ kind: 'abroad', country: 'dominican-republic', city: 'santo-domingo' }), {
    place: sd, state: null, countryName: 'Dominican Republic',
  })
})

test('fetchFromPlace answers null for an address with no place', async () => {
  fakeFetch({ '/data/from/lookup/high-school.json': [], '/data/from/hometown/PA.json': { places: [] } })
  assert.equal(await fetchFromPlace({ kind: 'high-school', slug: 'nope-tn' }), null)
  assert.equal(await fetchFromPlace({ kind: 'hometown', state: 'PA', city: 'nowhere' }), null)
  assert.equal(await fetchFromPlace({ kind: 'abroad', country: 'atlantis', city: 'x' }), null)
  assert.equal(await fetchFromCountry('atlantis'), null)
})

test('every address of the acceptance list has a place in the committed data', async () => {
  const { readFileSync } = await import('node:fs')
  const read = (p) => JSON.parse(readFileSync(new URL(`../public/data/from/${p}`, import.meta.url), 'utf8'))
  const place = (shard, slug) => read(shard).places.find((p) => p.slug === slug)
  const found = [
    read('lookup/college.json').find((r) => r[0] === 'vanderbilt') && place('college/TN.json', 'vanderbilt'),
    read('lookup/high-school.json').find((r) => r[0] === 'smyrna-tn') && place('high-school/TN.json', 'smyrna-tn'),
    place('hometown/PA.json', 'donora'),
    place('country/dominican-republic.json', 'santo-domingo'),
  ]
  for (const p of found) assert.ok(p?.players.length > 0, String(p?.slug))
})
