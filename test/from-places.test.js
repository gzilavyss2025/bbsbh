import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFrom, countryOf } from '../scripts/lib/from/places.mjs'

// Places, slugs and zones for "Where they're from" (#1526, SPEC §5.3, §6.3, §6.5, §6.6).
// Small invented players, one trap each.
const SCHOOL = { 1: { name: 'Vanderbilt University', city: 'Nashville', state: 'TN', county: '47037', lat: 36.14, lon: -86.8 } }
const ctx = (over = {}) => ({
  matchCollege: (name) => (name === 'Vanderbilt' ? { unitid: '1', rule: 'exact' } : { unitid: null, rule: 'none', candidates: [] }),
  schoolOf: (id) => SCHOOL[id] ?? null,
  countyZone: { 47037: 'tn-nashville', 13121: 'ga-atlanta', 13089: 'ga-atlanta', 42003: 'pa-pittsburgh' },
  pointCounty: { '33.75,-84.39': '13121', '40.17,-79.86': '42003' },
  birthPoint: (id) => ({ 5: '33.75,-84.39', 6: '33.75,-84.39', 10: '40.17,-79.86' })[id] ?? null,
  project: (lat, lon) => [Math.round(lon), Math.round(lat)],
  ...over,
})
const P = (name, extra = {}) => ({ name, firstSeason: 2000, ...extra })
const run = (players, over) => buildFrom(players, ctx(over))

test('a player tuple is [id, name, pos, debutYear]; the debut falls back to the first season', () => {
  const { files } = run({
    1: P('Late Debut', { debut: 1988, firstSeason: 1987, pos: 'P', col: ['Vanderbilt'] }),
    2: P('No Debut Date', { firstSeason: 1901, col: ['Vanderbilt'] }),
    3: P('Same Year', { debut: 1988, pos: 'X', col: ['Vanderbilt'] }),
  })
  const place = files['college/TN.json'].places[0]
  assert.deepEqual(place.players, [[2, 'No Debut Date', '', 1901], [1, 'Late Debut', 'P', 1988], [3, 'Same Year', 'X', 1988]])
})

test('colleges merge by slug, show the commonest spelling, and carry the IPEDS school', () => {
  const { files, report } = run({
    1: P('A', { col: ['Texas-San Antonio'] }),
    2: P('B', { col: ['Texas - San Antonio'] }),
    3: P('C', { col: ['Texas - San Antonio'] }),
    4: P('D', { col: ['Vanderbilt'] }),
  })
  const un = files['college/_unplaced.json'].places
  assert.equal(un.length, 1)
  assert.equal(un[0].slug, 'texas-san-antonio')
  assert.equal(un[0].name, 'Texas - San Antonio')
  assert.equal(un[0].players.length, 3)
  const v = files['college/TN.json'].places[0]
  assert.deepEqual([v.slug, v.name, v.city, v.state, v.zone, v.pt], ['vanderbilt', 'Vanderbilt', 'Nashville', 'TN', 'tn-nashville', [-87, 36]])
  assert.equal(report.collegeMatched, 1)
  assert.deepEqual(report.unmatched.map((u) => [u.name, u.players]), [['Texas - San Antonio', 3]])
})

test('a college with no IPEDS match is in the lookup with no state, and counted as unplaced', () => {
  const { files, index } = run({ 1: P('A', { col: ['Nowhere Tech'] }) })
  assert.deepEqual(files['lookup/college.json'], [['nowhere-tech', 'Nowhere Tech', null]])
  assert.equal(index.unplaced.college, 1)
  assert.equal(index.counts.college.TN, undefined)
})

test('high school slugs carry the state; one short name in two cities splits by city', () => {
  const { files } = run({
    1: P('A', { hs: [{ name: 'Smyrna', state: 'tn' }] }),
    2: P('B', { hs: [{ name: 'Central', city: 'Columbus', state: 'OH' }] }),
    3: P('C', { hs: [{ name: 'Central', city: 'Toledo', state: 'OH' }] }),
    4: P('D', { hs: [{ name: 'Central', state: 'OH' }] }),
    5: P('E', { hs: [{ name: 'Lincoln', city: 'Tulsa', state: 'OK' }] }),
  })
  assert.deepEqual(files['high-school/TN.json'].places.map((p) => p.slug), ['smyrna-tn'])
  assert.deepEqual(files['high-school/OH.json'].places.map((p) => p.slug), ['central-columbus-oh', 'central-oh', 'central-toledo-oh'])
  assert.deepEqual(files['high-school/OK.json'].places.map((p) => p.slug), ['lincoln-ok']) // one city: the short slug stays
})

test('a high school record with no state and no city is skipped; a foreign state is unplaced', () => {
  const { files, report } = run({
    1: P('A', { hs: [{ name: 'Central' }] }),
    2: P('B', { hs: [{ name: 'Liceo', state: 'DOM' }] }),
    3: P('C', { hs: [{ name: 'Liceo', city: 'Santiago' }] }),
  })
  assert.equal(report.hsSkipped, 1)
  assert.deepEqual(files['high-school/_unplaced.json'].places.map((p) => p.slug), ['liceo-dom', 'liceo-santiago'])
  assert.deepEqual(files['lookup/high-school.json'].map((r) => r[2]), [null, null])
})

test('a high school takes the zone and map point of the birth town it shares', () => {
  const { files } = run({
    1: P('A', { hs: [{ name: 'Westlake', city: 'Atlanta', state: 'GA' }] }),
    5: P('Born There', { birth: { city: 'Atlanta', state: 'GA', country: 'USA' } }),
  })
  const hs = files['high-school/GA.json'].places[0]
  assert.equal(hs.zone, 'ga-atlanta')
  assert.deepEqual(hs.pt, [-84, 34])
})

test('hometowns merge St.Louis and St. Louis, take their zone from the birth coordinate, and uppercase the state', () => {
  const { files, index } = run({
    5: P('A', { birth: { city: 'Atlanta', state: 'Ga', country: 'USA' } }),
    6: P('B', { birth: { city: 'Atlanta', state: 'GA', country: 'USA' } }),
    7: P('C', { birth: { city: 'St.Louis', state: 'MO', country: 'USA' } }),
    8: P('D', { birth: { city: 'St. Louis', state: 'MO', country: 'USA' } }),
    9: P('E', { birth: { city: 'St. Louis', state: 'MO', country: 'USA' } }),
  })
  const atl = files['hometown/GA.json'].places[0]
  assert.deepEqual([atl.slug, atl.name, atl.state, atl.zone, atl.players.length], ['atlanta', 'Atlanta', 'GA', 'ga-atlanta', 2])
  const stl = files['hometown/MO.json'].places[0]
  assert.deepEqual([stl.slug, stl.name, stl.players.length, stl.zone], ['st-louis', 'St. Louis', 3, undefined])
  assert.deepEqual(files['lookup/hometown.json'], [['GA', 'atlanta', 'Atlanta'], ['MO', 'st-louis', 'St. Louis']])
  assert.deepEqual(index.counts.hometown, { GA: 1, MO: 1 })
  assert.deepEqual(index.zoneCounts.hometown, { 'ga-atlanta': 1 })
})

test('Puerto Rico is one country however the API spells it', () => {
  assert.equal(countryOf({ country: 'Puerto Rico' }), 'Puerto Rico')
  assert.equal(countryOf({ country: 'USA', state: 'PR' }), 'Puerto Rico')
  assert.equal(countryOf({ country: 'PUR' }), 'Puerto Rico')
  assert.equal(countryOf({ country: 'MEX' }), 'Mexico')
  assert.equal(countryOf({ country: 'USA', state: 'GA' }), 'USA')
  assert.equal(countryOf({ state: 'GA' }), null)
  const { files, index } = run({
    1: P('A', { birth: { city: 'Ponce', country: 'Puerto Rico' } }),
    2: P('B', { birth: { city: 'San Juan', state: 'PR', country: 'USA' } }),
    3: P('C', { birth: { city: 'Santo Domingo', country: 'Dominican Republic' } }),
    4: P('D', { birth: { city: 'Santo Domingo', country: 'Dominican Republic' } }),
  })
  assert.deepEqual(files['country/puerto-rico.json'].places.map((p) => p.slug), ['ponce', 'san-juan'])
  assert.deepEqual(index.countries, [['dominican-republic', 'Dominican Republic', 2], ['puerto-rico', 'Puerto Rico', 2]])
  assert.equal(files['country/dominican-republic.json'].places[0].players.length, 2)
  assert.equal(files['hometown/PR.json'], undefined)
})

test('a US birth in an unknown state, or with no city, is in no hometown', () => {
  const { files, report } = run({
    1: P('A', { birth: { city: 'Havana', state: 'La Habana', country: 'USA' } }),
    2: P('B', { birth: { state: 'GA', country: 'USA' } }),
    3: P('C'),
  })
  assert.equal(report.hometownUnplaced, 1)
  assert.equal(Object.keys(files).filter((f) => f.startsWith('hometown/')).length, 0)
})

test('the index carries no clock, and the same cache builds the same files', () => {
  const players = { 1: P('A', { col: ['Vanderbilt'], birth: { city: 'Atlanta', state: 'GA', country: 'USA' } }) }
  const a = run(players)
  const b = run(JSON.parse(JSON.stringify(players)))
  assert.equal('generatedAt' in a.index, false)
  assert.equal(JSON.stringify(a.files), JSON.stringify(b.files))
  assert.deepEqual(Object.keys(a.index), ['counts', 'zoneCounts', 'countries', 'unplaced'])
})
