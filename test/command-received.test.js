// Unit coverage for the catcher-side half of the OpenCommand work: the
// catcher-of-record selector (src/api/catcherOfRecord.js) and the card's reader
// (src/api/commandReceived.js).
//
// THE SELECTOR IS PINNED ON A REAL GAME, not a synthetic feed, and that is the
// point of the fixture. OpenCommand carries no catcher identity anywhere, so
// "who was catching" is entirely bbsbh's own join — if it is wrong, every row of
// every catcher's card is charged to the wrong man and nothing about the page
// looks broken. A hand-built feed would only prove the code agrees with the feed
// I imagined; a captured one proves it agrees with the feed MLB sends.
//
// The fixture is game 822740 (Twins at Nationals, 2026-08-13), chosen because it
// has a real mid-game catcher change, and checked BY HAND against that game's
// published boxscore before this test was written:
//
//   away (Minnesota)  Victor Caratini #605170  started at C (battingOrder 600,
//                     gamesStarted 1), later listed C/1B
//                     Ryan Jeffers   #680777  battingOrder 501, listed PH/C —
//                     pinch-hit in the top of the 7th, caught from the bottom
//   home (Washington) Drew Millas    #686452  caught all nine (battingOrder 800)
//
// So the selector has to say Caratini through the bottom of the 6th, Jeffers
// from the bottom of the 7th, and Millas for every top half.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import {
  catcherChart,
  catcherEntering,
  fieldingSideFor,
  halvesPlayed,
} from '../src/api/catcherOfRecord.js'
import { CAUSATION_NOTE, commandReceivedFor } from '../src/api/commandReceived.js'

const feed = JSON.parse(
  readFileSync(new URL('./fixtures/game-822740.trimmed.json', import.meta.url), 'utf8'),
)

const CARATINI = 605170
const JEFFERS = 680777
const MILLAS = 686452

// ---------------------------------------------------------------------------
// which side is crouching
// ---------------------------------------------------------------------------

test('the home team catches the top half, the away team the bottom', () => {
  // The visitors bat first, so the HOME catcher is the one behind the plate in
  // a top half. Getting this backwards would charge every pitch to the other
  // club's catcher and still produce a full, plausible-looking file.
  assert.equal(fieldingSideFor('top'), 'home')
  assert.equal(fieldingSideFor('bottom'), 'away')
})

// ---------------------------------------------------------------------------
// the catcher of record — against the real game above
// ---------------------------------------------------------------------------

test('the whole-game starter is found for every half he caught', () => {
  for (let inning = 1; inning <= 9; inning++) {
    const c = catcherEntering(feed, 'home', inning, 'top')
    assert.equal(c?.id, MILLAS, `home catcher wrong in the top of the ${inning}`)
  }
})

test('the starter holds until the half his replacement entered', () => {
  for (let inning = 1; inning <= 6; inning++) {
    const c = catcherEntering(feed, 'away', inning, 'bottom')
    assert.equal(c?.id, CARATINI, `away catcher wrong in the bottom of the ${inning}`)
  }
})

test('the replacement takes over from the half he came in, not before it', () => {
  assert.equal(catcherEntering(feed, 'away', 6, 'bottom')?.id, CARATINI)
  assert.equal(catcherEntering(feed, 'away', 7, 'bottom')?.id, JEFFERS)
  assert.equal(catcherEntering(feed, 'away', 8, 'bottom')?.id, JEFFERS)
})

test('the surviving occupant is named, never the man he replaced', () => {
  // defenseEntering returns the whole chain with the replaced men struck
  // through; reading the wrong end of it would credit Jeffers's innings to
  // Caratini for the rest of the game.
  const late = catcherEntering(feed, 'away', 8, 'bottom')
  assert.equal(late.id, JEFFERS)
  assert.equal(late.last, 'Jeffers')
})

test('the chart covers every half the game actually played', () => {
  const halves = halvesPlayed(feed)
  const chart = catcherChart(feed)
  assert.equal(chart.size, halves.length)
  // Not a 1-to-18 assumption: this one ended in the top of the 9th.
  assert.ok(halves.length >= 17, `expected a full game, got ${halves.length} halves`)
  for (const { inning, half } of halves) {
    assert.ok(chart.get(`${inning}:${half}`)?.id, `no catcher at ${inning}:${half}`)
  }
})

test('the chart names exactly the three men who caught', () => {
  const ids = new Set([...catcherChart(feed).values()].map((c) => c.id))
  assert.deepEqual([...ids].sort((a, b) => a - b), [CARATINI, MILLAS, JEFFERS].sort((a, b) => a - b))
})

test('a caller that has not reached a half is told nothing, not told a name', () => {
  // The gate is defenseEntering's own, passed straight through — substitution
  // timing telegraphs a sealed blowout, so a half past the reader's mark
  // returns null rather than trusting the caller to hide it.
  assert.equal(catcherEntering(feed, 'away', 9, 'top', 0), null)
  assert.ok(catcherEntering(feed, 'away', 1, 'top', 0))
})

test('an empty feed yields an empty chart rather than throwing', () => {
  assert.equal(catcherChart({}).size, 0)
  assert.deepEqual(halvesPlayed(null), [])
  assert.equal(catcherEntering({}, 'home', 1, 'top'), null)
})

// ---------------------------------------------------------------------------
// the card's reader
// ---------------------------------------------------------------------------

const FILE = {
  season: 2026,
  names: { 1: 'Realmuto', 10: 'Nola', 11: 'Wheeler', 12: 'Kilian' },
  catchers: {
    1: {
      n: 11908,
      miss: 9.3,
      pitchers: [
        [10, 871, 7.98],
        [11, 1631, 8.62],
        [12, 120, 12.47],
      ],
    },
  },
}

test('a catcher in the file gets his season line and his staff', () => {
  const view = commandReceivedFor(FILE, 1, 2026)
  assert.equal(view.pitches, 11908)
  assert.equal(view.miss, 9.3)
  assert.equal(view.pitchers.length, 3)
})

test('the rows arrive ranked, and carry the rank they were given', () => {
  const view = commandReceivedFor(FILE, 1, 2026)
  assert.deepEqual(view.pitchers.map((p) => p.name), ['Nola', 'Wheeler', 'Kilian'])
  assert.deepEqual(view.pitchers.map((p) => p.rank), [1, 2, 3])
})

test('better is measured against THIS catcher’s own season, not the league', () => {
  // The bar on the card is a read on one staff. Scaling it to a league figure
  // would make the list look like a ranking of pitchers, which it is not.
  const view = commandReceivedFor(FILE, 1, 2026)
  assert.deepEqual(view.pitchers.map((p) => p.better), [true, true, false])
})

test('the sample rides every row, because two identical figures are not two identical claims', () => {
  const view = commandReceivedFor(FILE, 1, 2026)
  assert.deepEqual(view.pitchers.map((p) => p.pitches), [871, 1631, 120])
})

test('a pitcher with no name still makes a row, keyed by his id', () => {
  const view = commandReceivedFor(
    { ...FILE, names: {} , catchers: { 1: { n: 100, miss: 9, pitchers: [[99, 60, 8.1]] } } },
    1,
    2026,
  )
  assert.equal(view.pitchers[0].name, '#99')
})

test('a page on another season shows nothing, not last year’s battery', () => {
  assert.equal(commandReceivedFor(FILE, 1, 2025), null)
})

test('a player who never caught, or no file at all, draws nothing', () => {
  assert.equal(commandReceivedFor(FILE, 777, 2026), null)
  assert.equal(commandReceivedFor(null, 1, 2026), null)
  assert.equal(commandReceivedFor({ season: 2026, catchers: { 1: { n: 0, miss: 9, pitchers: [] } } }, 1, 2026), null)
})

test('the card cannot ship without saying whose command this measures', () => {
  // Required copy, kept in the data layer so a redesign cannot quietly drop it:
  // a list of pitchers under a catcher's name reads as a catcher's skill unless
  // something says otherwise.
  assert.match(CAUSATION_NOTE, /pitcher/i)
  assert.match(CAUSATION_NOTE, /own command|own aim/i)
})
