import assert from 'node:assert/strict'
import test from 'node:test'
import { fromCountryPath, fromPath, fromPlacePath } from '../src/lib/from/path.js'
import { parseRoute } from '../src/lib/route.js'

// The "Where they're from" addresses (#1526, SPEC §4): one test per row of the route table.

test('/from is the picker, on the college list', () => {
  assert.deepEqual(parseRoute('/from'), { name: 'from', list: 'college', state: null, zone: null })
})

test('/from?list= sets the list; an unknown list is college', () => {
  assert.equal(parseRoute('/from?list=hometown').list, 'hometown')
  assert.equal(parseRoute('/from?list=high-school').list, 'high-school')
  assert.equal(parseRoute('/from?list=bogus').list, 'college')
})

test('/from/{st} is a state, upper-case in the result', () => {
  assert.deepEqual(parseRoute('/from/ga'), { name: 'from', list: 'college', state: 'GA', zone: null })
  assert.equal(parseRoute('/from/GA').state, 'GA')
})

test('an unknown state is the bare picker', () => {
  assert.deepEqual(parseRoute('/from/zz'), { name: 'from', list: 'college', state: null, zone: null })
  assert.equal(parseRoute('/from/zz/anywhere').name, 'from')
  assert.equal(parseRoute('/from/college').name, 'from')
})

test('/from/{st}?zone=&list= carry the opening zone and list', () => {
  const r = parseRoute('/from/ga?zone=ga-atlanta&list=hometown')
  assert.deepEqual(r, { name: 'from', list: 'hometown', state: 'GA', zone: 'ga-atlanta' })
})

test('an unknown zone is null: another state\'s zone, or a malformed id', () => {
  assert.equal(parseRoute('/from/ga?zone=tx-western-texas').zone, null)
  assert.equal(parseRoute('/from/ga?zone=%3Cscript%3E').zone, null)
  assert.equal(parseRoute('/from/ga?zone=').zone, null)
  assert.equal(parseRoute('/from?zone=ga-atlanta').zone, null)
})

test('/from/college/{slug} and /from/high-school/{slug} are a school', () => {
  assert.deepEqual(parseRoute('/from/college/vanderbilt'), { name: 'from-place', kind: 'college', slug: 'vanderbilt' })
  assert.deepEqual(parseRoute('/from/high-school/smyrna-tn'), { name: 'from-place', kind: 'high-school', slug: 'smyrna-tn' })
})

test('/from/{st}/{city} is a hometown, and does not fall through to the game branch', () => {
  assert.deepEqual(parseRoute('/from/pa/donora'), { name: 'from-place', kind: 'hometown', state: 'PA', city: 'donora' })
  assert.equal(parseRoute('/from/ga/donora').name, 'from-place')
  assert.notEqual(parseRoute('/from/ga/donora').name, 'game')
})

test('/from/country/{country} is a country; with a city it is an abroad place', () => {
  assert.deepEqual(parseRoute('/from/country/dominican-republic'), { name: 'from-country', country: 'dominican-republic' })
  assert.deepEqual(parseRoute('/from/country/dominican-republic/santo-domingo'), {
    name: 'from-place', kind: 'abroad', country: 'dominican-republic', city: 'santo-domingo',
  })
})

test('the builders round-trip through parseRoute', () => {
  const picker = { list: 'hometown', state: 'GA', zone: 'ga-atlanta' }
  assert.deepEqual(parseRoute(fromPath(picker)), { name: 'from', ...picker })
  assert.deepEqual(parseRoute(fromPath({ state: 'TX' })), { name: 'from', list: 'college', state: 'TX', zone: null })
  for (const place of [
    { kind: 'college', slug: 'vanderbilt' },
    { kind: 'high-school', slug: 'smyrna-tn' },
    { kind: 'hometown', state: 'PA', slug: 'donora' },
    { kind: 'abroad', country: 'cuba', slug: 'havana' },
  ]) {
    const { slug, ...rest } = parseRoute(fromPlacePath(place))
    assert.equal(rest.name, 'from-place')
    assert.equal(fromPlacePath({ ...rest, slug: slug ?? rest.city }), fromPlacePath(place))
  }
  assert.deepEqual(parseRoute(fromCountryPath('cuba')), { name: 'from-country', country: 'cuba' })
})

test('builders write only non-default query values', () => {
  assert.equal(fromPath(), '/from')
  assert.equal(fromPath({ list: 'college', state: 'GA' }), '/from/ga')
  assert.equal(fromPath({ list: 'hometown' }), '/from?list=hometown')
  assert.equal(fromPath({ state: 'GA', zone: 'ga-atlanta' }), '/from/ga?zone=ga-atlanta')
  assert.equal(fromPath({ zone: 'ga-atlanta' }), '/from') // a zone needs a state
  assert.equal(fromPath({ list: 'hometown', state: 'GA', zone: 'ga-atlanta' }), '/from/ga?zone=ga-atlanta&list=hometown')
  assert.equal(fromPlacePath({ kind: 'hometown', state: 'PA', city: 'donora' }), '/from/pa/donora')
})

test('/from does not disturb the other routes', () => {
  assert.equal(parseRoute('/scout').name, 'scout')
  assert.equal(parseRoute('/standings').name, 'standings')
  assert.equal(parseRoute('/10222026/milaz/lineup1').name, 'game')
})
