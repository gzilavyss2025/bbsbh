// lib/gamecard/cardText.js (#2969 follow-up): the words the card and its PNG
// share, so the two cannot disagree. The band's context line now carries the
// opponent and the result, so a shared image says who and how on its own.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contextLine, headline, decisionWord } from '../src/lib/gamecard/cardText.js'
import { buildPitcherGameCard } from '../src/api/pitcher/gameCard.js'

const feed = JSON.parse(readFileSync(new URL('./fixtures/game-813024.yamamoto.json', import.meta.url)))
const card = buildPitcherGameCard(feed, 808967)

test('the card knows which side the pitcher was on', () => {
  assert.equal(card.line.side, 'away')
})

test('context: round, date, the opponent (@ on the road) and his club\'s result with extra innings', () => {
  assert.equal(contextLine(card), 'WS · Nov 1, 2025 · @ TOR · W 5–4 (11)')
})

test('context: home side reads "vs", a loss reads L with his club\'s runs first, nine innings add nothing', () => {
  const home = {
    line: { side: 'home' },
    game: { round: '', date: 'Jul 7, 2026', away: { abbr: 'MIL', runs: 10 }, home: { abbr: 'STL', runs: 2 }, final: true, innings: null },
  }
  assert.equal(contextLine(home), 'Jul 7, 2026 · vs MIL · L 2–10')
})

test('context: a game not final shows no result, only the opponent', () => {
  const live = {
    line: { side: 'away' },
    game: { round: '', date: 'Jul 7, 2026', away: { abbr: 'MIL', runs: 3 }, home: { abbr: 'STL', runs: 1 }, final: false, innings: null },
  }
  assert.equal(contextLine(live), 'Jul 7, 2026 · @ STL')
})

test('headline: H, R (ER when it differs), BB, K, and HR only when he allowed one', () => {
  assert.equal(headline({ h: 4, r: 2, er: 2, bb: 1, k: 4, hr: 1 }), '4 H · 2 R · 1 BB · 4 K · 1 HR')
  assert.equal(headline({ h: 1, r: 3, er: 1, bb: 0, k: 2, hr: 0 }), '1 H · 3 R (1 ER) · 0 BB · 2 K')
})

test('the pitcher\'s decision is a word, so it cannot be read as the club\'s W/L in the band', () => {
  assert.equal(decisionWord('W'), 'Win')
  assert.equal(decisionWord('L'), 'Loss')
  assert.equal(decisionWord('S'), 'Save')
  assert.equal(decisionWord(''), '')
  assert.equal(decisionWord(undefined), '')
})
