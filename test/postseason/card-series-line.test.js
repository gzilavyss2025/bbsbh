// Slice 4 of #1224 (#1228): the slate card's two lines — GameCard and
// PastGameFlipCard render `cardLines(game, bracket)` verbatim (slice 3's
// text.js) and derive nothing themselves. This file is the card's own
// contract: each of the four record wordings, on slice 3's captured 2025
// postseason fixture, by the real gamePk the card would look up. 2025 has no
// series mark on file, so every card here carries `mark: null`.
import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { cardLines } from '../../src/api/postseason/text.js'
import { results, skeleton } from './fixtures.js'

const bracket2025 = (cutoff) => deriveBracket(skeleton(2025), results(2025), cutoff)

test('card line: "Game 1" — 2025-10-04 slate, MIL @ CHC NLDS Game 1', () => {
  assert.deepEqual(cardLines({ gamePk: 813047 }, bracket2025('2025-10-04')), {
    seriesLine: 'Game 1 · NLDS',
    gameLine: 'Game 1',
    recordLine: 'Game 1',
    mark: null,
  })
})

test('card line: "CHC leads 1–0" — 2025-10-01 slate, SD @ CHC NL Wild Card Game 2', () => {
  assert.deepEqual(cardLines({ gamePk: 813064 }, bracket2025('2025-10-01')), {
    seriesLine: 'Game 2 · NL Wild Card',
    gameLine: 'Game 2',
    recordLine: 'CHC leads 1–0',
    mark: null,
  })
})

test('card line: "Series tied 1–1" — 2025-10-07 slate, ALDS Game 3', () => {
  assert.deepEqual(cardLines({ gamePk: 813056 }, bracket2025('2025-10-07')), {
    seriesLine: 'Game 3 · ALDS',
    gameLine: 'Game 3',
    recordLine: 'Series tied 1–1',
    mark: null,
  })
})

test('card line: "Winner take all" — 2025-10-02 slate, NL Wild Card Game 3', () => {
  assert.deepEqual(cardLines({ gamePk: 813059 }, bracket2025('2025-10-02')), {
    seriesLine: 'Game 3 · NL Wild Card',
    gameLine: 'Game 3',
    recordLine: 'Winner take all',
    mark: null,
  })
})

test('a game not in the bracket (a regular-season slate) gets no card line', () => {
  assert.equal(cardLines({ gamePk: 1 }, bracket2025('2025-10-07')), null)
})

test('a 2026 series card carries its series mark', () => {
  // The 2025 fixture relabelled 2026: the mark reads the bracket's season,
  // and 2026 is the first season with art on file.
  const lines = cardLines({ gamePk: 813047 }, { ...bracket2025('2025-10-04'), season: 2026 })
  assert.deepEqual(lines.mark, { src: '/postseason-marks/2026/nlds.png', alt: 'NLDS' })
})
