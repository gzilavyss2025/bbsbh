// /research reads the 1961-2014 history store (#3150): src/api/research/history.js
// decodes it into the Savant PA shape, filters.js and store.js read both.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeHistory, historyEvent, historyGames, historySeasons, pitchCounts } from '../src/api/research/history.js'
import { countBit } from '../src/api/research/shard.js'
import { matcher, parseQuery, seasonsFor, unsupported } from '../src/api/research/filters.js'
import { coverage } from '../src/api/research/store.js'
import { namesInRange } from '../src/screens/research/useEraClubNames.js'

const PA_COLS = ['gamePk', 'ab', 'batter', 'pitcher', 'event', 'inn', 'half', 'outs', 'bases', 'balls', 'strikes', 'stand', 'throws', 'bsd', 'slot', 'hit', 'rbi', 'fl']
const file = (cols, rows) => ({ cols, c: cols.map((_, i) => rows.map((r) => r[i])) })

test('Retrosheet event types and flags map to the PA result values', () => {
  assert.equal(historyEvent(23), 'home_run')
  assert.equal(historyEvent(20), 'single')
  assert.equal(historyEvent(14), 'walk')
  assert.equal(historyEvent(15), 'intent_walk')
  assert.equal(historyEvent(16), 'hit_by_pitch')
  assert.equal(historyEvent(18), 'field_error')
  assert.equal(historyEvent(19), 'fielders_choice')
  assert.equal(historyEvent(3), 'strikeout')
  assert.equal(historyEvent(3, 4), 'strikeout_double_play')
  assert.equal(historyEvent(2), 'field_out')
  assert.equal(historyEvent(2, 4), 'double_play')
  assert.equal(historyEvent(2, 8 | 4), 'triple_play')
  assert.equal(historyEvent(2, 2), 'sac_fly')
  assert.equal(historyEvent(2, 1), 'sac_bunt')
})

test('a pitch string gives the counts each pitch was thrown in', () => {
  // B (1-0), F (1-1), F stays at 1-2 after two strikes, X in play at 1-2.
  const mask = pitchCounts('BFFFX')
  for (const [b, s] of [[0, 0], [1, 0], [1, 1], [1, 2]]) assert.ok(mask & countBit(b, s), `${b}-${s}`)
  assert.ok(!(mask & countBit(2, 0)))
  // Pickoff throws and markers are not pitches.
  assert.equal(pitchCounts('1B.>BX'), countBit(0, 0) | countBit(1, 0) | countBit(2, 0))
  assert.equal(pitchCounts(''), 0)
  assert.equal(pitchCounts('BUX'), 0, 'an unknown pitch leaves the count unknown')
})

const GAMES = historyGames(file(['gamePk', 'date', 'home', 'away', 'park', 'venue', 'num', 'night', 'dh', 'pitches', 'homeRuns', 'awayRuns'], [
  [100, '1987-07-04', 120, 158, 'MON02', 22, 0, 1, 0, 2, 4, 3],
]))

// Expos (120) host the Brewers (158): a top-1st strikeout, then down 1 in the 9th a homer
// ties it and a single walks off (final 4-3).
const MONTH = decodeHistory(file(PA_COLS, [
  [100, 1, 11, 21, 3, 1, 0, 0, 0, 1, 2, 'R', 'R', 0, 1, 0, 0, 0],
  [100, 2, 12, 22, 23, 9, 1, 0, 0, null, null, 'L', 'R', -1, 4, 4, 1, 0],
  [100, 3, 13, 22, 20, 9, 1, 2, 2, 0, 0, 'R', 'R', 0, 6, 1, 1, 0],
]), { pseq: ['BCFS', '', 'X'] }, GAMES)

test('a history month decodes into the Savant PA shape', () => {
  assert.equal(MONTH.length, 3)
  const [k, hr, single] = MONTH
  assert.equal(k.event, 'strikeout')
  assert.equal(k.date, '1987-07-04')
  assert.equal(k.home, 'WSH', 'the Expos read as their club id’s abbreviation')
  assert.equal(k.batTeam, 'MIL')
  assert.equal(k.gameType, 'R')
  assert.deepEqual(k.count, [1, 2])
  assert.deepEqual(hr.count, [null, null], 'an unknown count stays null')
  assert.equal(hr.counts, 0)
  assert.equal(k.first, true)
  assert.equal(single.last, true)
  // Margins after: the next PA's margin from the batting side, the final score last.
  assert.equal(k.marginAfter, 1, 'flipped from the home side’s -1')
  assert.equal(hr.marginAfter, 0)
  assert.equal(single.marginAfter, 1)
})

test('history PAs answer the cards they hold data for', () => {
  const hits = (search) => MONTH.filter(matcher(parseQuery(search))).map((p) => p.atBat)
  assert.deepEqual(hits('?mom=walkoff'), [3])
  assert.deepEqual(hits('?mom=tie'), [2])
  assert.deepEqual(hits('?cnt=1-1'), [1])
  assert.deepEqual(hits('?cnt=behind'), [1])
  assert.deepEqual(hits('?team=WSH&res=home_run'), [2])
  assert.deepEqual(hits('?park=WSH'), [1, 2, 3])
  assert.deepEqual(hits('?slot=6'), [3])
})

test('pitch-tracking cards are blocked for any range that starts before 2015', () => {
  const keys = unsupported(2014).map((b) => b.key)
  for (const k of ['pt', 'loc', 'fld', 'bb']) assert.ok(keys.includes(k), k)
  assert.ok(!keys.includes('cnt'))
  assert.ok(!keys.includes('mom'))
  assert.deepEqual(unsupported(2015, 2), [])
})

test('history seasons are searched only by a range that reaches them', () => {
  const on = [1987, 1988, 2014, 2015, 2016]
  assert.deepEqual(seasonsFor(parseQuery('?res=home_run'), on, null), [2016, 2015])
  assert.deepEqual(seasonsFor(parseQuery('?ask=often&res=home_run'), on, null), [2016])
  assert.deepEqual(seasonsFor(parseQuery('?res=home_run&yr=1987-2015'), on, null), [2015, 2014, 1988, 1987])
})

test('coverage credits Retrosheet and names the seasons with thin pitch strings', () => {
  const seasons = historySeasons({ seasons: { 1987: { pitchString: 1.5, months: { '07': { pas: 3, through: '1987-07-31' } } }, 1988: { pitchString: 95, months: { '07': { pas: 3, through: '1988-07-31' } } } } })
  const ix = { seasons: { ...seasons, 2015: { months: { '04': { pas: 1, through: '2015-04-30', pitches: 10 } } } } }
  const c = coverage(ix, [1987, 1988])
  assert.equal(c.history, true)
  assert.deepEqual(c.thinCounts, [1987])
  assert.equal(coverage(ix, [2015]).history, false)
})

test('a club’s names across a range, oldest first', () => {
  const spans = [{ from: 1969, to: 2004, name: 'Montreal Expos' }, { from: 2005, to: 2025, name: 'Washington Nationals' }]
  assert.deepEqual(namesInRange(spans, 1987, 2010), ['Montreal Expos', 'Washington Nationals'])
  assert.deepEqual(namesInRange(spans, 1987, 1990), ['Montreal Expos'])
})
