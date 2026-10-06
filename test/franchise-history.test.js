import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collapseSeasons, venueMates } from '../scripts/lib/franchise-history.mjs'
import { parkHistory } from '../src/api/franchiseHistory.js'

// A hand-made 1968-1999 club: a rename (1969 Pilots -> 1970 Brewers), a league move
// (1998 AL -> NL) and a park move (1996, venue 23 -> 99). 1968 has no row, and
// 1985 is missing too, so a gap must split a span. Venue 23 is renamed in 1990.
function sample() {
  const rows = []
  for (let season = 1968; season <= 1999; season++) {
    if (season === 1968 || season === 1985) continue
    const row = { season, name: 'Milwaukee Brewers', league: 'American League', venueId: 23, venueName: 'County Stadium' }
    if (season === 1969) Object.assign(row, { name: 'Seattle Pilots', venueId: 5, venueName: "Sick's Stadium" })
    if (season >= 1990) row.venueName = 'County Stadium II'
    if (season >= 1996) Object.assign(row, { venueId: 99, venueName: 'New Park' })
    if (season >= 1998) row.league = 'National League'
    rows.push(row)
  }
  return rows
}

test('collapseSeasons: rename, league move, park move and a gap each start a span', () => {
  const spans = collapseSeasons(sample())
  const key = spans.map((s) => `${s.from}-${s.to} ${s.name} ${s.league[0]} v${s.venueId}`)
  assert.deepEqual(key, [
    '1969-1969 Seattle Pilots A v5',
    '1970-1984 Milwaukee Brewers A v23',
    '1986-1995 Milwaukee Brewers A v23',
    '1996-1997 Milwaukee Brewers A v99',
    '1998-1999 Milwaukee Brewers N v99',
  ])
})

test('collapseSeasons: a venue renamed inside a span keeps every name, newest in venueName', () => {
  const span = collapseSeasons(sample()).find((s) => s.from === 1986)
  assert.deepEqual(span.venueNames, ['County Stadium', 'County Stadium II'])
  assert.equal(span.venueName, 'County Stadium II')
})

test('collapseSeasons: unsorted input and no rows', () => {
  assert.equal(collapseSeasons([]).length, 0)
  const spans = collapseSeasons(sample().reverse())
  assert.equal(spans[0].from, 1969)
})

const row = (season, venueId, venueName = `V${venueId}`) => ({ season, name: 'X', league: 'NL', venueId, venueName })
const run = (from, to, venueId) => Array.from({ length: to - from + 1 }, (_, i) => row(from + i, venueId))

test('venueMates: lists other clubs only for the seasons both used the venue', () => {
  const byTeam = {
    1: [...run(1900, 1930, 7)],
    2: [...run(1913, 1922, 7), ...run(1923, 1930, 8)],
    3: [...run(1940, 1950, 7)],
  }
  const m1 = venueMates(1, byTeam)
  assert.deepEqual(m1[7], [{ teamId: 2, name: 'X', from: 1913, to: 1922 }])
  assert.deepEqual(venueMates(2, byTeam)[7], [{ teamId: 1, name: 'X', from: 1913, to: 1922 }])
  assert.equal(venueMates(3, byTeam)[7], undefined, 'no overlap, no entry')
  assert.equal(venueMates(2, byTeam)[8], undefined)
})

test('venueMates: a shared run with a gap is two ranges', () => {
  const byTeam = { 1: run(1900, 1910, 7), 2: [...run(1900, 1902, 7), ...run(1905, 1906, 7)] }
  assert.deepEqual(venueMates(1, byTeam)[7], [
    { teamId: 2, name: 'X', from: 1900, to: 1902 },
    { teamId: 2, name: 'X', from: 1905, to: 1906 },
  ])
})

test('parkHistory: groups by venue, keeps names, first/last season and co-tenants', () => {
  const spans = collapseSeasons(sample())
  const parks = parkHistory(spans, { 23: [{ teamId: 2, from: 1970, to: 1971 }] })
  assert.deepEqual(parks.map((p) => p.venueId), [5, 23, 99])
  const p23 = parks[1]
  assert.deepEqual(p23.runs, [[1970, 1984], [1986, 1995]])
  assert.deepEqual(p23.names, ['County Stadium', 'County Stadium II'])
  assert.deepEqual(p23.mates, [{ teamId: 2, from: 1970, to: 1971 }])
})

test('parkHistory: a span with no venue id is skipped, empty input gives none', () => {
  assert.deepEqual(parkHistory([], {}), [])
  const spans = [{ from: 1901, to: 1902, name: 'X', league: 'NL', venueId: null, venueName: '', venueNames: [] }]
  assert.deepEqual(parkHistory(spans, {}), [])
})

test('parkHistory: a park left and returned to keeps two runs, not one long range', () => {
  const rows = [...run(1923, 1973, 9), ...run(1974, 1975, 25), ...run(1976, 2008, 9)]
  const parks = parkHistory(collapseSeasons(rows), {})
  assert.deepEqual(parks.map((p) => [p.venueId, p.runs]), [
    [9, [[1923, 1973], [1976, 2008]]],
    [25, [[1974, 1975]]],
  ])
})
