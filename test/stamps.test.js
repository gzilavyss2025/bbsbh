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
  MAX_STAMPS_PER_SEASON,
  addStamp,
  applyRemoteStamps,
  finalHalfIndex,
  isStamped,
  meetsRevealGate,
  normalizeStamp,
  parseStamps,
  removeStamp,
  sanitizeNote,
  seasonCounts,
  seasonFromDate,
  seasonIsFull,
  serializeStamps,
  stampFor,
  stampsForSeason,
  toGamePk,
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

test('a garbled remote payload degrades to no change', () => {
  const local = addStamp({}, 1, { date: '2026-05-18', now: 1000 })
  assert.deepEqual(applyRemoteStamps(local, null), local)
  assert.deepEqual(applyRemoteStamps(local, 'nope'), local)
  assert.deepEqual(applyRemoteStamps(local, { abc: { stampedAt: 1 }, 2: { junk: true } }), local)
})
