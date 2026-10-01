// The survivors' board on the postseason home page (src/lib/postseason/
// survivors.js): all twelve clubs in fixed slots, each with its next game or
// the round it went out in. Same real, finished 2025 fixture as the other
// postseason tests (test/postseason/fixtures.js).
import assert from 'node:assert/strict'
import test from 'node:test'
import { roundShort, survivorLine, survivorsBoard, weekdayOf } from '../../src/lib/postseason/survivors.js'
import { bracket2025 } from './fixtures.js'

const lineOf = (board, abbr, slateDate) => {
  const slot = board.leagues.flatMap((l) => l.slots).find((s) => s.club.abbreviation === abbr)
  return survivorLine(slot, slateDate)
}

test('weekdayOf: fixed English names, independent of the machine time zone', () => {
  assert.equal(weekdayOf('2025-10-04'), 'Sat')
  assert.equal(weekdayOf('2026-10-01'), 'Thu')
})

test('survivorsBoard: twelve clubs, six per league, byes first, in the same order all month', () => {
  const first = survivorsBoard(bracket2025('2025-09-30'))
  const last = survivorsBoard(bracket2025('2025-11-03'))
  assert.equal(first.total, 12)
  assert.deepEqual(first.leagues.map((l) => l.key), ['AL', 'NL'])
  for (const l of first.leagues) assert.equal(l.slots.length, 6)
  const order = (b) => b.leagues.map((l) => l.slots.map((s) => s.club.abbreviation))
  assert.deepEqual(order(first), order(last), 'a club that goes out keeps its slot')
  assert.deepEqual(first.leagues[0].slots.slice(0, 2).map((s) => s.club.abbreviation).sort(), ['SEA', 'TOR'])
})

test('survivorsBoard: the count drops only once a series is decided before the cutoff', () => {
  assert.equal(survivorsBoard(bracket2025('2025-09-30')).alive, 12)
  // Heading into 2025-10-09: four Wild Card losers and NYY (ALDS) are out.
  assert.equal(survivorsBoard(bracket2025('2025-10-09')).alive, 7)
  assert.equal(survivorsBoard(bracket2025('2025-11-03')).alive, 1)
})

test('survivorLine: today, waiting, out and champion, heading into 2025-10-09', () => {
  const b = survivorsBoard(bracket2025('2025-10-09'))
  assert.equal(lineOf(b, 'MIL', '2025-10-09'), 'Today · Game 4')
  assert.equal(lineOf(b, 'TOR', '2025-10-09'), 'ALCS G1 · Sun')
  assert.equal(lineOf(b, 'NYY', '2025-10-09'), 'Out · ALDS')
  assert.equal(lineOf(b, 'CLE', '2025-10-09'), 'Out · Wild Card')
  assert.equal(lineOf(survivorsBoard(bracket2025('2025-11-03')), 'LAD'), 'Champions')
})

test('survivorLine: a slate paged past the cutoff never says "Today"', () => {
  const b = survivorsBoard(bracket2025('2025-10-09'))
  assert.equal(lineOf(b, 'MIL', '2025-10-10'), 'Game 4 · Thu')
})

test('survivorLine: a series that decides today is still alive on the board, both clubs', () => {
  // 2025 ALCS Game 7 was on 2025-10-20. Heading into it, both clubs stand.
  const b = survivorsBoard(bracket2025('2025-10-20'))
  assert.equal(lineOf(b, 'TOR', '2025-10-20'), 'Today · Game 7')
  assert.equal(lineOf(b, 'SEA', '2025-10-20'), 'Today · Game 7')
  assert.equal(b.alive, 3)
})

test('roundShort: the names a scorer writes', () => {
  assert.equal(roundShort({ round: 'wildcard', league: 'NL' }), 'Wild Card')
  assert.equal(roundShort({ round: 'division', league: 'AL' }), 'ALDS')
  assert.equal(roundShort({ round: 'lcs', league: 'NL' }), 'NLCS')
  assert.equal(roundShort({ round: 'worldseries', league: null }), 'World Series')
})

test('survivorsBoard: no bracket, no board', () => {
  assert.equal(survivorsBoard(null), null)
})
