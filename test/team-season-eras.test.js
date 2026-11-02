import test from 'node:test'
import assert from 'node:assert/strict'
import { seasonEras } from '../src/screens/team/next/top/seasonEras.js'

// #2599: the season sheet's groups, from the franchise-history spans. A span splits at every
// park change, so runs with the same name and league merge; the last run reaches the current
// season (the file ends at `through`, the season before today's). Newest first.
const BREWERS = [
  { from: 1969, to: 1969, name: 'Seattle Pilots', league: 'American League' },
  { from: 1970, to: 1997, name: 'Milwaukee Brewers', league: 'American League' },
  { from: 1998, to: 2000, name: 'Milwaukee Brewers', league: 'National League' },
  { from: 2001, to: 2025, name: 'Milwaukee Brewers', league: 'National League' },
]

test('the Brewers read three groups, 1969 to 2026, newest first', () => {
  const eras = seasonEras(BREWERS, 2026)
  assert.deepEqual(
    eras.map((e) => [e.name, e.league, e.from, e.to]),
    [
      ['Milwaukee Brewers', 'National League', 1998, 2026],
      ['Milwaukee Brewers', 'American League', 1970, 1997],
      ['Seattle Pilots', 'American League', 1969, 1969],
    ],
  )
  assert.deepEqual(eras[0].years.slice(0, 3), [2026, 2025, 2024])
  assert.equal(eras.reduce((n, e) => n + e.years.length, 0), 58)
})

test('no spans gives no groups', () => {
  assert.deepEqual(seasonEras([], 2026), [])
  assert.deepEqual(seasonEras(null, 2026), [])
})
