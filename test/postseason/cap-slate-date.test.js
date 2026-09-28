import { test } from 'node:test'
import assert from 'node:assert/strict'
import { capSlateDate, isPostseasonWindow, atForwardLimit } from '../../src/lib/postseason/capSlateDate.js'

// The 2026 season row, checked live 2026-09-28 (see docs/adr/0087-*): the
// postseason window runs 2026-09-28 through 2026-10-31, the day before
// offseasonStartDate.
const SEASON_2026 = {
  postSeasonStartDate: '2026-09-28',
  postSeasonEndDate: '2026-10-31',
  offseasonStartDate: '2026-11-01',
}

// A season row from well before the postseason window opens (mid-season),
// used for the "outside the window" cases.
const SEASON_MIDYEAR = {
  postSeasonStartDate: '2026-09-28',
  postSeasonEndDate: '2026-10-31',
  offseasonStartDate: '2026-11-01',
}

test('isPostseasonWindow: today inside postSeasonStartDate..offseasonStartDate-1 is true', () => {
  assert.equal(isPostseasonWindow('2026-09-28', SEASON_2026), true)
  assert.equal(isPostseasonWindow('2026-10-31', SEASON_2026), true)
})

test('isPostseasonWindow: today before postSeasonStartDate or on/after offseasonStartDate is false', () => {
  assert.equal(isPostseasonWindow('2026-09-27', SEASON_2026), false)
  assert.equal(isPostseasonWindow('2026-11-01', SEASON_2026), false)
})

test('isPostseasonWindow: a missing or incomplete season row is false, never a guess', () => {
  assert.equal(isPostseasonWindow('2026-09-28', null), false)
  assert.equal(isPostseasonWindow('2026-09-28', {}), false)
  assert.equal(isPostseasonWindow('2026-09-28', { postSeasonStartDate: '2026-09-28' }), false)
})

// Test 9, case 1: in the window, a date after today resolves to today.
test('capSlateDate: in the window, a date after today resolves to today', () => {
  assert.equal(capSlateDate('2026-10-15', '2026-09-29', SEASON_2026), '2026-09-29')
  // Even a date past the window's own end still caps at today — the rule is
  // "never after today", not "never past the window".
  assert.equal(capSlateDate('2026-11-15', '2026-09-29', SEASON_2026), '2026-09-29')
})

// Test 9, case 2: today and past dates pass through.
test('capSlateDate: today and past dates pass through untouched', () => {
  assert.equal(capSlateDate('2026-09-29', '2026-09-29', SEASON_2026), '2026-09-29')
  assert.equal(capSlateDate('2026-09-15', '2026-09-29', SEASON_2026), '2026-09-15')
})

// Test 9, case 3: outside the window, a future date passes through.
test('capSlateDate: outside the window, a future date passes through', () => {
  // Today (June) is not in the postseason window, so browsing ahead to an
  // ordinary upcoming regular-season date is unaffected.
  assert.equal(capSlateDate('2026-06-05', '2026-06-01', SEASON_MIDYEAR), '2026-06-05')
})

// Test 9, case 4: a missing/loading season row never lets a future date
// through unchecked — the safe default is to cap, exactly as if the window
// were confirmed, because the alternative risks a spoiling slate flashing
// before the row lands. See the module header.
test('capSlateDate: a missing or loading season row caps a future date (fails closed)', () => {
  assert.equal(capSlateDate('2026-10-15', '2026-09-29', null), '2026-09-29')
  assert.equal(capSlateDate('2026-10-15', '2026-09-29', undefined), '2026-09-29')
})

// The forward arrow's own limit: pinned so it cannot silently start allowing
// a tap past today again.
test('atForwardLimit: true only at today, and only while today is in the window', () => {
  assert.equal(atForwardLimit('2026-09-29', '2026-09-29', SEASON_2026), true)
  assert.equal(atForwardLimit('2026-09-15', '2026-09-29', SEASON_2026), false)
  assert.equal(atForwardLimit('2026-06-01', '2026-06-01', SEASON_MIDYEAR), false)
})
