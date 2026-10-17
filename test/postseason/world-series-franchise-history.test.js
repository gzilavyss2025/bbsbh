import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { franchiseHistory } from '../../src/lib/postseason/worldseries/franchiseHistory.js'

const FILE = JSON.parse(readFileSync(new URL('../../public/data/world-series/series.json', import.meta.url), 'utf8')).series
// Every MLB club id: 108-121, 133-147, 158.
const MLB_IDS = [...Array(14).keys()].map((i) => 108 + i).concat([...Array(15).keys()].map((i) => 133 + i), [158])

test('all 30 MLB club ids resolve without throwing', () => {
  assert.equal(MLB_IDS.length, 30)
  for (const id of MLB_IDS) {
    const h = franchiseHistory(FILE, id, { before: '2026-10-17' })
    assert.ok('lastWs' in h && 'lastTitle' in h, String(id))
  }
})

test('the Mariners (136) have never played a Series: null for both', () => {
  assert.deepEqual(franchiseHistory(FILE, 136, { before: '2026-10-17' }), { lastWs: null, lastTitle: null })
})

test('real file: Dodgers last title 2025, Blue Jays last Series 2025 and title 1993, Padres no title', () => {
  assert.deepEqual(franchiseHistory(FILE, 119, { before: '2026-10-17' }), { lastWs: 2025, lastTitle: 2025 })
  assert.deepEqual(franchiseHistory(FILE, 141, { before: '2026-10-17' }), { lastWs: 2025, lastTitle: 1993 })
  assert.equal(franchiseHistory(FILE, 135, { before: '2026-10-17' }).lastTitle, null)
})

test('a Series from the slate date\'s own season is never counted', () => {
  const fixture = [
    { season: 2019, clubs: [119, 141], winner: 141 },
    { season: 2026, clubs: [119, 141], winner: 119 },
  ]
  assert.deepEqual(franchiseHistory(fixture, 119, { before: '2026-10-17' }), { lastWs: 2019, lastTitle: null })
  assert.deepEqual(franchiseHistory(fixture, 141, { before: '2026-10-17' }), { lastWs: 2019, lastTitle: 2019 })
})

test('a missing or malformed `before` throws, never falls open', () => {
  assert.throws(() => franchiseHistory(FILE, 119), /before/)
  assert.throws(() => franchiseHistory(FILE, 119, { before: '2026' }), /before/)
})
