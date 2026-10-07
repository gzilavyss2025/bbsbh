import test from 'node:test'
import assert from 'node:assert/strict'
import { pickPeople, parkPoint } from '../src/lib/history/pick.js'

// The "On this day" strip and the "Born near the park" line (ADR-0100) pick names
// by one fixed rule: newest birth or debut year first, then name. No random choice.

const p = (name, year) => ({ personId: name.length, name, year })

test('pickPeople: newest year first, then name, capped', () => {
  const list = [p('Zed', 1950), p('Amy', 1950), p('Old', 1880), p('New', 1999), p('Mid', 1950)]
  assert.deepEqual(pickPeople(list, 3).map((x) => x.name), ['New', 'Amy', 'Mid'])
})

test('pickPeople: a missing year sorts last; input is not changed', () => {
  const list = [p('NoYear', null), p('Dated', 1900)]
  assert.deepEqual(pickPeople(list, 4).map((x) => x.name), ['Dated', 'NoYear'])
  assert.equal(list[0].name, 'NoYear')
})

test('pickPeople: empty or missing list gives []', () => {
  assert.deepEqual(pickPeople([], 3), [])
  assert.deepEqual(pickPeople(undefined, 3), [])
})

test('parkPoint: the park\'s map point from venue.location.defaultCoordinates', () => {
  // gamePk 823570, Citi Field: the city is 'Flushing', which a city-name match missed.
  const citi = { city: 'Flushing', state: 'New York', country: 'USA', defaultCoordinates: { latitude: 40.75753012, longitude: -73.84559155 } }
  assert.deepEqual(parkPoint(citi), { lat: 40.75753012, lon: -73.84559155 })
})

test('parkPoint: no coordinates, or no location, gives null', () => {
  // A placeholder venue (id 401, 'TBD') has a city and no defaultCoordinates.
  assert.equal(parkPoint({ city: 'United States', country: 'USA' }), null)
  assert.equal(parkPoint({ defaultCoordinates: { latitude: 40.7 } }), null)
  assert.equal(parkPoint({ defaultCoordinates: { latitude: '40.7', longitude: '-73.8' } }), null)
  assert.equal(parkPoint(undefined), null)
})
