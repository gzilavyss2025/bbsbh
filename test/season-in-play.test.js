import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seasonInPlay } from '../scripts/lib/time/season-in-play.mjs'

// statsapi's 2027 row has regularSeasonStartDate in late March; this is the
// shape the helper reads (fields=seasons,seasonId,regularSeasonStartDate).
const row2027 = { seasonId: '2027', regularSeasonStartDate: '2027-03-25' }
const row2026 = { seasonId: '2026', regularSeasonStartDate: '2026-03-25' }

test('January 1 with only 2026 played: the season is still 2026 (#1465)', () => {
  assert.equal(seasonInPlay('2027-01-01', row2027), 2026)
  assert.equal(seasonInPlay('2027-01-05', row2027), 2026)
})

test('spring training stays on the old season', () => {
  assert.equal(seasonInPlay('2027-03-01', row2027), 2026)
  assert.equal(seasonInPlay('2027-03-24', row2027), 2026)
})

test('Opening Day turns the season', () => {
  assert.equal(seasonInPlay('2027-03-25', row2027), 2027)
  assert.equal(seasonInPlay('2027-07-04', row2027), 2027)
})

test('October and the late-year winter belong to the season just played', () => {
  assert.equal(seasonInPlay('2026-10-05', row2026), 2026)
  assert.equal(seasonInPlay('2026-12-31', row2026), 2026)
})

test('no row: the calendar fallback turns on April 1', () => {
  assert.equal(seasonInPlay('2027-01-05', null), 2026)
  assert.equal(seasonInPlay('2027-03-31', null), 2026)
  assert.equal(seasonInPlay('2027-04-01', null), 2027)
  assert.equal(seasonInPlay('2026-11-15', null), 2026)
})

test('a row for another year, or with no start date, is not read', () => {
  assert.equal(seasonInPlay('2027-01-05', row2026), 2026)
  assert.equal(seasonInPlay('2027-03-26', row2026), 2026)
  assert.equal(seasonInPlay('2027-01-05', { seasonId: '2027' }), 2026)
  assert.equal(seasonInPlay('2027-05-01', { seasonId: 2027, regularSeasonStartDate: 'soon' }), 2027)
})

test('a bad day is an error, not a guess', () => {
  assert.throws(() => seasonInPlay('2027-1-5', row2027), TypeError)
  assert.throws(() => seasonInPlay(undefined, row2027), TypeError)
})
