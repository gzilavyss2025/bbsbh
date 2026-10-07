import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGazetteer, placeName } from '../scripts/lib/open-data/gazetteer.mjs'

// The birthplace locator (ADR-0106): a Retrosheet birth city, state and country ->
// a GeoNames map point. Rows are cities500.txt's 19 tab-separated fields.

const geoRow = (id, name, ascii, alts, lat, lon, cc, a1, pop) =>
  [id, name, ascii, alts, lat, lon, 'P', 'PPL', cc, '', a1, '', '', '', pop, '', '', '', ''].join('\t')
const locate = buildGazetteer({
  cities: [
    geoRow(1, 'Saint Louis', 'Saint Louis', 'St. Louis', 38.627, -90.198, 'US', 'MO', 315685),
    geoRow(2, 'Montréal', 'Montreal', '', 45.509, -73.588, 'CA', '10', 1600000),
    geoRow(3, 'Washington', 'Washington', '', 38.895, -77.036, 'US', 'DC', 689545),
    geoRow(4, 'Washington', 'Washington', '', 33.737, -82.739, 'US', 'GA', 3981),
    geoRow(5, 'Springfield', 'Springfield', '', 39.8, -89.64, 'US', 'IL', 114394),
    geoRow(6, 'Springfield', 'Springfield', '', 41.48, -90.07, 'US', 'IL', 600),
    geoRow(7, 'Big Town', 'Big Town', 'Springfield,Old Name', 40.1, -88.2, 'US', 'IL', 900000),
    geoRow(8, 'London', 'London', '', 51.508, -0.126, 'GB', 'ENG', 8961989),
    geoRow(9, 'Fort Myers', 'Fort Myers', '', 26.64, -81.87, 'US', 'FL', 86000),
    geoRow(10, 'Saint-Hyacinthe', 'Saint-Hyacinthe', '', 45.63, -72.96, 'CA', '10', 55000),
    geoRow(11, 'Sainte-Marie', 'Sainte-Marie', '', 46.44, -71.0, 'CA', '10', 13000),
    geoRow(12, 'Alpha', 'Alpha', 'Twin Name,Twin Name', 40.5, -89.0, 'US', 'IL', 5000),
    geoRow(13, 'Beta', 'Beta', 'Twin Name', 38.5, -88.5, 'US', 'IL', 900),
  ].join('\n'),
  admin1: ['US.MO\tMissouri\tMissouri\t1', 'US.DC\tDistrict of Columbia\tDistrict of Columbia\t2', 'US.GA\tGeorgia\tGeorgia\t3', 'US.IL\tIllinois\tIllinois\t4', 'US.FL\tFlorida\tFlorida\t5'].join('\n'),
  countries: ['#ISO\tISO3\tISO-Numeric\tfips\tCountry', 'CA\tCAN\t124\tCA\tCanada', 'GB\tGBR\t826\tUK\tUnited Kingdom'].join('\n'),
})

test('placeName drops accents, case and punctuation, and spells out St., Ft. and Mt.', () => {
  assert.equal(placeName('St. Louis'), 'saint louis')
  assert.equal(placeName('Montréal'), 'montreal')
  assert.equal(placeName('Ft. Myers'), 'fort myers')
  assert.equal(placeName('Mt. Vernon'), 'mount vernon')
  assert.equal(placeName('Ste. Genevieve'), 'sainte genevieve')
  assert.equal(placeName('Winston-Salem'), 'winston salem')
  assert.equal(placeName(null), '')
})

test('a name spelled two ways finds one place, to two decimals', () => {
  assert.deepEqual(locate('St. Louis', 'Missouri', 'USA'), { lat: 38.63, lon: -90.2 })
  assert.deepEqual(locate('Saint Louis', 'Missouri', 'USA'), { lat: 38.63, lon: -90.2 })
  assert.deepEqual(locate('Montreal', 'Quebec', 'Canada'), { lat: 45.51, lon: -73.59 })
  assert.deepEqual(locate('Montréal', '', 'Canada'), { lat: 45.51, lon: -73.59 })
  assert.deepEqual(locate('Ft. Myers', 'Florida', 'USA'), { lat: 26.64, lon: -81.87 })
})

test('a US birth matches on the state; Retrosheet\'s D.C. is the District of Columbia', () => {
  assert.deepEqual(locate('Washington', 'D.C.', 'USA'), { lat: 38.9, lon: -77.04 })
  assert.deepEqual(locate('Washington', 'Georgia', 'USA'), { lat: 33.74, lon: -82.74 })
  assert.equal(locate('Washington', 'Ohio', 'USA'), null)
  assert.equal(locate('Washington', '', 'USA'), null)
})

test('the most people wins among own names, and an own name beats an alternate name', () => {
  assert.deepEqual(locate('Springfield', 'Illinois', 'USA'), { lat: 39.8, lon: -89.64 })
  assert.deepEqual(locate('Old Name', 'Illinois', 'USA'), { lat: 40.1, lon: -88.2 })
})

test('a country GeoNames names differently maps through the alias; an unknown one is null', () => {
  assert.deepEqual(locate('London', '', 'England'), { lat: 51.51, lon: -0.13 })
  assert.equal(locate('London', '', 'Atlantis'), null)
  assert.equal(locate('', 'Missouri', 'USA'), null)
})

test('a hyphen or dot in St-, St. and Ste. spells out the same as Saint', () => {
  assert.equal(placeName('St-Hyacinthe'), 'saint hyacinthe')
  assert.equal(placeName('Saint-Hyacinthe'), 'saint hyacinthe')
  assert.equal(placeName('St. Louis'), 'saint louis')
  assert.equal(placeName('Ste. Marie'), 'sainte marie')
  assert.equal(placeName('Ste-Marie'), 'sainte marie')
  assert.deepEqual(locate('St-Hyacinthe', '', 'Canada'), { lat: 45.63, lon: -72.96 })
  assert.deepEqual(locate('Ste. Marie', '', 'Canada'), { lat: 46.44, lon: -71 })
})

test('an alternate name held by two towns in one state leaves the player unplaced', () => {
  assert.equal(locate('Twin Name', 'Illinois', 'USA'), null)
  assert.deepEqual(locate('Old Name', 'Illinois', 'USA'), { lat: 40.1, lon: -88.2 })
})
