// THE MACHINE-READABLE HALF OF ADR-0046: no timing before a reveal may be a
// function of the reveal.
//
// The rule is easy to state and easy to break by accident, and the break is
// invisible in review — one innocent-looking import of `derive.js` or
// `linescore.js` in beats.js, one `entry.rbi > 3 ? 260 : 180`, and the length
// of the hold before the scorebook mark prints starts announcing the play
// before the mark lands. Every seal on the screen would still be intact.
//
// So the structural assertion below is the point of this file, not decoration:
// beats.js must import NOTHING. A module with no imports cannot reach a feed,
// which means no value in it can be derived from one, which means every
// duration in the app's scoring loop is a literal a human typed. The rest of
// the tests pin the arithmetic those literals feed and the one predicate that
// decides whether the bar's last action is named as an act or a destination.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  CLOSE_SEQUENCE_MS,
  DENOTATION_HOLD_MS,
  INK_SET_MS,
  TALLY_CELL_COUNT,
  TALLY_STAGGER_MS,
  bookIsClosed,
} from '../src/components/inning/focus/beats.js'

const SOURCE = readFileSync(
  new URL('../src/components/inning/focus/beats.js', import.meta.url),
  'utf8',
)

test('beats.js imports nothing, so no timing can be derived from a feed', () => {
  // Comments are stripped first: this file's own header quotes module names
  // (`derive.js`, `linescore.js`) in prose, and so does beats.js's.
  const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.equal(
    /^\s*import\b/m.test(code),
    false,
    'beats.js grew an import. Read ADR-0046 before adding one: a module that ' +
      'can reach a feed is a module whose durations can be derived from one.',
  )
  assert.equal(/\brequire\s*\(/.test(code), false, 'beats.js grew a require()')
})

test('every beat is a plain positive number', () => {
  for (const [name, value] of Object.entries({
    DENOTATION_HOLD_MS,
    INK_SET_MS,
    TALLY_STAGGER_MS,
    CLOSE_SEQUENCE_MS,
  })) {
    assert.equal(typeof value, 'number', `${name} is not a number`)
    assert.ok(Number.isFinite(value) && value > 0, `${name} is not a positive finite number`)
  }
})

test('the close sequence lasts exactly as long as the tally cells take to ink in', () => {
  // The bar's forward action is held for CLOSE_SEQUENCE_MS. If this drifts
  // shorter than the animation it is covering, the last cell inks in after
  // the reader can already page away from it.
  assert.equal(CLOSE_SEQUENCE_MS, (TALLY_CELL_COUNT - 1) * TALLY_STAGGER_MS)
  assert.equal(
    TALLY_CELL_COUNT,
    8,
    'R, H, E, LOB, Pitches, Whiffs, Fouls, 1st-pitch strikes — HalfTally.jsx draws exactly eight',
  )
})

test('the book is closed once the reveal mark reaches the last half played', () => {
  // A nine-inning game the home team won in the bottom of the 9th:
  // finalHalfIndex 17.
  assert.equal(bookIsClosed(17, 17), true)
  assert.equal(bookIsClosed(16, 17), false)
})

test('a game whose bottom half was never played still closes the book', () => {
  // The home team was already ahead, so the bottom of the 9th was skipped
  // (selectSkippedBottomHalf) and finalHalfIndex is the TOP of the 9th, 16.
  // `>=` rather than `===` is what makes this work — and is why the comparison
  // is a named function rather than a `===` typed at a call site.
  assert.equal(bookIsClosed(16, 16), true)
  assert.equal(bookIsClosed(17, 16), true)
})

test('a game still headed for extras keeps the ordinary "Box score" label at the bottom of the 9th', () => {
  // THE SPOILER CASE. The reader has just revealed the bottom of the 9th (17)
  // of a game that in fact ran to the bottom of the 10th (19). If the label
  // changed here, it would answer "is there a 10th?" — the exact question the
  // reader has not asked yet.
  assert.equal(bookIsClosed(17, 19), false)
  // And a game that went to the 11th is indistinguishable from it at 17.
  assert.equal(bookIsClosed(17, 21), false)
})

test('a live game never closes the book, at any reveal mark', () => {
  // selectFinalHalfIndex returns null until the game is over, so this is the
  // whole of a live game's behaviour: "Box score", always.
  assert.equal(bookIsClosed(0, null), false)
  assert.equal(bookIsClosed(17, null), false)
  assert.equal(bookIsClosed(999, undefined), false)
})

test('a missing reveal mark never closes the book', () => {
  assert.equal(bookIsClosed(null, 17), false)
  assert.equal(bookIsClosed(undefined, 17), false)
})
