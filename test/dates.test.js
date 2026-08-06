// Unit coverage for lib/dates.js's isWithinDays — the "is this recent"
// window check behind Foul Tracker's single-game-highs NEW! stamp. Pins the
// inclusive boundaries (today itself, exactly N days ago, N+1 days ago) and
// the malformed/future-date fallbacks, since a date helper like this is easy
// to get off-by-one on.
import assert from 'node:assert/strict'
import test from 'node:test'
import { isWithinDays, timeOfDay, isFriday, isRealDate, asOfBounds, clampAsOfDate } from '../src/lib/dates.js'

const TODAY = new Date(2026, 6, 22) // July 22, 2026

test('today itself is within the window', () => {
  assert.equal(isWithinDays('2026-07-22', 7, TODAY), true)
})

test('exactly N days ago is within the window (inclusive)', () => {
  assert.equal(isWithinDays('2026-07-15', 7, TODAY), true)
})

test('N+1 days ago is outside the window', () => {
  assert.equal(isWithinDays('2026-07-14', 7, TODAY), false)
})

test('a future date is outside the window', () => {
  assert.equal(isWithinDays('2026-07-23', 7, TODAY), false)
})

test('a missing or garbled date returns false', () => {
  assert.equal(isWithinDays(null, 7, TODAY), false)
  assert.equal(isWithinDays('', 7, TODAY), false)
  assert.equal(isWithinDays('not-a-date', 7, TODAY), false)
})

// timeOfDay — the live-refresh staleness caption's "7:42 PM" formatter.
// Locale-formatted, so assert shape (hour:minute + AM/PM) rather than an
// exact string.
test('timeOfDay formats an epoch-ms timestamp as a 12-hour clock time', () => {
  const evening = new Date(2026, 6, 22, 19, 42).getTime()
  assert.match(timeOfDay(evening), /^\d{1,2}:\d{2}\s?[AP]M$/i)
})

test('timeOfDay degrades to empty string for a missing timestamp', () => {
  assert.equal(timeOfDay(null), '')
  assert.equal(timeOfDay(undefined), '')
  assert.equal(timeOfDay(0), '')
})

// isFriday — the City Connect default-jersey predictor's day-of-week check.
test('isFriday is true for a Friday date', () => {
  assert.equal(isFriday('2026-07-24'), true)
})

test('isFriday is false for a non-Friday date', () => {
  assert.equal(isFriday('2026-07-22'), false) // Wednesday
})

test('isFriday returns false for a missing or garbled date', () => {
  assert.equal(isFriday(null), false)
  assert.equal(isFriday(''), false)
  assert.equal(isFriday('not-a-date'), false)
})

// isRealDate — the as-of date control's guard against a garbled or hand-typed
// value (route.js has its own private copy for URL dates; this one guards a
// picker's applied value instead).
test('isRealDate accepts a real calendar date', () => {
  assert.equal(isRealDate('2026-07-22'), true)
})

test('isRealDate rejects an out-of-range month or day', () => {
  assert.equal(isRealDate('2026-13-01'), false) // no 13th month
  assert.equal(isRealDate('2026-02-30'), false) // Feb never has 30 days
})

test('isRealDate rejects a missing, garbled, or wrong-shaped value', () => {
  assert.equal(isRealDate(null), false)
  assert.equal(isRealDate(''), false)
  assert.equal(isRealDate('not-a-date'), false)
  assert.equal(isRealDate('07/22/2026'), false)
})

// asOfBounds / clampAsOfDate — the as-of date control's valid range: never
// later than today, never earlier than January 1st of today's year (a
// stand-in for "the season opener" — see the comment on asOfBounds for why
// exact per-level opening days aren't worth chasing here).
test('asOfBounds spans January 1st of the current year through today', () => {
  assert.deepEqual(asOfBounds(TODAY), { min: '2026-01-01', max: '2026-07-22' })
})

test('clampAsOfDate passes an in-range date through unchanged', () => {
  assert.equal(clampAsOfDate('2026-04-10', TODAY), '2026-04-10')
})

test('clampAsOfDate clamps a future pick to today', () => {
  assert.equal(clampAsOfDate('2026-12-25', TODAY), '2026-07-22')
})

test('clampAsOfDate clamps an implausibly early pick to the season floor', () => {
  assert.equal(clampAsOfDate('2025-11-01', TODAY), '2026-01-01')
})

test('clampAsOfDate treats the bounds themselves as in range', () => {
  assert.equal(clampAsOfDate('2026-01-01', TODAY), '2026-01-01')
  assert.equal(clampAsOfDate('2026-07-22', TODAY), '2026-07-22')
})

test('clampAsOfDate returns null for a garbled or missing value', () => {
  assert.equal(clampAsOfDate('', TODAY), null)
  assert.equal(clampAsOfDate(null, TODAY), null)
  assert.equal(clampAsOfDate('not-a-date', TODAY), null)
})
