import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { birthRow, personBio, schoolRows } from '../src/api/person/identity.js'
import { countryOf, schoolBase, schoolSlug } from '../src/lib/from/identity.js'
import { playerFromLinks, schoolLabel } from '../src/lib/from/playerLinks.js'

test('schoolLabel adds HS to a bare high-school name only', () => {
  const hs = (name) => schoolLabel({ kind: 'high-school', name })
  assert.equal(hs('Wheeler'), 'Wheeler HS')
  assert.equal(hs('Wheeler High School'), 'Wheeler High School')
  assert.equal(hs('Montverde Academy'), 'Montverde Academy')
  assert.equal(hs('Rickards HS'), 'Rickards HS')
  assert.equal(hs('Home School'), 'Home School')
  assert.equal(schoolLabel({ kind: 'college', name: 'Mississippi State' }), 'Mississippi State')
})

// The player page's links to "who else is from there" (#1526).
const fixture = (n) => JSON.parse(readFileSync(new URL(`./fixtures/player-bio/${n}.json`, import.meta.url), 'utf8'))
const first = (f) => f.people?.[0] ?? f
const gray = first(fixture('gray'))

test('personBio carries the birthplace and the schools as rows, in educationSummary order', () => {
  const bio = personBio(gray)
  assert.deepEqual(bio.schools, [
    { kind: 'high-school', name: 'Smyrna', city: '', state: 'TN' },
    { kind: 'college', name: 'Vanderbilt', city: '', state: '' },
  ])
  assert.equal(bio.birth.country, 'USA')
  assert.equal(bio.birth.state, 'TN')
  assert.equal(bio.education, 'Smyrna, Vanderbilt') // the string is unchanged
  assert.deepEqual(schoolRows({}), [])
  assert.deepEqual(schoolRows({ education: { colleges: [{ name: '  ' }, { name: ' Duke ' }] } }), [{ kind: 'college', name: 'Duke', city: '', state: '' }])
  assert.deepEqual(birthRow(null), { city: '', state: '', country: '' })
})

test('a college, a high school and a US hometown link to their pages', () => {
  const links = playerFromLinks(personBio(gray), new Set())
  assert.equal(links.born, `/from/tn/${links.born.split('/').pop()}`)
  assert.deepEqual(links.schools.map((s) => s.path), ['/from/high-school/smyrna-tn', '/from/college/vanderbilt'])
})

test('a high school with a state waits for the shared-names list; without it, no link', () => {
  const bio = personBio(gray)
  assert.equal(playerFromLinks(bio, null).schools[0].path, null)
  assert.equal(playerFromLinks(bio, null).schools[1].path, '/from/college/vanderbilt') // a college never waits
})

test('a school name shared by two cities takes the city into its slug, when the record has a city', () => {
  const shared = new Set([schoolBase('Central', 'OH')])
  const schools = [
    { kind: 'high-school', name: 'Central', city: 'Toledo', state: 'OH' },
    { kind: 'high-school', name: 'Central', city: '', state: 'OH' },
    { kind: 'high-school', name: 'Lincoln', city: 'Tulsa', state: 'OK' },
  ]
  assert.deepEqual(playerFromLinks({ birth: {}, schools }, shared).schools.map((s) => s.path), [
    '/from/high-school/central-toledo-oh',
    '/from/high-school/central-oh',
    '/from/high-school/lincoln-ok',
  ])
})

test('a high school with no state is named by its city; with neither it is no place', () => {
  const schools = [
    { kind: 'high-school', name: 'Liceo', city: 'Santiago', state: '' },
    { kind: 'high-school', name: 'Central', city: '', state: '' },
  ]
  assert.deepEqual(playerFromLinks({ birth: {}, schools }, null).schools.map((s) => s.path), ['/from/high-school/liceo-santiago', null])
})

test('birthplaces: a US town, Puerto Rico both ways, a town abroad, and the cases with no page', () => {
  const born = (b) => playerFromLinks({ birth: b, schools: [] }).born
  assert.equal(born({ city: 'Donora', state: 'PA', country: 'USA' }), '/from/pa/donora')
  assert.equal(born({ city: 'St. Louis', state: 'mo', country: 'USA' }), '/from/mo/st-louis')
  assert.equal(born({ city: 'Ponce', state: '', country: 'Puerto Rico' }), '/from/country/puerto-rico/ponce')
  assert.equal(born({ city: 'San Juan', state: 'PR', country: 'USA' }), '/from/country/puerto-rico/san-juan')
  assert.equal(born({ city: 'Santo Domingo', state: '', country: 'Dominican Republic' }), '/from/country/dominican-republic/santo-domingo')
  assert.equal(born({ city: 'Caracas', state: '', country: 'VEN' }), '/from/country/venezuela/caracas')
  assert.equal(born({ city: '', state: 'GA', country: 'USA' }), null) // no city
  assert.equal(born({ city: 'Havana', state: 'La Habana', country: 'USA' }), null) // not a state
  assert.equal(born({ city: 'Donora', state: '-1', country: 'USA' }), null) // the feed's unknown
  assert.equal(born({ city: 'Somewhere', state: '', country: '' }), null) // no country
  assert.equal(playerFromLinks({ birth: undefined, schools: [] }).born, null)
})

test('the address rules are the generator\'s: one copy', () => {
  assert.equal(countryOf({ country: 'USA', state: 'PR' }), 'Puerto Rico')
  assert.equal(schoolSlug({ name: 'Smyrna', state: 'tn' }, false), 'smyrna-tn')
  assert.equal(schoolSlug({ name: 'Central', city: 'Toledo', state: 'OH' }, true), 'central-toledo-oh')
  assert.equal(schoolSlug({ name: 'Central', city: '', state: 'OH' }, true), 'central-oh')
})

// Every link a real player would get must lead to a page that exists, or the feature sends people to
// "No big leaguer is listed from this place". The cache is the nightly data; the places are what the generator wrote from it.
test('every link a player in the cache gets points at a place that exists', () => {
  const read = (p) => JSON.parse(readFileSync(new URL(`../public/data/from/${p}`, import.meta.url), 'utf8'))
  const pages = new Set()
  for (const kind of ['college', 'high-school', 'hometown']) {
    for (const file of readdirSync(new URL(`../public/data/from/${kind}`, import.meta.url))) {
      const st = file.replace('.json', '').toLowerCase()
      for (const p of read(`${kind}/${file}`).places) pages.add(kind === 'hometown' ? `/from/${st}/${p.slug}` : `/from/${kind}/${p.slug}`)
    }
  }
  for (const file of readdirSync(new URL('../public/data/from/country', import.meta.url))) {
    for (const p of read(`country/${file}`).places) pages.add(`/from/country/${file.replace('.json', '')}/${p.slug}`)
  }
  const split = new Set(read('lookup/high-school-split.json'))
  const { players } = JSON.parse(readFileSync(new URL('../scripts/data/from/players.json', import.meta.url), 'utf8'))
  let links = 0
  const missing = []
  for (const [id, p] of Object.entries(players)) {
    if (!p.debut && p.firstSeason > 1960) continue // a prospect is held back from the pages
    const schools = [
      ...(p.hs ?? []).map((h) => ({ kind: 'high-school', name: h.name, city: h.city ?? '', state: h.state ?? '' })),
      ...(p.col ?? []).map((name) => ({ kind: 'college', name, city: '', state: '' })),
    ]
    const out = playerFromLinks({ birth: p.birth ?? {}, schools }, split)
    for (const path of [out.born, ...out.schools.map((s) => s.path)]) {
      if (!path) continue
      links++
      if (!pages.has(path)) missing.push(`${id} ${path}`)
    }
  }
  assert.ok(links > 40000, `only ${links} links`)
  assert.deepEqual(missing.slice(0, 5), [], `${missing.length} links lead nowhere`)
})
