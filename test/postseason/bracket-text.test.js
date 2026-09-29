// Test 5 of #1227: the slate card's two lines, from a slate game row plus the
// derived bracket. The record line is the state HEADING INTO the cutoff date,
// neutral to both clubs: "Game 1", "CHC leads 1–0", "Series tied 1–1",
// "Winner take all" (each club one win from taking the series).
import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { bestOfLine, cardLines, gameStatusLine, recordLine, seriesLine } from '../../src/api/postseason/text.js'
import { results, seriesWith, skeleton } from './fixtures.js'

const bracket2025 = (cutoff) => deriveBracket(skeleton(2025), results(2025), cutoff)

test('test 5: "Game 1" before a series has a result', () => {
  const b = deriveBracket(skeleton(2026), [], '2026-09-29')
  for (const s of b.leagues.NL.wildcard) assert.equal(recordLine(s), 'Game 1')
  // Heading into 2025-10-04 each Division Series is 0-0.
  assert.equal(recordLine(seriesWith(bracket2025('2025-10-04'), 'NL', 'division', 'MIL')), 'Game 1')
})

test('test 5: "CHC leads 1–0" names the leader by abbreviation, en dash, leader first', () => {
  // 2025 NL Wild Card: CHC won Game 1 at home on 09-30.
  const s = seriesWith(bracket2025('2025-10-01'), 'NL', 'wildcard', 'CHC')
  assert.equal(recordLine(s), 'CHC leads 1–0')
  // 2025 NLDS heading into 10-09: MIL 2, CHC 1.
  assert.equal(recordLine(seriesWith(bracket2025('2025-10-09'), 'NL', 'division', 'MIL')), 'MIL leads 2–1')
})

test('test 5: "Series tied 1–1" when level and neither club is one win away', () => {
  // 2025 ALDS DET-SEA: DET won Game 1, SEA Game 2.
  assert.equal(recordLine(seriesWith(bracket2025('2025-10-07'), 'AL', 'division', 'SEA')), 'Series tied 1–1')
})

test('test 5: "Winner take all" when each club is one win from taking the series', () => {
  // Best of 3 at 1-1 (2025 NL Wild Card CHC-SD heading into Game 3).
  assert.equal(recordLine(seriesWith(bracket2025('2025-10-02'), 'NL', 'wildcard', 'CHC')), 'Winner take all')
  // Best of 5 at 2-2 (2025 ALDS SEA-DET heading into 10-09, and into Game 5 on 10-10).
  assert.equal(recordLine(seriesWith(bracket2025('2025-10-09'), 'AL', 'division', 'SEA')), 'Winner take all')
  // Best of 7 at 3-3 (2025 World Series heading into Game 7).
  assert.equal(recordLine(bracket2025('2025-11-01').worldSeries), 'Winner take all')
})

test('test 5: a decided series reads as won', () => {
  assert.equal(recordLine(seriesWith(bracket2025('2025-10-09'), 'AL', 'division', 'TOR')), 'TOR won 3–1')
  assert.equal(recordLine(null), '')
})

test('the series line drops "Series" from every round but the World Series itself (Gary, 2026-09-28)', () => {
  const wc = seriesWith(bracket2025('2025-10-01'), 'NL', 'wildcard', 'CHC')
  assert.equal(seriesLine(wc, 2), 'Game 2 · NL Wild Card')
  const b = bracket2025('2025-10-24')
  const ds = seriesWith(b, 'AL', 'division', 'TOR')
  assert.equal(seriesLine(ds, 3), 'Game 3 · ALDS')
  assert.equal(seriesLine(b.leagues.NL.lcs, 5), 'Game 5 · NLCS')
  assert.equal(seriesLine(b.worldSeries, 1), 'Game 1 · World Series')
})

test('cardLines reads a slate game row by gamePk: its game number and the heading-in record', () => {
  // 2025-10-01 slate: SD @ CHC, NL Wild Card Game 2 (gamePk 813064).
  assert.deepEqual(cardLines({ gamePk: 813064 }, bracket2025('2025-10-01')), {
    seriesLine: 'Game 2 · NL Wild Card',
    gameLine: 'Game 2',
    recordLine: 'CHC leads 1–0',
    mark: null, // 2025 has no series mark on file
  })
  // 2025-10-09 slate: MIL @ CHC, NLDS Game 4 (813050).
  assert.deepEqual(cardLines({ gamePk: 813050 }, bracket2025('2025-10-09')), {
    seriesLine: 'Game 4 · NLDS',
    gameLine: 'Game 4',
    recordLine: 'MIL leads 2–1',
    mark: null, // 2025 has no series mark on file
  })
  // A regular-season game, or no bracket: no lines.
  assert.equal(cardLines({ gamePk: 1 }, bracket2025('2025-10-09')), null)
  assert.equal(cardLines({ gamePk: 813050 }, null), null)
})

test("cardLines on the cutoff date never shows that game's own result", () => {
  // 2025-10-05: ALDS Game 2 SEA-DET went Final that day (SEA won). The card
  // on the 10-05 slate still reads the state heading in.
  assert.deepEqual(cardLines({ gamePk: 813057 }, bracket2025('2025-10-05')), {
    seriesLine: 'Game 2 · ALDS',
    gameLine: 'Game 2',
    recordLine: 'DET leads 1–0',
    mark: null, // 2025 has no series mark on file
  })
})

test('gameStatusLine: number plus the series heading into the game, by nickname', () => {
  const wc = (cutoff) => seriesWith(bracket2025(cutoff), 'NL', 'wildcard', 'CHC')
  assert.equal(gameStatusLine(wc('2025-09-30'), 1), 'Game 1 · Series Tied, 0–0')
  assert.equal(gameStatusLine(wc('2025-10-01'), 2), 'Game 2 · Cubs Lead 1–0')
  const ds = seriesWith(bracket2025('2025-10-09'), 'NL', 'division', 'MIL')
  assert.equal(gameStatusLine(ds, 4), 'Game 4 · Brewers Lead 2–1')
  assert.equal(gameStatusLine(seriesWith(bracket2025('2025-10-07'), 'AL', 'division', 'SEA'), 3), 'Game 3 · Series Tied, 1–1')
})

test('gameStatusLine: empty for a decided series, a missing series or no game number', () => {
  const decided = seriesWith(bracket2025('2025-10-05'), 'NL', 'wildcard', 'CHC')
  assert.equal(decided.decided, true)
  assert.equal(gameStatusLine(decided, 3), '')
  assert.equal(gameStatusLine(null, 1), '')
  assert.equal(gameStatusLine(seriesWith(bracket2025('2025-10-01'), 'NL', 'wildcard', 'CHC'), 0), '')
})

test('bestOfLine: the series length, from the skeleton', () => {
  const b = deriveBracket(skeleton(2026), [], '2026-09-29')
  assert.equal(bestOfLine(b.leagues.NL.wildcard[0]), 'Best of 3')
  assert.equal(bestOfLine(null), '')
})
