import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { mapConcurrent } from '../scripts/lib/concurrency.mjs'
import { BATCH, fetchPeople, fetchSeasonIds, isPending, recheckSlice, slimPerson, sortedIds } from '../scripts/lib/from/players.mjs'

// The player cache of "Where they're from" (#1526, SPEC §6.4). The three people are a live
// /people?hydrate=education response from 2026-10-20 (Yelich, Gray, Núñez).
const batch = JSON.parse(readFileSync(new URL('./fixtures/where-from/people-education-batch.json', import.meta.url), 'utf8'))
const byName = (n) => batch.people.find((p) => p.fullName === n)

test('slimPerson keeps the few fields the pages need', () => {
  const gray = slimPerson(byName('Sonny Gray'), 2013)
  assert.equal(gray.name, 'Sonny Gray')
  assert.equal(gray.firstSeason, 2013)
  assert.deepEqual(gray.hs, [{ name: 'Smyrna', state: 'TN' }])
  assert.deepEqual(gray.col, ['Vanderbilt'])
  assert.equal(gray.debut, 2013)
  assert.equal(gray.pos, 'P')
  assert.equal(gray.birth.country, 'USA')
  assert.deepEqual(Object.keys(gray), [...Object.keys(gray)].sort())
})

test('slimPerson leaves out empty fields, and a missing debut date stays missing', () => {
  const row = slimPerson({ id: 1, fullName: ' Gerhart ', birthCity: ' ', education: { highschools: [{ name: '' }], colleges: [] } }, 1890)
  assert.deepEqual(row, { firstSeason: 1890, name: 'Gerhart' })
})

test('a re-check keeps the first season it already knew', () => {
  const prev = { name: 'Old', firstSeason: 1901 }
  assert.equal(slimPerson({ id: 1, fullName: 'Old Name', mlbDebutDate: '1901-04-20' }, 2026, prev).firstSeason, 1901)
  assert.equal(slimPerson({ id: 1, fullName: 'Old Name', mlbDebutDate: '1901-04-20' }, 2026, prev).debut, 1901)
})

test('sortedIds is numeric, not alphabetical', () => {
  assert.deepEqual(sortedIds({ 10: 1, 9: 1, 100: 1 }), ['9', '10', '100'])
})

test('recheckSlice takes 1/30 of the players and wraps round', () => {
  const ids = Array.from({ length: 100 }, (_, i) => String(i))
  const first = recheckSlice(ids, 0)
  assert.equal(first.ids.length, 4) // ceil(100 / 30)
  assert.equal(first.cursor, 4)
  const wrap = recheckSlice(ids, 98)
  assert.deepEqual(wrap.ids, ['98', '99', '0', '1'])
  assert.equal(wrap.cursor, 2)
  assert.deepEqual(recheckSlice([], 5), { ids: [], cursor: 0 })
})

test('thirty nights of re-checks look at every player at least once', () => {
  const ids = Array.from({ length: 2371 }, (_, i) => String(i))
  const seen = new Set()
  let cursor = 0
  for (let night = 0; night < 30; night++) {
    const slice = recheckSlice(ids, cursor)
    slice.ids.forEach((id) => seen.add(id))
    cursor = slice.cursor
  }
  assert.equal(seen.size, ids.length)
})

test('fetchSeasonIds reads the id list of one season', async () => {
  const calls = []
  const getJson = async (path) => (calls.push(path), { people: [{ id: 7 }, { id: 8 }] })
  assert.deepEqual(await fetchSeasonIds(getJson, 1985), ['7', '8'])
  assert.match(calls[0], /\/sports\/1\/players\?season=1985/)
})

test('fetchPeople asks for 200 ids at a time and stops on a failed batch', async () => {
  const asked = []
  const getJson = async (path) => {
    const ids = path.match(/personIds=([\d,]+)/)[1].split(',')
    asked.push(ids.length)
    return { people: ids.map((id) => ({ id: Number(id) })) }
  }
  const ids = Array.from({ length: 450 }, (_, i) => String(i + 1))
  const got = await fetchPeople(getJson, ids, mapConcurrent)
  assert.equal(got.people.length, 450)
  assert.equal(got.requests, 3)
  assert.deepEqual(asked.sort((a, b) => b - a), [BATCH, BATCH, 50])
  await assert.rejects(fetchPeople(async () => { throw new Error('503') }, ids, mapConcurrent), /503/)
})

test('a National Association debut (1871) is kept, though the first season list is 1876', () => {
  const row = slimPerson({ id: 110284, fullName: 'Cap Anson', mlbDebutDate: '1871-05-06' }, 1876)
  assert.equal(row.debut, 1871)
  assert.equal(row.firstSeason, 1876)
  assert.equal(slimPerson({ id: 1, fullName: 'X', mlbDebutDate: '0001-01-01' }, 1900).debut, undefined)
})

test('a response thinner than the row it replaces does not erase it', () => {
  const prev = { name: 'A', firstSeason: 2001, debut: 2001, pos: 'P', birth: { city: 'Troy', state: 'NY', country: 'USA' }, hs: [{ name: 'Troy High' }], col: ['Siena'] }
  const thin = slimPerson({ id: 1, fullName: 'A' }, 2026, prev) // no education key, no birth, no debut date
  assert.deepEqual([thin.debut, thin.birth, thin.hs, thin.col], [2001, prev.birth, prev.hs, prev.col])
  // an education key that is present and empty is a real answer
  const kept = slimPerson({ id: 1, fullName: 'A', education: {}, birthCity: 'Troy' }, 2026, prev)
  assert.equal(kept.col, undefined)
  assert.equal(kept.hs, undefined)
  // a changed value wins
  assert.equal(slimPerson({ id: 1, fullName: 'A', education: { colleges: [{ name: 'RPI' }] } }, 2026, prev).col[0], 'RPI')
})

test('a row built from a thin response has the same key order as a fresh one', () => {
  const prev = { name: 'A', firstSeason: 2001, debut: 2001, birth: { city: 'Troy' }, col: ['Siena'] }
  const merged = Object.keys(slimPerson({ id: 1, fullName: 'A' }, 2026, prev))
  assert.deepEqual(merged, [...merged].sort())
})

test('isPending: a recent player with no debut date has not debuted; an old undated one is real', () => {
  assert.equal(isPending({ firstSeason: 2026 }), true)
  assert.equal(isPending({ firstSeason: 2026, debut: 2026 }), false)
  assert.equal(isPending({ firstSeason: 1938 }), false) // Negro Leagues era, no date on file
  assert.equal(isPending({ firstSeason: 1876 }), false)
})
