import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { CENSUS_CREDIT, IPEDS_CREDIT, GEONAMES_CREDIT } from '../scripts/lib/open-data/credits.mjs'
import * as copy from '../src/lib/from/copy.js'
import { lookupRows, placeLine, placesIn, rowPlace, searchRows, sortPlaces } from '../src/lib/from/list.js'
import { STATE_NAMES, isStateCode } from '../src/lib/from/states.js'
import { MAP_VIEW, zoomCss, zoomTransform } from '../src/lib/from/zoom.js'

// The pure parts of the Where they're from picker (#1526).

test('zoomTransform fills 86% of the canvas with the state and centres it', () => {
  const box = [689, 374, 787, 476] // Georgia
  const { k, tx, ty } = zoomTransform(box)
  const w = 787 - 689
  const h = 476 - 374
  assert.ok(Math.abs(k - Math.min(975 / w, 610 / h) * 0.86) < 1e-9)
  // the state's centre lands on the canvas centre
  assert.ok(Math.abs((689 + w / 2) * k + tx - MAP_VIEW[0] / 2) < 1e-6)
  assert.ok(Math.abs((374 + h / 2) * k + ty - MAP_VIEW[1] / 2) < 1e-6)
  // it never overflows the canvas
  assert.ok(w * k <= 975 && h * k <= 610)
})

test('zoomTransform takes a factor, and no box is the whole country', () => {
  assert.ok(zoomTransform([0, 0, 100, 100], 0.6).k < zoomTransform([0, 0, 100, 100], 0.86).k)
  assert.deepEqual(zoomTransform(null), { k: 1, tx: 0, ty: 0 })
  assert.match(zoomCss(null), /translate\(0\.00px, 0\.00px\) scale\(1\.0000\)/)
  assert.ok(Number.isFinite(zoomTransform([5, 5, 5, 5]).k)) // a zero-size box does not divide by zero
})

test('lookupRows reads both lookup shapes', () => {
  assert.deepEqual(lookupRows('college', [['vanderbilt', 'Vanderbilt', 'TN']]), [{ slug: 'vanderbilt', name: 'Vanderbilt', state: 'TN' }])
  assert.deepEqual(lookupRows('hometown', [['PA', 'donora', 'Donora']]), [{ slug: 'donora', name: 'Donora', state: 'PA' }])
  assert.deepEqual(lookupRows('college', null), [])
})

test('searchRows ignores case, accents and punctuation, and puts names that start with it first', () => {
  const rows = [
    { slug: 'east-saint-louis', name: 'East St. Louis', state: 'IL' },
    { slug: 'st-louis', name: 'St. Louis', state: 'MO' },
    { slug: 'saint-louis-park', name: 'Saint Louis Park', state: 'MN' },
    { slug: 'mexico', name: 'México', state: 'MO' },
  ]
  assert.deepEqual(searchRows(rows, 'st louis').map((r) => r.slug), ['st-louis', 'east-saint-louis'])
  assert.deepEqual(searchRows(rows, 'MEXICO').map((r) => r.slug), ['mexico'])
  assert.deepEqual(searchRows(rows, '   '), [])
  assert.deepEqual(searchRows(rows, 'zzz'), [])
})

test('sortPlaces puts the most big leaguers first, then A to Z; placesIn narrows by zone', () => {
  const places = [
    { slug: 'b', name: 'B', zone: 'z1', players: [1] },
    { slug: 'a', name: 'A', zone: 'z2', players: [1] },
    { slug: 'c', name: 'C', zone: 'z1', players: [1, 2, 3] },
  ]
  assert.deepEqual(sortPlaces(places).map((p) => p.slug), ['c', 'a', 'b'])
  assert.deepEqual(placesIn(places, 'z1').map((p) => p.slug), ['b', 'c'])
  assert.equal(placesIn(places, null).length, 3)
})

test('rowPlace and placeLine build the link and the line under a name', () => {
  assert.deepEqual(rowPlace('college', { slug: 'x', state: 'TN' }), { kind: 'college', slug: 'x' })
  assert.deepEqual(rowPlace('hometown', { slug: 'donora', state: 'PA' }), { kind: 'hometown', state: 'PA', slug: 'donora' })
  assert.equal(placeLine({ city: 'Nashville', state: 'TN' }), 'Nashville, TN')
  assert.equal(placeLine({ state: 'TN' }), 'TN')
  assert.equal(placeLine({}), '')
})

test('the copy follows SPEC §3', () => {
  assert.equal(copy.FROM_TITLE, 'Where they’re from')
  assert.equal(copy.pickerIntro('college'), 'Pick a school. See every big leaguer who played there.')
  assert.equal(copy.pickerIntro('hometown'), 'Pick a town. See every big leaguer born there.')
  assert.deepEqual(copy.searchField('college'), { label: 'Find a school', placeholder: 'Vanderbilt' })
  assert.deepEqual(copy.searchField('hometown'), { label: 'Find a town', placeholder: 'Donora' })
  assert.equal(copy.legendHas('college'), 'Has a school')
  assert.equal(copy.legendHas('hometown'), 'Has a hometown')
  assert.equal(copy.listTabName('college'), 'Colleges')
  assert.equal(copy.listTabName('high-school', { stateName: 'Georgia' }), 'High schools · Georgia')
  assert.equal(copy.listTabName('hometown', { stateName: 'Georgia', zoneName: 'Atlanta metro' }), 'Hometowns · Atlanta metro')
  assert.equal(copy.countTag('college', 1), '1 school')
  assert.equal(copy.countTag('college', 12), '12 schools')
  assert.equal(copy.countTag('hometown', 1), '1 town')
  assert.equal(copy.countTag('hometown', 0), '0 towns')
  assert.equal(copy.unplacedNote(224), '224 colleges are not on the map yet. Search finds them.')
  assert.match(copy.footnote('hometown'), /^Birthplaces as the MLB Stats API lists them\./)
  assert.match(copy.footnote('college'), /^Schools as the MLB Stats API lists them\./)
})

test('the empty-list lines', () => {
  assert.equal(copy.emptyList('college', { query: true }), 'No school by that name has a big leaguer yet.')
  assert.equal(copy.emptyList('hometown', { query: true }), 'No town by that name has a big leaguer yet.')
  assert.equal(copy.emptyList('college', { state: 'WY' }), 'No college in Wyoming has a big leaguer yet.')
  assert.equal(copy.emptyList('high-school', { state: 'WY' }), 'No high school in Wyoming has a big leaguer yet.')
  assert.equal(copy.emptyList('hometown', { state: 'WY' }), 'No big leaguer born in Wyoming yet.')
})

test('no copy line has an exclamation mark, an emoji or the banned word', () => {
  const lines = [
    copy.FROM_TITLE, copy.pickerIntro('college'), copy.pickerIntro('hometown'), copy.unplacedNote(3),
    copy.footnote('college'), copy.footnote('hometown'), copy.emptyList('college', { state: 'GA' }),
    ...copy.creditsFor('college'), ...copy.creditsFor('hometown'),
  ]
  for (const line of lines) {
    assert.ok(!line.includes('!'), line)
    assert.ok(!/\p{Extended_Pictographic}/u.test(line), line)
  }
})

test('the credit lines match the ones the generators carry, and the About page prints them', () => {
  assert.equal(copy.IPEDS_CREDIT, IPEDS_CREDIT)
  assert.equal(copy.CENSUS_CREDIT, CENSUS_CREDIT)
  assert.equal(copy.GEONAMES_CREDIT, GEONAMES_CREDIT)
  const about = readFileSync(new URL('../src/screens/AboutPage.jsx', import.meta.url), 'utf8')
  assert.ok(about.includes(IPEDS_CREDIT), 'IPEDS on the About page')
  assert.ok(about.includes(CENSUS_CREDIT), 'Census on the About page')
  assert.deepEqual(copy.creditsFor('college'), [IPEDS_CREDIT, CENSUS_CREDIT])
  assert.deepEqual(copy.creditsFor('hometown'), [CENSUS_CREDIT, GEONAMES_CREDIT])
})

test('states: 50 and DC, no Puerto Rico', () => {
  assert.equal(Object.keys(STATE_NAMES).length, 51)
  assert.ok(isStateCode('DC'))
  assert.ok(!isStateCode('PR'))
  assert.ok(!isStateCode('ga'))
  assert.equal(copy.stateName('GA'), 'Georgia')
})
