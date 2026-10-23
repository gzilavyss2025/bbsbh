import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nameForSeason } from '../src/api/franchiseHistory.js'

// The club's name by season, from the spans of public/data/franchise-history (#2590). The team
// id never changes; the name does (the 1969 Seattle Pilots are club 158, the 2000 Expos club 120).
const BREWERS = [
  { from: 1969, to: 1969, name: 'Seattle Pilots' },
  { from: 1970, to: 2025, name: 'Milwaukee Brewers' },
]
const EXPOS = [
  { from: 1969, to: 2004, name: 'Montreal Expos' },
  { from: 2005, to: 2025, name: 'Washington Nationals' },
]

test('nameForSeason: the name of the span a season falls in', () => {
  assert.equal(nameForSeason(BREWERS, 1969), 'Seattle Pilots')
  assert.equal(nameForSeason(BREWERS, 1970), 'Milwaukee Brewers')
  assert.equal(nameForSeason(BREWERS, 2018), 'Milwaukee Brewers')
  assert.equal(nameForSeason(EXPOS, 2000), 'Montreal Expos')
  assert.equal(nameForSeason(EXPOS, 2005), 'Washington Nationals')
})

test('nameForSeason: a season after the data uses the last span', () => {
  assert.equal(nameForSeason(BREWERS, 2026), 'Milwaukee Brewers')
  assert.equal(nameForSeason(EXPOS, 2030), 'Washington Nationals')
})

test('nameForSeason: null before the data, in a gap, or with no spans', () => {
  assert.equal(nameForSeason(BREWERS, 1968), null)
  assert.equal(nameForSeason([{ from: 1990, to: 1995, name: 'A' }, { from: 2000, to: 2005, name: 'B' }], 1997), null)
  assert.equal(nameForSeason([], 2018), null)
  assert.equal(nameForSeason(undefined, 2018), null)
})
