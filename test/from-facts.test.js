import assert from 'node:assert/strict'
import test from 'node:test'
import { balanceColumns, decadeGroups, placeFacts, placeSubtitle } from '../src/lib/from/facts.js'

// The numbers on a place page (#1526, SPEC §7.4). A player is [id, name, pos, debutYear].
const P = (id, name, pos, year) => [id, name, pos, year]

test('decadeGroups: the newest decade first, the newest debut first inside it, then the name', () => {
  const groups = decadeGroups([
    P(1, 'Zed', 'P', 1988), P(2, 'Amy', 'C', 1988), P(3, 'Old', 'P', 1888), P(4, 'New', 'SS', 2019), P(5, 'Mid', 'CF', 1991),
  ])
  assert.deepEqual(groups.map((g) => g.decade), [2010, 1990, 1980, 1880])
  assert.deepEqual(groups[2].players.map((p) => p[1]), ['Amy', 'Zed']) // same year: by name
  assert.deepEqual(decadeGroups([P(1, 'A', 'P', 1999), P(2, 'B', 'P', 1990)])[0].players.map((p) => p[3]), [1999, 1990])
})

test('a debut on a decade boundary goes in its own decade', () => {
  assert.deepEqual(decadeGroups([P(1, 'A', 'P', 2000), P(2, 'B', 'P', 1999)]).map((g) => g.decade), [2000, 1990])
})

test('placeFacts: the count, the years, the decades and the busiest decade', () => {
  const f = placeFacts([P(1, 'A', 'P', 1988), P(2, 'B', 'P', 1989), P(3, 'C', 'SS', 1991), P(4, 'D', 'X', 2026), P(5, 'E', 'TWP', 1987)])
  assert.equal(f.count, 5)
  assert.equal(f.first, 1987)
  assert.equal(f.latest, 2026)
  assert.equal(f.decades, 3)
  assert.deepEqual(f.tile, { label: 'Busiest decade', value: 3, caption: 'The 1980s' })
  assert.deepEqual(f.newest, { year: 2026, n: 1 })
})

test('pitchers are P and TWP; everyone else, an unknown position too, is a hitter', () => {
  const f = placeFacts([P(1, 'A', 'P', 2000), P(2, 'B', 'TWP', 2000), P(3, 'C', 'X', 2000), P(4, 'D', 'LF', 2000), P(5, 'E', 'DH', 2000)])
  assert.equal(f.pitchers, 2)
  assert.equal(f.hitters, 3)
})

test('a tie for the busiest decade goes to the newer one', () => {
  const f = placeFacts([P(1, 'A', 'P', 1985), P(2, 'B', 'P', 1986), P(3, 'C', 'P', 2005), P(4, 'D', 'P', 2006)])
  assert.equal(f.tile.caption, 'The 2000s')
})

test('when every decade has one player the second tile is the span', () => {
  const f = placeFacts([P(1, 'A', 'P', 1888), P(2, 'B', 'P', 1913), P(3, 'C', 'P', 1930)])
  assert.deepEqual(f.tile, { label: 'Span', value: 42, caption: 'Years, first debut to latest' })
})

test('one player is the busiest decade, not a span of nothing', () => {
  const f = placeFacts([P(1, 'A', 'P', 1999)])
  assert.deepEqual(f.tile, { label: 'Busiest decade', value: 1, caption: 'The 1990s' })
  assert.equal(f.count, 1)
  assert.equal(placeFacts([]), null)
})

test('placeSubtitle follows SPEC §3', () => {
  assert.equal(placeSubtitle('college', { city: 'Nashville', state: 'TN' }), 'Nashville, TN · College')
  assert.equal(placeSubtitle('college', { state: 'TN' }), 'TN · College')
  assert.equal(placeSubtitle('college', {}), 'College')
  assert.equal(placeSubtitle('high-school', { city: 'Smyrna', state: 'TN' }), 'Smyrna, TN · High school')
  assert.equal(placeSubtitle('high-school', { state: 'TN' }), 'TN · High school')
  assert.equal(placeSubtitle('hometown', { name: 'Donora', state: 'PA' }), 'Donora, PA · Birthplace')
  assert.equal(placeSubtitle('abroad', { name: 'Santo Domingo', countryName: 'Dominican Republic' }), 'Santo Domingo, Dominican Republic · Birthplace')
})

test('balanceColumns puts each card in the column with fewer rows so far', () => {
  const cards = [{ n: 15 }, { n: 24 }, { n: 6 }, { n: 3 }, { n: 5 }, { n: 4 }]
  const [left, right] = balanceColumns(cards, 2, (c) => c.n)
  // 15 left; 24 right (0 < 15); 6 left (15 < 24); 3 left (21 < 24); 5 left (a tie goes left); 4 right
  assert.deepEqual(left.map((c) => c.n), [15, 6, 3, 5])
  assert.deepEqual(right.map((c) => c.n), [24, 4])
  assert.equal(balanceColumns(cards, 1, (c) => c.n)[0].length, 6)
  assert.equal(balanceColumns(cards, 0, (c) => c.n).length, 1)
  assert.deepEqual(balanceColumns([], 2, () => 1), [[], []])
})

test('balanceColumns keeps the original order inside a column', () => {
  const cards = Array.from({ length: 8 }, (_, i) => ({ i, n: 1 }))
  const [a, b] = balanceColumns(cards, 2, (c) => c.n)
  assert.deepEqual(a.map((c) => c.i), [0, 2, 4, 6])
  assert.deepEqual(b.map((c) => c.i), [1, 3, 5, 7])
})
