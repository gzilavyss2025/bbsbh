import test from 'node:test'
import assert from 'node:assert/strict'
import { pickPeople, parkPlace } from '../src/lib/history/pick.js'

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

test('parkPlace: a US park keys on the full state name', () => {
  assert.deepEqual(
    parkPlace({ city: 'San Diego', state: 'California', stateAbbrev: 'CA', country: 'USA' }),
    ['San Diego', 'California'],
  )
})

test('parkPlace: a park outside the US keys on the country', () => {
  assert.deepEqual(parkPlace({ city: 'Toronto', state: 'Ontario', country: 'Canada' }), ['Toronto', 'Canada'])
})

test('parkPlace: no city, no place, or no location gives null', () => {
  assert.equal(parkPlace({ state: 'Ohio', country: 'USA' }), null)
  assert.equal(parkPlace({ city: 'Gary', country: 'USA' }), null)
  assert.equal(parkPlace(undefined), null)
})
