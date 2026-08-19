// The Logbook's pure rules (src/lib/stamps.js, ADR-0035).
//
// This file used to open with the reveal-gate cases — `meetsRevealGate` across a
// walk-off, extra innings, and a home team that never batted. That gate was
// retired in ADR-0035's second amendment and the predicate deleted, so those
// cases went with the code they pinned rather than being loosened to pass.
// The mint's surviving refusals are pinned server-side instead
// (`mintRefusal`/`stampEntry` in test/api-handlers.test.js), and the Logbook's
// spoiler containment is pinned by `scripts/check-stamp-surfaces.mjs` and
// `e2e/invariants/logbook-stamp.spec.js`, both untouched.
import assert from 'node:assert/strict'
import test from 'node:test'

import { mergeStrategyFor } from '../src/lib/account/preferences.js'

import {
  DEFAULT_BOOK_ID,
  DEFAULT_STAMP_MODE,
  MAX_NOTE_LENGTH,
  MAX_PLACEMENT_PAGE,
  MAX_PLACEMENT_TILT,
  MAX_STAMPS_PER_SEASON,
  addStamp,
  adoptRemoteStamps,
  applyRemoteStamps,
  isStamped,
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
  stampsToPublish,
  toGamePk,
  unplaceStamp,
} from '../src/lib/stamps.js'

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

const SPOT = { bookId: DEFAULT_BOOK_ID, page: 2, x: 0.42, y: 0.61, tilt: 3.5 }

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
    bookId: DEFAULT_BOOK_ID,
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
  // Same page/x/y/tilt, different book, is NOT the same spot — moving a stamp
  // to another book's page is a real change worth syncing.
  assert.equal(samePlacement(SPOT, { ...SPOT, bookId: 'roadtrip' }), false)
})

// ---------------------------------------------------------------------------
// bookId — which book a placement is filed in (foundation for src/lib/books.js)
// ---------------------------------------------------------------------------

test('normalizePlacement defaults bookId to DEFAULT_BOOK_ID when absent or invalid', () => {
  assert.equal(normalizePlacement({ page: 1, x: 0.5, y: 0.5, tilt: 0 }).bookId, DEFAULT_BOOK_ID)
  assert.equal(normalizePlacement({ ...SPOT, bookId: '' }).bookId, DEFAULT_BOOK_ID)
  assert.equal(normalizePlacement({ ...SPOT, bookId: 'x'.repeat(65) }).bookId, DEFAULT_BOOK_ID)
  assert.equal(normalizePlacement({ ...SPOT, bookId: 42 }).bookId, DEFAULT_BOOK_ID)
  assert.equal(normalizePlacement({ ...SPOT, bookId: null }).bookId, DEFAULT_BOOK_ID)
})

test('normalizePlacement keeps a real bookId', () => {
  assert.equal(normalizePlacement({ ...SPOT, bookId: 'roadtrip-2026' }).bookId, 'roadtrip-2026')
  assert.equal(normalizePlacement({ ...SPOT, bookId: 'x'.repeat(64) }).bookId, 'x'.repeat(64))
})

test('addStamp and placeStamp round-trip a bookId through a stamp record', () => {
  const spot = { ...SPOT, bookId: 'roadtrip-2026' }
  const stamped = addStamp({}, 1, { date: '2026-05-18', now: 1000, placement: spot })
  assert.equal(stampFor(stamped, 1).placement.bookId, 'roadtrip-2026')

  const moved = placeStamp(
    addStamp({}, 2, { date: '2026-05-18', now: 1000 }),
    2,
    spot,
    { now: 2000 },
  )
  assert.equal(stampFor(moved, 2).placement.bookId, 'roadtrip-2026')

  // A placement with no bookId at all still lands in the default book.
  const defaulted = addStamp({}, 3, { date: '2026-05-18', now: 1000, placement: SPOT })
  assert.equal(stampFor(defaulted, 3).placement.bookId, DEFAULT_BOOK_ID)
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

// ---------------------------------------------------------------------------
// The backfill: what this device has that the server doesn't
// ---------------------------------------------------------------------------
// The gap these pin: the sync used to publish "what changed since I started
// watching", so a collection that already existed when the user signed in was
// never uploaded at all — the phone kept its stamps, the laptop showed an empty
// Logbook, and no amount of waiting fixed it because nothing was changing.

const REC = (updatedAt, extra = {}) => ({
  state: 'on',
  mode: 'watched',
  stampedAt: 1_000,
  updatedAt,
  note: '',
  date: '2026-05-18',
  placement: null,
  ...extra,
})

test('a collection that predates sign-in publishes in full', () => {
  const local = { 101: REC(5), 102: REC(6) }
  assert.deepEqual(stampsToPublish(local, {}), [101, 102])
})

test('a record the server already has identically is not republished', () => {
  const local = { 101: REC(5) }
  assert.deepEqual(stampsToPublish(local, { 101: REC(5) }), [])
})

test('this device publishes when it holds the newer version', () => {
  const local = { 101: REC(9, { note: 'edited here' }) }
  assert.deepEqual(stampsToPublish(local, { 101: REC(5) }), [101])
})

test('a NEWER remote record is left alone — the merge already took it', () => {
  // Republishing it would echo the server back to itself, and on a slow
  // connection could land after a genuinely newer change from a third device.
  const local = { 101: REC(5) }
  assert.deepEqual(stampsToPublish(local, { 101: REC(9) }), [])
})

test('two changes inside one millisecond still publish', () => {
  // Same updatedAt, different content: cheaper to publish than to reason about.
  const local = { 101: REC(5, { note: 'moved' }) }
  assert.deepEqual(stampsToPublish(local, { 101: REC(5) }), [101])
})

test('a placement the server has not seen publishes', () => {
  const local = { 101: REC(7, { placement: { page: 2, x: 0.5, y: 0.5, tilt: 0 } }) }
  assert.deepEqual(stampsToPublish(local, { 101: REC(5) }), [101])
})

test('an un-stamp travels as a tombstone the server lacks', () => {
  const local = { 101: REC(9, { state: 'off' }) }
  assert.deepEqual(stampsToPublish(local, { 101: REC(5) }), [101])
  // …and one the server already knows about does not repeat.
  assert.deepEqual(stampsToPublish(local, { 101: REC(9, { state: 'off' }) }), [])
})

test('a record only the server has is never treated as a local removal', () => {
  // Absence must keep meaning "no opinion" — the whole reason removals are
  // explicit tombstones. A fresh device holding nothing must not erase anything.
  assert.deepEqual(stampsToPublish({}, { 101: REC(5) }), [])
})

test('the full round trip: two devices, neither empty, converge', () => {
  // The real situation this was written for — stamps made on a phone before the
  // store existed, and a different game stamped on a laptop afterwards.
  const phone = { 101: REC(5), 102: REC(6) }
  const laptop = { 303: REC(7) }

  // Phone signs in first against an empty server and backfills.
  assert.deepEqual(stampsToPublish(phone, {}), [101, 102])
  const server = { ...phone }

  // Laptop pulls, merges, and publishes only what the server is missing.
  const laptopMerged = applyRemoteStamps(laptop, server)
  assert.deepEqual(stampsToPublish(laptopMerged, server), [303])
  const server2 = { ...server, 303: REC(7) }

  // Phone pulls again and now holds all three, with nothing left to say.
  const phoneMerged = applyRemoteStamps(phone, server2)
  assert.deepEqual(Object.keys(phoneMerged).map(Number).sort((a, b) => a - b), [101, 102, 303])
  assert.deepEqual(stampsToPublish(phoneMerged, server2), [])
})

// THE SHARED-DEVICE LEAK (STAMPS_OWNER_KEY).
//
// A local-first collection plus an account leaks on a family iPad. User A signs
// in, their stamps sync down into `bbsbh:stamps`, A signs out, B signs in. The
// device still holds A's stamps as ordinary local state, and two things follow
// that neither user chose: `stampsToPublish` finds them "missing" from B's
// remote and pushes A's collection into B's ACCOUNT, and every game A stamped
// opens unsealed for B, because the unseal override only asks whether a stamp
// exists on this device (ADR-0048).
//
// Nulling the in-memory baseline on sign-out does not stop it — the next pull
// hands over a perfectly good baseline that happens to belong to the new user.
// Only knowing WHOSE collection this is stops it.
test('a collection belonging to another account is adopted away, never published', () => {
  const a = {
    777747: { state: 'on', mode: 'watched', stampedAt: 1, updatedAt: 1, date: '2026-05-27' },
    777748: { state: 'on', mode: 'watched', stampedAt: 2, updatedAt: 2, date: '2026-05-28' },
  }

  // B signs in on the same device. B's account holds one different game.
  const bRemote = {
    900001: { state: 'on', mode: 'followed', stampedAt: 9, updatedAt: 9, date: '2026-06-01' },
  }

  // The leak, stated as the assertion that used to fail: merging would keep A's
  // two games AND offer them up as B's to publish.
  const merged = applyRemoteStamps(a, bRemote)
  assert.ok(stampsToPublish(merged, bRemote).length > 0, 'the merge path really does offer A’s stamps for publish')

  // Adopting is what B's sign-in must do instead.
  const adopted = adoptRemoteStamps(bRemote)
  assert.deepEqual(Object.keys(adopted), ['900001'], 'B gets B’s collection and nothing else')
  assert.equal(stampFor(adopted, 777747), null, 'A’s game must not unseal for B')
  assert.deepEqual(stampsToPublish(adopted, bRemote), [], 'and nothing of A’s travels into B’s account')
})

// The guard must not fire on the ordinary paths, or it would discard a guest's
// own collection on their first sign-in — the case the owner tag exists to
// carry UP, not throw away.
test('the owner tag adopts only for a different account', () => {
  assert.equal(mergeStrategyFor('', 'user_a'), 'backfill', 'a guest’s own stamps backfill into their new account')
  assert.equal(mergeStrategyFor('user_a', 'user_a'), 'backfill', 'the same user on the same device is ordinary')
  assert.equal(mergeStrategyFor('user_a', 'user_b'), 'adopt', 'a different account adopts')
  assert.equal(mergeStrategyFor('user_a', null), 'none', 'signed out reconciles nothing')
})
