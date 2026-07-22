// Unit coverage for lib/dates.js's isWithinDays — the "is this recent"
// window check behind Foul Tracker's single-game-highs NEW! stamp. Pins the
// inclusive boundaries (today itself, exactly N days ago, N+1 days ago) and
// the malformed/future-date fallbacks, since a date helper like this is easy
// to get off-by-one on.
import assert from 'node:assert/strict'
import test from 'node:test'
import { isWithinDays, timeOfDay } from '../src/lib/dates.js'

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
