import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { compassZones, parseMetroZones, roundBox, STATE_FIPS, STATE_NAMES, stateZones, zoneId } from '../scripts/lib/from/zones.mjs'

// "Where they're from" zones (#1526, SPEC §7.2). The pure rule is tested on small inputs;
// the last block pins the committed output of gen-where-from-map.mjs.

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const json = (rel) => JSON.parse(read(rel))
const counties = (n) => Array.from({ length: n }, (_, i) => ({ id: String(10000 + i), lon: -90 + i, lat: 30 + i }))

test('zoneId drops the word metro and slugs the rest', () => {
  assert.equal(zoneId('GA', 'Atlanta metro'), 'ga-atlanta')
  assert.equal(zoneId('GA', 'Northern Georgia'), 'ga-northern-georgia')
  assert.equal(zoneId('NY', 'New York metro'), 'ny-new-york')
  assert.equal(zoneId('TX', 'Western Texas'), 'tx-western-texas')
})

test('compassZones: 9 or more counties make three zones, north first for a tall state', () => {
  const zones = compassZones('Georgia', counties(9), true)
  assert.deepEqual(zones.map((z) => z.name), ['Northern Georgia', 'Central Georgia', 'Southern Georgia'])
  assert.deepEqual(zones.map((z) => z.ids.length), [3, 3, 3])
  // lat grows with the index, so north (high lat) is the END of the list
  assert.ok(zones[0].ids.includes('10008'))
  assert.ok(zones[2].ids.includes('10000'))
})

test('compassZones: a wide state splits west to east', () => {
  const zones = compassZones('Kansas', counties(9), false)
  assert.deepEqual(zones.map((z) => z.name), ['Western Kansas', 'Central Kansas', 'Eastern Kansas'])
  assert.ok(zones[0].ids.includes('10000'))
})

test('compassZones: 4 to 8 counties make two zones, 1 to 3 make Rest of', () => {
  assert.deepEqual(compassZones('Utah', counties(8), true).map((z) => z.name), ['Northern Utah', 'Southern Utah'])
  assert.deepEqual(compassZones('Utah', counties(4), false).map((z) => z.name), ['Western Utah', 'Eastern Utah'])
  assert.deepEqual(compassZones('Utah', counties(3), true).map((z) => z.name), ['Rest of Utah'])
  assert.deepEqual(compassZones('Utah', counties(1), true).map((z) => z.ids), [['10000']])
  assert.deepEqual(compassZones('Utah', [], true), [])
})

test('compassZones places every county exactly once', () => {
  const all = compassZones('Texas', counties(254), false).flatMap((z) => z.ids)
  assert.equal(all.length, 254)
  assert.equal(new Set(all).size, 254)
})

test('stateZones lists metros largest first, then the compass zones, with ids and kinds', () => {
  const cs = counties(12)
  const metro = { 10000: 'Small metro', 10001: 'Big metro', 10002: 'Big metro' }
  const pop = { 'Small metro': 600000, 'Big metro': 5000000 }
  const zones = stateZones('GA', cs, true, (id) => metro[id], (name) => pop[name])
  assert.deepEqual(zones.map((z) => z.id), [
    'ga-big', 'ga-small', 'ga-northern-georgia', 'ga-central-georgia', 'ga-southern-georgia',
  ])
  assert.deepEqual(zones.map((z) => z.kind), ['metro', 'metro', 'compass', 'compass', 'compass'])
  assert.deepEqual(zones[0].ids, ['10001', '10002'])
  assert.equal(zones.flatMap((z) => z.ids).length, 12)
})

test('roundBox flattens projected bounds to whole pixels', () => {
  assert.deepEqual(roundBox([[689.4, 373.6], [787.5, 475.2]]), [689, 374, 788, 475])
})

test('the metro CSV follows the rule: at most 6 a state, each 500,000 or more', () => {
  const { countyMetro, population } = parseMetroZones(read('scripts/data/from/metro-zones-2023.csv'))
  assert.equal(Object.keys(countyMetro).length, 554)
  const perState = {}
  for (const [key, pop] of Object.entries(population)) {
    const fips = key.split('|')[0]
    perState[fips] = (perState[fips] ?? 0) + 1
    assert.ok(pop >= 500000, `${key} has ${pop}`)
  }
  assert.equal(Object.values(perState).reduce((a, b) => a + b, 0), 104)
  assert.ok(Math.max(...Object.values(perState)) <= 6)
  assert.equal(countyMetro['13121'], 'Atlanta metro')
})

// --- the committed output of gen-where-from-map.mjs --------------------------------------
const us = json('public/data/from/map/us.json')
const countyZone = json('scripts/data/from/county-zone.json')

test('us.json has 50 states and DC, each with a path and a box', () => {
  assert.equal(Object.keys(us.states).length, 51)
  assert.deepEqual(us.viewBox, [975, 610])
  for (const code of Object.values(STATE_FIPS)) {
    assert.ok(us.states[code].d.startsWith('M'), code)
    assert.equal(us.states[code].b.length, 4, code)
  }
})

test('245 zones in all, every county is in one, and zone ids are unique', () => {
  const ids = new Set()
  for (const file of readdirSync(new URL('../public/data/from/map', import.meta.url))) {
    if (file === 'us.json') continue
    const st = file.replace('.json', '')
    assert.ok(STATE_NAMES[st], file)
    for (const z of json(`public/data/from/map/${file}`).zones) {
      assert.ok(z.id.startsWith(`${st.toLowerCase()}-`), z.id)
      assert.ok(!ids.has(z.id), `duplicate ${z.id}`)
      ids.add(z.id)
    }
  }
  assert.equal(ids.size, 245)
  assert.equal(Object.keys(countyZone).length, 3142)
  for (const zone of Object.values(countyZone)) assert.ok(ids.has(zone), zone)
})

test('Georgia has Atlanta metro and three compass zones, by the counts in SPEC §7.2', () => {
  assert.deepEqual(
    json('public/data/from/map/GA.json').zones.map((z) => z.name),
    ['Atlanta metro', 'Northern Georgia', 'Central Georgia', 'Southern Georgia'],
  )
  const count = {}
  for (const z of Object.values(countyZone)) if (z.startsWith('ga-')) count[z] = (count[z] ?? 0) + 1
  assert.deepEqual(count, { 'ga-atlanta': 29, 'ga-northern-georgia': 43, 'ga-central-georgia': 44, 'ga-southern-georgia': 43 })
})

test('point-county maps a birthplace to a county that has a zone', () => {
  const pc = json('scripts/data/from/point-county.json')
  assert.equal(pc['33.75,-84.39'], '13121') // downtown Atlanta: Fulton County
  assert.equal(pc['33.77,-84.3'], '13089') // east Atlanta: DeKalb County
  assert.equal(countyZone['13089'], 'ga-atlanta')
  for (const fips of Object.values(pc)) assert.ok(countyZone[fips], fips)
})
