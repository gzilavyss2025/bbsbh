// The primer's small bracket: the two LCS and the World Series, from the
// derived bracket (ADR-0087, 2026-10-08 addendum). Real 2025 series:
//   2025-10-17  ALCS TOR 2, SEA 2 (Game 5 today), NLCS MIL 0, LAD 3 (Game 4 today)
//   2025-10-18  ALCS SEA leads 3–2, NLCS decided LAD 4–0, World Series has LAD only
//   2025-10-24  both LCS decided, World Series Game 1 today
//   2025-11-02  World Series decided LAD 4–3
import assert from 'node:assert/strict'
import test from 'node:test'
import { bracket2025 } from './fixtures.js'
import { bracketNow, roundFeed } from '../../src/lib/postseason/primer/bracketNow.js'

const abbrs = (box) => box.rows.map((r) => r.club?.abbreviation ?? null)

test('three boxes, AL slot first, then the NL, then the World Series', () => {
  const { boxes } = bracketNow(bracket2025('2025-10-17'))
  assert.deepEqual(boxes.map((b) => b.name), ['ALCS', 'NLCS', 'World Series'])
  assert.deepEqual(abbrs(boxes[0]), ['TOR', 'SEA'])
  assert.deepEqual(abbrs(boxes[1]), ['MIL', 'LAD'])
  assert.deepEqual(boxes[0].rows.map((r) => r.wins), [2, 2])
  assert.equal(boxes[0].winsNeeded, 4)
})

test('a series that plays today reads "Today · Game N"; the connector stays pencil', () => {
  const { boxes, links } = bracketNow(bracket2025('2025-10-17'))
  assert.equal(boxes[0].foot, 'Today · Game 5')
  assert.equal(boxes[1].foot, 'Today · Game 4')
  assert.equal(boxes[0].today, true)
  assert.deepEqual(links.map((l) => l.inked), [false, false])
})

test('a World Series slot with no club yet is an empty slot, never an invented club', () => {
  const { boxes } = bracketNow(bracket2025('2025-10-17'))
  const ws = boxes[2]
  assert.deepEqual(abbrs(ws), [null, null])
  assert.equal(ws.foot, '')
  const half = bracketNow(bracket2025('2025-10-18')).boxes[2]
  assert.deepEqual(abbrs(half), [null, 'LAD'])
})

test('a decided series flags its loser, inks its connector and names the score', () => {
  const { boxes, links } = bracketNow(bracket2025('2025-10-18'))
  assert.equal(boxes[1].decided, true)
  assert.equal(boxes[1].foot, 'LAD won 4–0')
  assert.deepEqual(boxes[1].rows.map((r) => r.eliminated), [true, false])
  assert.deepEqual(links.map((l) => l.inked), [false, true])
  assert.deepEqual(links.map((l) => l.league), ['AL', 'NL'])
})

test('an open series with no game today reads "Heading in"', () => {
  const { boxes } = bracketNow(bracket2025('2025-10-18'))
  assert.equal(boxes[0].foot, 'Heading in')
  assert.equal(boxes[0].today, false)
  assert.deepEqual(boxes[0].rows.map((r) => r.eliminated), [false, false])
})

test('World Series day: both connectors inked, both clubs placed, Game 1 today', () => {
  const { boxes, links } = bracketNow(bracket2025('2025-10-24'))
  assert.deepEqual(links.map((l) => l.inked), [true, true])
  assert.deepEqual(abbrs(boxes[2]), ['TOR', 'LAD'])
  assert.equal(boxes[2].foot, 'Today · Game 1')
})

test('a decided World Series flags the beaten club', () => {
  const { boxes } = bracketNow(bracket2025('2025-11-02'))
  assert.equal(boxes[2].foot, 'LAD won 4–3')
  assert.deepEqual(boxes[2].rows.map((r) => r.eliminated), [true, false])
})

test('a bracket missing an LCS or the World Series draws nothing', () => {
  assert.equal(bracketNow(null), null)
  const b = bracket2025('2025-10-17')
  assert.equal(bracketNow({ ...b, worldSeries: null }), null)
  assert.equal(bracketNow({ ...b, leagues: { ...b.leagues, NL: { ...b.leagues.NL, lcs: null } } }), null)
})

test('a Wild Card day: four series, AL first, each feeding its Division Series box', () => {
  const { from, to, links } = roundFeed(bracket2025('2025-09-30'), 'wildcard')
  assert.deepEqual(from.map((b) => b.league), ['AL', 'AL', 'NL', 'NL'])
  assert.equal(to.length, 4)
  assert.deepEqual(links.map((l) => l.to).sort(), [0, 1, 2, 3])
  assert.ok(from.every((b) => b.foot === 'Today \u00b7 Game 1'))
  // A Division Series box has the bye club, and a blank slot that names the series it waits on.
  const blank = to[0].rows.find((r) => !r.club)
  assert.equal(blank.feeder, 'AL Wild Card')
})

test('a Division Series day: four series feed two LCS boxes, two to a box', () => {
  const { from, to, links } = roundFeed(bracket2025('2025-10-08'), 'division')
  assert.equal(from.length, 4)
  assert.deepEqual(to.map((b) => b.name), ['ALCS', 'NLCS'])
  assert.deepEqual(links.map((l) => l.to), [0, 0, 1, 1])
})

test('no round to draw gives null', () => {
  assert.equal(roundFeed(null, 'division'), null)
  assert.equal(roundFeed({ leagues: {}, series: [] }, 'wildcard'), null)
})
