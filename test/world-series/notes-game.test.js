// wsLastTimeGame: the Final roll-up. The only result-aware World Series note.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWsLastTimeGameNotes } from '../../src/api/callout-notes/worldSeries/events.js'
import { computeGameCalloutNotes } from '../../src/api/callout-notes/rollup.js'
import { BETWEEN_INNINGS_ALLOWED_KINDS } from '../../src/api/between-innings.js'
import { SCORE_BASE } from '../../src/api/callout-notes/shared.js'
import { feedOf, playsOf, BUNDLE } from './ws-fixture.js'

const row = (tag, date, value = null) => ({ tag, pk: 1, date, season: Number(date.slice(0, 4)), n: 1, club: null, player: null, value, wta: false })
const game18 = (opts) => feedOf(playsOf(563409), { date: '2018-10-26', ...opts }) // 18 innings, Dodgers won 3-2
const texts = (feed, rows) => buildWsLastTimeGameNotes(feed, BUNDLE, { events: rows }).map((n) => n.text)

test('an 18-inning game names the last game that long, by date', () => {
  assert.deepEqual(texts(game18(), [row('extraInnings', '2005-10-26', 14), row('extraInnings', '2005-10-27', 18)]),
    ['The first World Series game of 18 or more innings since Oct. 27, 2005.'])
})

test('no earlier game that long: the first in World Series history', () => {
  assert.deepEqual(texts(game18(), [row('extraInnings', '2005-10-26', 14)]),
    ['The first game of 18 or more innings in World Series history.'])
})

test('a gap under three seasons gives no note', () => {
  assert.deepEqual(texts(game18(), [row('extraInnings', '2016-10-26', 18)]), [])
})

test('a row dated on or after the game never counts', () => {
  assert.deepEqual(texts(game18(), [row('extraInnings', '2018-10-26', 18), row('extraInnings', '2025-10-24', 18)]),
    ['The first game of 18 or more innings in World Series history.'])
})

test('Final only: the same feed in progress gives nothing', () => {
  assert.deepEqual(texts(game18({ final: false }), []), [])
})

test('the roll-up carries the note when Final and not before', () => {
  const kinds = (feed) => computeGameCalloutNotes(feed, BUNDLE, null, { events: [] }).map((n) => n.kind)
  assert.ok(kinds(game18()).includes('wsLastTimeGame'))
  assert.ok(!kinds(game18({ final: false })).includes('wsLastTimeGame'))
  assert.ok(!computeGameCalloutNotes(game18(), BUNDLE, null, null).some((n) => n.kind === 'wsLastTimeGame'), 'no history, no note')
})

test('a shutout is found by the same classifier, and names the club that did it', () => {
  const feed = feedOf(playsOf(67524), { date: '1956-10-08' })
  const [n] = buildWsLastTimeGameNotes(feed, BUNDLE, { events: [] })
  assert.match(n.text, /shutout/)
  assert.equal(n.kind, 'wsLastTimeGame')
  assert.equal(n.dedupeKey, 'wsLastTimeGame-shutout')
})

test('scores: the kinds are ranked, and none is allowed Between Innings', () => {
  assert.equal(SCORE_BASE.wsLastTimeGame, 45)
  assert.equal(SCORE_BASE.wsLastTime, 50)
  assert.equal(SCORE_BASE.wsWtaTrailing9, 55)
  for (const k of ['wsLastTime', 'wsLastTimeGame', 'wsWtaTrailing9']) assert.ok(!BETWEEN_INNINGS_ALLOWED_KINDS.has(k), k)
})
