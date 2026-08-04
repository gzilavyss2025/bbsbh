// The Logbook's pure rules (src/lib/stamps.js, ADR-0035).
//
// The gate cases below are the spoiler-critical ones: a stamp carries a final
// score, so "you cannot own a stamp for a game you have not finished revealing"
// has to hold for a walk-off, for extra innings, and for a home team that never
// batted in the last inning — the three shapes where a naive
// `regulation × 2 − 1` gets it wrong in one direction or the other.
import assert from 'node:assert/strict'
import test from 'node:test'

import { halfIndex } from '../src/api/select.js'
import {
  DEFAULT_STAMP_MODE,
  MAX_NOTE_LENGTH,
  MAX_PLACEMENT_PAGE,
  MAX_PLACEMENT_TILT,
  MAX_STAMPS_PER_SEASON,
  addStamp,
  applyRemoteStamps,
  finalHalfIndex,
  isStamped,
  meetsRevealGate,
  normalizePlacement,
  normalizeStamp,
  parseStamps,
  placeStamp,
  placeStamps,
  removeStamp,
  samePlacement,
  sanitizeNote,
  seasonCounts,
  seasonFromDate,
  seasonIsFull,
  serializeStamps,
  stampFor,
  stampsForSeason,
  toGamePk,
  unplaceStamp,
} from '../src/lib/stamps.js'

const NINE = { gamePk: 1, status: 'Final', date: '2026-05-18', innings: 9, homeBattedLast: true }

// ---------------------------------------------------------------------------
// The half-index restatement must not drift from the real one
// ---------------------------------------------------------------------------

test('finalHalfIndex agrees with select.js halfIndex', () => {
  for (let inning = 1; inning <= 15; inning++) {
    assert.equal(finalHalfIndex({ innings: inning, homeBattedLast: true }), halfIndex(inning, 'bottom'))
    assert.equal(finalHalfIndex({ innings: inning, homeBattedLast: false }), halfIndex(inning, 'top'))
  }
})

test('finalHalfIndex refuses a game with no innings', () => {
  assert.equal(finalHalfIndex({ innings: 0, homeBattedLast: true }), null)
  assert.equal(finalHalfIndex({}), null)
  assert.equal(finalHalfIndex(null), null)
})

// ---------------------------------------------------------------------------
// The reveal gate
// ---------------------------------------------------------------------------

test('a nine-inning game needs the bottom of the ninth revealed', () => {
  assert.equal(meetsRevealGate({ game: NINE, revealedThrough: halfIndex(9, 'top') }), false)
  assert.equal(meetsRevealGate({ game: NINE, revealedThrough: halfIndex(9, 'bottom') }), true)
})

test('a home team that never batted in the ninth is gated at the top of the ninth', () => {
  // Home led after the top half, so there is no bottom to reveal. Demanding one
  // would make the stamp unreachable for every such game.
  const game = { ...NINE, homeBattedLast: false }
  assert.equal(meetsRevealGate({ game, revealedThrough: halfIndex(8, 'bottom') }), false)
  assert.equal(meetsRevealGate({ game, revealedThrough: halfIndex(9, 'top') }), true)
})

test('an extra-inning game is NOT unlocked by revealing regulation', () => {
  // The PRD's `regulation × 2 − 1` would pass here, and it would be a spoiler
  // in reverse: the game was tied after nine, so the user has seen none of the
  // innings that decided it.
  const game = { ...NINE, innings: 11 }
  assert.equal(meetsRevealGate({ game, revealedThrough: halfIndex(9, 'bottom') }), false)
  assert.equal(meetsRevealGate({ game, revealedThrough: halfIndex(11, 'bottom') }), true)
})

test('a consented spoiled day satisfies the gate on its own', () => {
  // ADR-0026: the Scores Unlocked pass never writes the reveal mark, so this is
  // the one legitimate way to know a final score with revealedThrough at -1.
  assert.equal(meetsRevealGate({ game: NINE, revealedThrough: -1, daySpoiled: true }), true)
})

test('the gate fails closed on everything else', () => {
  assert.equal(meetsRevealGate(), false)
  assert.equal(meetsRevealGate({}), false)
  assert.equal(meetsRevealGate({ game: NINE }), false)
  assert.equal(meetsRevealGate({ game: NINE, revealedThrough: '17' }), false)
  assert.equal(meetsRevealGate({ game: NINE, revealedThrough: 1.5 }), false)
  // Live games never mint — a stamp is permanent, a live score is not.
  assert.equal(
    meetsRevealGate({ game: { ...NINE, status: 'Live' }, revealedThrough: 99 }),
    false,
  )
  // A truthy-but-not-true consent flag is not consent.
  assert.equal(meetsRevealGate({ game: NINE, revealedThrough: -1, daySpoiled: 'yes' }), false)
  // Consent for a game with no parseable date proves nothing.
  assert.equal(
    meetsRevealGate({ game: { ...NINE, date: 'May 18' }, revealedThrough: -1, daySpoiled: true }),
    false,
  )
})

// ---------------------------------------------------------------------------
// Validation and parsing
// ---------------------------------------------------------------------------

test('toGamePk takes integers and numeric strings only', () => {
  assert.equal(toGamePk(824680), 824680)
  assert.equal(toGamePk('824680'), 824680)
  assert.equal(toGamePk(0), null)
  assert.equal(toGamePk(-1), null)
  assert.equal(toGamePk(1.5), null)
  assert.equal(toGamePk('12a'), null)
  assert.equal(toGamePk(''), null)
  assert.equal(toGamePk(null), null)
})

test('seasonFromDate reads the season off the game date', () => {
  assert.equal(seasonFromDate('2026-05-18'), 2026)
  assert.equal(seasonFromDate('2026-5-18'), null)
  assert.equal(seasonFromDate(''), null)
  assert.equal(seasonFromDate(null), null)
})

test('sanitizeNote flattens control characters and caps length', () => {
  assert.equal(
    sanitizeNote("Dad's first game\n\tat County Stadium"),
    "Dad's first game at County Stadium",
  )
  assert.equal(sanitizeNote('  spaced   out  '), 'spaced out')
  assert.equal(sanitizeNote('x'.repeat(500)).length, MAX_NOTE_LENGTH)
  assert.equal(sanitizeNote(null), '')
  assert.equal(sanitizeNote(42), '')
})

test('normalizeStamp drops entries with no stamp date and defaults the mode', () => {
  assert.equal(normalizeStamp({ state: 'on' }), null)
  assert.equal(normalizeStamp(null), null)
  const entry = normalizeStamp({ stampedAt: 5, mode: 'nonsense', state: 'weird', date: 'x' })
  assert.equal(entry.mode, DEFAULT_STAMP_MODE)
  assert.equal(entry.state, 'on')
  assert.equal(entry.date, '')
  // updatedAt falls back to stampedAt so a pre-sync record still merges sanely.
  assert.equal(entry.updatedAt, 5)
})

test('parseStamps fails empty rather than inventing a collection', () => {
  assert.deepEqual(parseStamps(null), {})
  assert.deepEqual(parseStamps('not json'), {})
  assert.deepEqual(parseStamps('[1,2,3]'), {})
  assert.deepEqual(parseStamps('7'), {})
})

test('parseStamps round-trips a serialized collection', () => {
  const map = addStamp({}, 824680, { mode: 'followed', date: '2026-05-18', now: 1000 })
  assert.deepEqual(parseStamps(serializeStamps(map)), map)
})

// ---------------------------------------------------------------------------
// Stamping and un-stamping
// ---------------------------------------------------------------------------

test('addStamp records a stamp and does not mutate the input', () => {
  const before = {}
  const after = addStamp(before, 824680, { mode: 'watched', date: '2026-05-18', now: 1000 })
  assert.deepEqual(before, {})
  assert.equal(isStamped(after, 824680), true)
  assert.equal(stampFor(after, 824680).stampedAt, 1000)
})

test('re-stamping updates the note but keeps the keepsake date', () => {
  const first = addStamp({}, 1, { date: '2026-05-18', now: 1000 })
  const again = addStamp(first, 1, { date: '2026-05-18', now: 2000, note: 'rain delay' })
  assert.equal(stampFor(again, 1).stampedAt, 1000)
  assert.equal(stampFor(again, 1).updatedAt, 2000)
  assert.equal(stampFor(again, 1).note, 'rain delay')
})

test('addStamp refuses a malformed call rather than storing a broken record', () => {
  assert.deepEqual(addStamp({}, 'abc', { date: '2026-05-18', now: 1 }), {})
  assert.deepEqual(addStamp({}, 1, { date: 'nope', now: 1 }), {})
  assert.deepEqual(addStamp({}, 1, { date: '2026-05-18' }), {})
})

test('removeStamp tombstones rather than deleting', () => {
  const stamped = addStamp({}, 1, { date: '2026-05-18', now: 1000 })
  const removed = removeStamp(stamped, 1, { now: 2000 })
  assert.equal(isStamped(removed, 1), false)
  assert.equal(removed[1].state, 'off')
  assert.equal(removed[1].updatedAt, 2000)
  // Nothing to take back is a no-op, not a phantom tombstone.
  assert.deepEqual(removeStamp({}, 1, { now: 2000 }), {})
})

test('re-stamping a removed game starts a fresh keepsake date', () => {
  const removed = removeStamp(addStamp({}, 1, { date: '2026-05-18', now: 1000 }), 1, { now: 2000 })
  const again = addStamp(removed, 1, { date: '2026-05-18', now: 3000 })
  assert.equal(stampFor(again, 1).stampedAt, 3000)
})

test('a full season refuses a new stamp instead of pruning an old one', () => {
  let map = {}
  for (let i = 1; i <= MAX_STAMPS_PER_SEASON; i++) {
    map = addStamp(map, i, { date: '2026-05-18', now: i })
  }
  assert.equal(seasonIsFull(map, 2026), true)
  const refused = addStamp(map, 999999, { date: '2026-05-18', now: 99999 })
  assert.equal(isStamped(refused, 999999), false)
  assert.equal(Object.keys(refused).length, MAX_STAMPS_PER_SEASON)
  // The oldest keepsake is still there — nothing was silently dropped for it.
  assert.equal(isStamped(refused, 1), true)
  // A different season is unaffected, and an EXISTING stamp can still be edited.
  assert.equal(isStamped(addStamp(map, 777, { date: '2027-04-01', now: 1 }), 777), true)
  assert.equal(stampFor(addStamp(map, 1, { date: '2026-05-18', now: 5, note: 'x' }), 1).note, 'x')
})

test('season views count and order only live stamps', () => {
  let map = addStamp({}, 1, { date: '2026-05-18', now: 10 })
  map = addStamp(map, 2, { date: '2026-07-04', now: 20 })
  map = addStamp(map, 3, { date: '2025-09-01', now: 30 })
  map = removeStamp(map, 1, { now: 40 })
  assert.deepEqual(seasonCounts(map), { 2025: 1, 2026: 1 })
  assert.deepEqual(
    stampsForSeason(map, 2026).map((s) => s.gamePk),
    [2],
  )
})

// ---------------------------------------------------------------------------
// Placement — where a stamp sits in the passport book
// ---------------------------------------------------------------------------
// A page number and two fractions. Nothing score-bearing, so a forged one has
// moved a picture rather than minted a score — which is why the rules here are
// about staying READABLE (clamp, don't reject) rather than about failing
// closed, the opposite posture from the reveal gate above.

const SPOT = { page: 2, x: 0.42, y: 0.61, tilt: 3.5 }

test('normalizePlacement takes a readable spot and refuses an unreadable one', () => {
  assert.deepEqual(normalizePlacement(SPOT), SPOT)
  // The page is an integer inside the book — the bound a hostile client would
  // otherwise use to mint a 40,000-page one.
  assert.equal(normalizePlacement({ ...SPOT, page: 0 }), null)
  assert.equal(normalizePlacement({ ...SPOT, page: -1 }), null)
  assert.equal(normalizePlacement({ ...SPOT, page: 2.5 }), null)
  assert.equal(normalizePlacement({ ...SPOT, page: MAX_PLACEMENT_PAGE + 1 }), null)
  assert.equal(normalizePlacement({ ...SPOT, page: 'two' }), null)
  assert.equal(normalizePlacement({ ...SPOT, page: MAX_PLACEMENT_PAGE }).page, MAX_PLACEMENT_PAGE)
  // A coordinate that isn't a number is not a spot on a page.
  assert.equal(normalizePlacement({ ...SPOT, x: NaN }), null)
  assert.equal(normalizePlacement({ ...SPOT, y: Infinity }), null)
  assert.equal(normalizePlacement({ ...SPOT, y: 'middle' }), null)
  assert.equal(normalizePlacement(null), null)
  assert.equal(normalizePlacement(undefined), null)
  assert.equal(normalizePlacement('page 2'), null)
  assert.equal(normalizePlacement(7), null)
  // The numeric strings a Redis hash field hands back are the same spot.
  assert.deepEqual(normalizePlacement({ page: '2', x: '0.42', y: '0.61', tilt: '3.5' }), SPOT)
})

test('normalizePlacement clamps a spot onto the page rather than dropping it', () => {
  assert.deepEqual(normalizePlacement({ page: 1, x: -3, y: 12, tilt: 0 }), {
    page: 1,
    x: 0,
    y: 1,
    tilt: 0,
  })
  // Tilt is bounded both ways...
  assert.equal(normalizePlacement({ ...SPOT, tilt: 90 }).tilt, MAX_PLACEMENT_TILT)
  assert.equal(normalizePlacement({ ...SPOT, tilt: -90 }).tilt, -MAX_PLACEMENT_TILT)
  // ...and a missing or unreadable one is simply straight.
  assert.equal(normalizePlacement({ page: 1, x: 0.5, y: 0.5 }).tilt, 0)
  assert.equal(normalizePlacement({ ...SPOT, tilt: 'sideways' }).tilt, 0)
})

test('a placement is rounded so a round trip cannot read as a move', () => {
  const spot = normalizePlacement({ page: 1, x: 0.123456789, y: 0.5, tilt: 1.23456 })
  assert.equal(spot.x, 0.1235)
  assert.equal(spot.tilt, 1.23)
  assert.equal(samePlacement(spot, normalizePlacement(JSON.parse(JSON.stringify(spot)))), true)
})

test('samePlacement compares the spot, not the object', () => {
  assert.equal(samePlacement(null, null), true)
  assert.equal(samePlacement(null, undefined), true)
  assert.equal(samePlacement(SPOT, null), false)
  assert.equal(samePlacement(null, SPOT), false)
  assert.equal(samePlacement(SPOT, { ...SPOT }), true)
  assert.equal(samePlacement(SPOT, { ...SPOT, page: 3 }), false)
  assert.equal(samePlacement(SPOT, { ...SPOT, x: 0.43 }), false)
  assert.equal(samePlacement(SPOT, { ...SPOT, y: 0.62 }), false)
  assert.equal(samePlacement(SPOT, { ...SPOT, tilt: -3.5 }), false)
})

test('every record carries a placement, and an unreadable one never voids it', () => {
  const bare = normalizeStamp({ stampedAt: 5, date: '2026-05-18' })
  assert.ok('placement' in bare)
  assert.equal(bare.placement, null)
  assert.deepEqual(normalizeStamp({ stampedAt: 5, date: '2026-05-18', placement: SPOT }).placement, SPOT)
  // The keepsake outranks its position: garbage sends the stamp back to the
  // tray, it does not throw the record away.
  const junk = normalizeStamp({ stampedAt: 5, date: '2026-05-18', placement: { page: 0 } })
  assert.ok(junk)
  assert.equal(junk.placement, null)
  assert.equal(normalizeStamp({ stampedAt: 5, placement: 'page 2' }).placement, null)
})

test('a new stamp starts in the tray, and a named spot places it', () => {
  const plain = addStamp({}, 1, { date: '2026-05-18', now: 1000 })
  assert.equal(stampFor(plain, 1).placement, null)
  const placed = addStamp({}, 2, { date: '2026-05-18', now: 1000, placement: SPOT })
  assert.deepEqual(stampFor(placed, 2).placement, SPOT)
})

test('re-stamping to edit a note does not knock the stamp off its page', () => {
  // The regression that matters: the note editor calls addStamp again, and a
  // book somebody arranged by hand has to survive it.
  const placed = addStamp({}, 1, { date: '2026-05-18', now: 1000, placement: SPOT })
  const edited = addStamp(placed, 1, { date: '2026-05-18', now: 2000, note: 'rain delay' })
  assert.deepEqual(stampFor(edited, 1).placement, SPOT)
  assert.equal(stampFor(edited, 1).note, 'rain delay')
})

test('re-stamping a removed game starts it back in the tray', () => {
  // You un-stamped it, so where it used to sit is not where this keepsake goes.
  const placed = addStamp({}, 1, { date: '2026-05-18', now: 1000, placement: SPOT })
  const removed = removeStamp(placed, 1, { now: 2000 })
  const again = addStamp(removed, 1, { date: '2026-05-18', now: 3000 })
  assert.equal(stampFor(again, 1).placement, null)
})

test('placeStamp places, moves, and bumps the sync clock', () => {
  const stamped = addStamp({}, 1, { date: '2026-05-18', now: 1000 })
  const placed = placeStamp(stamped, 1, SPOT, { now: 2000 })
  assert.deepEqual(stampFor(placed, 1).placement, SPOT)
  assert.equal(stampFor(placed, 1).updatedAt, 2000)
  // Moving a stamp is not re-stamping it — the keepsake's own date holds.
  assert.equal(stampFor(placed, 1).stampedAt, 1000)
  const moved = placeStamp(placed, 1, { ...SPOT, page: 3 }, { now: 3000 })
  assert.equal(stampFor(moved, 1).placement.page, 3)
  assert.equal(stampFor(moved, 1).updatedAt, 3000)
  // The input map is never mutated.
  assert.deepEqual(stampFor(placed, 1).placement, SPOT)
})

test('placeStamp is a no-op for anything it has no business moving', () => {
  const stamped = addStamp({}, 1, { date: '2026-05-18', now: 1000 })
  // You cannot place a keepsake you do not hold.
  assert.deepEqual(placeStamp(stamped, 999, SPOT, { now: 2000 }), stamped)
  assert.deepEqual(placeStamp(stamped, 'abc', SPOT, { now: 2000 }), stamped)
  // A tombstone stays a tombstone — placing one would half-revive it.
  const removed = removeStamp(stamped, 1, { now: 1500 })
  assert.deepEqual(placeStamp(removed, 1, SPOT, { now: 2000 }), removed)
  // An unreadable spot, or no clock to date the change by.
  assert.deepEqual(placeStamp(stamped, 1, { page: 0 }, { now: 2000 }), stamped)
  assert.deepEqual(placeStamp(stamped, 1, null, { now: 2000 }), stamped)
  assert.deepEqual(placeStamp(stamped, 1, SPOT), stamped)
})

test('placing a stamp where it already sits does not republish it', () => {
  // What stops the sync republishing forever: a placement that merely
  // round-tripped is not a change, so updatedAt must not move.
  const placed = placeStamp(addStamp({}, 1, { date: '2026-05-18', now: 1000 }), 1, SPOT, {
    now: 2000,
  })
  const again = placeStamp(placed, 1, { ...SPOT }, { now: 5000 })
  assert.equal(stampFor(again, 1).updatedAt, 2000)
  assert.deepEqual(again, placed)
})

test('unplaceStamp returns the stamp to the tray without losing it', () => {
  const placed = placeStamp(addStamp({}, 1, { date: '2026-05-18', now: 1000 }), 1, SPOT, {
    now: 2000,
  })
  const cleared = unplaceStamp(placed, 1, { now: 3000 })
  assert.equal(stampFor(cleared, 1).placement, null)
  assert.equal(stampFor(cleared, 1).updatedAt, 3000)
  // Taking a stamp off the page is not un-stamping the game.
  assert.equal(isStamped(cleared, 1), true)
  assert.equal(stampFor(cleared, 1).stampedAt, 1000)
  // Already in the tray: nothing to take back, nothing to publish.
  assert.deepEqual(unplaceStamp(cleared, 1, { now: 4000 }), cleared)
  assert.deepEqual(unplaceStamp(cleared, 999, { now: 4000 }), cleared)
})

test('placeStamps lays out a whole batch in one pass', () => {
  // The shape autoLayout (src/lib/passportLayout.js) returns — the "place them
  // all for me" control, and what an upgrading collection needs.
  let map = addStamp({}, 1, { date: '2026-05-18', now: 1000 })
  map = addStamp(map, 2, { date: '2026-05-19', now: 1000 })
  map = addStamp(map, 3, { date: '2026-05-20', now: 1000 })
  const laid = placeStamps(
    map,
    [
      { gamePk: 1, placement: { page: 1, x: 0.25, y: 0.2, tilt: 0 } },
      { gamePk: 2, placement: { page: 1, x: 0.75, y: 0.2, tilt: -2 } },
      { gamePk: 999, placement: SPOT }, // not in the collection — skipped
    ],
    { now: 2000 },
  )
  assert.equal(stampFor(laid, 1).placement.x, 0.25)
  assert.equal(stampFor(laid, 2).placement.tilt, -2)
  // A stamp the batch didn't name is left in the tray, not swept somewhere.
  assert.equal(stampFor(laid, 3).placement, null)
  assert.equal(isStamped(laid, 999), false)
  assert.deepEqual(placeStamps(map, null, { now: 2000 }), map)
})

test('a placement survives the localStorage round trip', () => {
  const map = addStamp({}, 824680, { date: '2026-05-18', now: 1000, placement: SPOT })
  const back = parseStamps(serializeStamps(map))
  assert.deepEqual(back, map)
  assert.deepEqual(stampFor(back, 824680).placement, SPOT)
})

// ---------------------------------------------------------------------------
// Sync merge
// ---------------------------------------------------------------------------

test('a remote stamp this device has never seen is adopted', () => {
  const merged = applyRemoteStamps({}, {
    824680: { state: 'on', mode: 'watched', stampedAt: 5, updatedAt: 5, date: '2026-05-18' },
  })
  assert.equal(isStamped(merged, 824680), true)
})

test('a stale remote "on" cannot resurrect a stamp the user just took back', () => {
  // The exact failure a union merge would produce: stamp, sync, un-stamp, and
  // the next fetch quietly undoes the removal.
  const local = removeStamp(addStamp({}, 1, { date: '2026-05-18', now: 1000 }), 1, { now: 2000 })
  const merged = applyRemoteStamps(local, {
    1: { state: 'on', mode: 'watched', stampedAt: 1000, updatedAt: 1000, date: '2026-05-18' },
  })
  assert.equal(isStamped(merged, 1), false)
})

test('a newer remote removal propagates over a local stamp', () => {
  const local = addStamp({}, 1, { date: '2026-05-18', now: 1000 })
  const merged = applyRemoteStamps(local, {
    1: { state: 'off', mode: 'watched', stampedAt: 1000, updatedAt: 5000, date: '2026-05-18' },
  })
  assert.equal(isStamped(merged, 1), false)
})

test('a newer remote record brings its placement with it', () => {
  // The book is part of the collection, not a second sync channel: a stamp
  // moved on the phone reaches the laptop by exactly the last-write-wins path
  // every other change takes.
  const remote = {
    state: 'on',
    mode: 'watched',
    stampedAt: 1000,
    updatedAt: 5000,
    date: '2026-05-18',
    placement: SPOT,
  }
  const local = addStamp({}, 1, { date: '2026-05-18', now: 1000 })
  const merged = applyRemoteStamps(local, { 1: remote })
  assert.deepEqual(stampFor(merged, 1).placement, SPOT)
  // ...and once this device moves it, the same stale remote cannot drag it back.
  const moved = placeStamp(merged, 1, { ...SPOT, page: 4 }, { now: 9000 })
  assert.equal(stampFor(applyRemoteStamps(moved, { 1: remote }), 1).placement.page, 4)
})

test('a garbled remote payload degrades to no change', () => {
  const local = addStamp({}, 1, { date: '2026-05-18', now: 1000 })
  assert.deepEqual(applyRemoteStamps(local, null), local)
  assert.deepEqual(applyRemoteStamps(local, 'nope'), local)
  assert.deepEqual(applyRemoteStamps(local, { abc: { stampedAt: 1 }, 2: { junk: true } }), local)
})
