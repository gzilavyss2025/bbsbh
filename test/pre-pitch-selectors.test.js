// Unit coverage for the caller-gated pre-pitch selectors — defenseEntering
// (defense.js) and lineupEntering (battingorder.js), the defense diamond and
// lineup cards as they stand ENTERING a half, rendered OUTSIDE the seal
// (ADR-0010). They are spoiler-adjacent by substitution *timing* (a flurry of
// pre-half subs telegraphs a sealed blowout), so each enforces its own gate:
// it returns null for a half further out than the user's own next reveal
// (safeToShowEntering, halfIndex <= revealedThrough + 1). spoiler-gates.test.js
// already pins the primitive and selectPrePitchChanges; these two selectors
// build on it and weren't covered — a flipped comparison here leaks a sub.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { defenseEntering } from '../src/api/defense.js'
import { lineupEntering } from '../src/api/battingorder.js'
import { entrantsBeforeFirstPitch } from '../src/api/enteringHalf.js'
import { halfIndex } from '../src/api/select.js'

const posOf = (rows, position) => rows.find((r) => r.position === position)
const slotOf = (rows, slot) => rows.find((r) => r.slot === slot)

// --------------------------------------------------------------------------
// The spoiler-safety gate — the whole reason these take revealedThrough
// --------------------------------------------------------------------------
test('defenseEntering returns null for a half further out than the next reveal', () => {
  const feed = buildFeed()
  // top 2 is halfIndex 2; safe only once revealedThrough >= 1 (its own next).
  assert.equal(defenseEntering(feed, 'home', 2, 'top', 0), null)
  assert.ok(defenseEntering(feed, 'home', 2, 'top', 1)) // exactly the next half — allowed
})

test('lineupEntering returns null for a half further out than the next reveal', () => {
  const feed = buildFeed()
  assert.equal(lineupEntering(feed, 'away', 2, 'top', 0), null)
  assert.ok(lineupEntering(feed, 'away', 2, 'top', 1))
})

test('the entering selectors default to Infinity (the box score inside its own seal)', () => {
  // No revealedThrough passed → whole-game alignment always passes the gate.
  const feed = buildFeed()
  assert.ok(defenseEntering(feed, 'home', Infinity, 'bottom'))
  assert.ok(lineupEntering(feed, 'home', Infinity, 'bottom'))
})

// --------------------------------------------------------------------------
// defenseEntering — the alignment chain
// --------------------------------------------------------------------------
test('defenseEntering lists the starting nine in fixed C→DH order before any sub', () => {
  // Entering top 1 (nothing has happened yet): every spot is its un-struck starter.
  const rows = defenseEntering(buildFeed(), 'home', 1, 'top', -1)
  assert.deepEqual(rows.map((r) => r.position), ['C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF', 'DH'])
  assert.ok(rows.every((r) => r.entries.length === 1 && r.entries[0].replaced === false))
})

test('a defensive sub made before the half appends to that spot as the un-struck occupant', () => {
  // The home LF replacement (#20 Toro for #15 Ott) is announced before top 2.
  const lf = posOf(defenseEntering(buildFeed(), 'home', 2, 'top', 1), 'LF')
  assert.deepEqual(
    lf.entries.map((e) => ({ id: e.id, replaced: e.replaced })),
    [
      { id: 15, replaced: true }, // starter, struck through
      { id: 20, replaced: false }, // the replacement, the surviving name
    ],
  )
  assert.equal(lf.entries[1].inning, 2)
})

test('a defensive sub is not shown entering an earlier half', () => {
  // Entering top 1, LF is still just the starter — the top-2 sub stays sealed.
  const lf = posOf(defenseEntering(buildFeed(), 'home', 1, 'top', -1), 'LF')
  assert.equal(lf.entries.length, 1)
  assert.equal(lf.entries[0].id, 15)
})

test("one team's sub never bleeds into the other team's diamond", () => {
  // #20 belongs to the home boxscore only; the away diamond must never show him.
  const awayRows = defenseEntering(buildFeed(), 'away', 2, 'top', 1)
  const ids = awayRows.flatMap((r) => r.entries.map((e) => e.id))
  assert.ok(!ids.includes(20))
})

// --------------------------------------------------------------------------
// lineupEntering — the batting-order chain
// --------------------------------------------------------------------------
test('lineupEntering fills nine slots with starters before any sub', () => {
  const rows = lineupEntering(buildFeed(), 'away', 1, 'top', -1)
  assert.deepEqual(rows.map((r) => r.slot), [1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.ok(rows.every((r) => r.entries.length === 1))
})

test('a pinch-hitter announced before the half chains onto his slot', () => {
  // #10 Judge pinch-hits for #4 Diaz (slot 4), announced before top 2.
  const slot4 = slotOf(lineupEntering(buildFeed(), 'away', 2, 'top', 1), 4)
  assert.deepEqual(
    slot4.entries.map((e) => ({ id: e.id, replaced: e.replaced })),
    [
      { id: 4, replaced: true },
      { id: 10, replaced: false },
    ],
  )
  assert.equal(slot4.entries[1].inning, 2)
})

test('a pinch-hitter is absent from the slot until his own half is the next reveal', () => {
  // Entering top 1 the sub has not entered yet — slot 4 is still just the starter.
  const slot4 = slotOf(lineupEntering(buildFeed(), 'away', 1, 'top', -1), 4)
  assert.equal(slot4.entries.length, 1)
  assert.equal(slot4.entries[0].id, 4)
})

// --------------------------------------------------------------------------
// entrantsBeforeFirstPitch — the shared building block
// --------------------------------------------------------------------------
test('entrantsBeforeFirstPitch collects every sub announced before the half', () => {
  const feed = buildFeed()
  assert.deepEqual([...entrantsBeforeFirstPitch(feed, 1, 'top')], []) // nothing yet
  // Entering top 2: the reliever, the pinch-hitter, and the defensive sub.
  assert.deepEqual(new Set(entrantsBeforeFirstPitch(feed, 2, 'top')), new Set([201, 10, 20]))
})

test('halfIndex agrees with the gate the selectors enforce', () => {
  // Documents the exact boundary the null-return tests above rely on.
  assert.equal(halfIndex(2, 'top'), 2)
  assert.equal(halfIndex(1, 'bottom'), 1)
})
