import assert from 'node:assert/strict'
import test from 'node:test'
import { centuryClubFromRows } from '../scripts/lib/century-club.mjs'

const row = (personId, level, code, description, centuryPitches, maxVelo) => ({
  person_id: personId,
  level,
  code,
  description,
  century_pitches: centuryPitches,
  max_velo: maxVelo,
})

test('centuryClubFromRows sums count and tracks the type most-thrown first', () => {
  const byKey = centuryClubFromRows([
    row(555, 'mlb', 'FF', 'Four-Seam Fastball', 40, 103.4),
    row(555, 'mlb', 'SL', 'Slider', 9, 101.0),
  ])
  const e = byKey.get('mlb:555')
  assert.equal(e.count, 49)
  assert.equal(e.types[0].code, 'FF', 'most-thrown type sorts first')
  assert.equal(e.seasonMaxVelo, 103.4)
})

test('centuryClubFromRows keeps mlb and aaa rows for the same pitcher separate', () => {
  const byKey = centuryClubFromRows([
    row(555, 'mlb', 'FF', 'Four-Seam Fastball', 10, 101.0),
    row(555, 'aaa', 'FF', 'Four-Seam Fastball', 3, 100.2),
  ])
  assert.equal(byKey.get('mlb:555').count, 10)
  assert.equal(byKey.get('aaa:555').count, 3)
})

test('centuryClubFromRows never lowers seasonMaxVelo across types', () => {
  const byKey = centuryClubFromRows([
    row(555, 'mlb', 'SI', 'Sinker', 5, 100.1),
    row(555, 'mlb', 'FF', 'Four-Seam Fastball', 20, 102.7),
  ])
  assert.equal(byKey.get('mlb:555').seasonMaxVelo, 102.7)
})

test('centuryClubFromRows returns an empty map for no rows', () => {
  assert.equal(centuryClubFromRows([]).size, 0)
})
