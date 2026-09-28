// Slice 4 of #1224 (#1228): the slate card's two lines — GameCard and
// PastGameFlipCard render `cardLines(game, bracket)` verbatim (slice 3's
// text.js) and derive nothing themselves. This file is the card's own
// contract: each of the four record wordings, on slice 3's captured 2025
// postseason fixture, by the real gamePk the card would look up.
import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { cardLines } from '../../src/api/postseason/text.js'
import { results, skeleton } from './fixtures.js'

const bracket2025 = (cutoff) => deriveBracket(skeleton(2025), results(2025), cutoff)

test('card line: "Game 1" — 2025-10-04 slate, MIL @ CHC NLDS Game 1', () => {
  assert.deepEqual(cardLines({ gamePk: 813047 }, bracket2025('2025-10-04')), {
    seriesLine: 'Game 1 · NLDS',
    recordLine: 'Game 1',
  })
})

test('card line: "CHC leads 1–0" — 2025-10-01 slate, SD @ CHC NL Wild Card Game 2', () => {
  assert.deepEqual(cardLines({ gamePk: 813064 }, bracket2025('2025-10-01')), {
    seriesLine: 'Game 2 · NL Wild Card',
    recordLine: 'CHC leads 1–0',
  })
})

test('card line: "Series tied 1–1" — 2025-10-07 slate, ALDS Game 3', () => {
  assert.deepEqual(cardLines({ gamePk: 813056 }, bracket2025('2025-10-07')), {
    seriesLine: 'Game 3 · ALDS',
    recordLine: 'Series tied 1–1',
  })
})

test('card line: "Winner take all" — 2025-10-02 slate, NL Wild Card Game 3', () => {
  assert.deepEqual(cardLines({ gamePk: 813059 }, bracket2025('2025-10-02')), {
    seriesLine: 'Game 3 · NL Wild Card',
    recordLine: 'Winner take all',
  })
})

test('a game not in the bracket (a regular-season slate) gets no card line', () => {
  assert.equal(cardLines({ gamePk: 1 }, bracket2025('2025-10-07')), null)
})
