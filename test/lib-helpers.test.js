// Unit coverage for the small, pure lib helpers that had none — cheap to cover,
// and each has a real edge case (ordinal's 11/12/13, date parsing's off-by-one
// and garbled-input fallbacks, the SD-bucket tiering, the run-expectancy state
// machine's sign convention).
import assert from 'node:assert/strict'
import test from 'node:test'
import { ordinal } from '../src/lib/format.js'
import { toApiDate, addDays, monthDay, humanDate, scorebookDate, longDate } from '../src/lib/dates.js'
import { tierForZ, meanAndSd, TIER_LABELS } from '../src/lib/statTiers.js'
import {
  stateKey,
  re24Key,
  isTerminalOuts,
  advanceOnWalk,
  stateAfterBall,
  stateAfterStrike,
  lookupRE,
  pitchFavor,
} from '../src/lib/runExpectancy.js'

// --------------------------------------------------------------------------
// format.ordinal — the 11/12/13 vs 21/22/23 suffix rule
// --------------------------------------------------------------------------
test('ordinal suffixes the ones digit except the 11–13 teens', () => {
  assert.equal(ordinal(1), '1st')
  assert.equal(ordinal(2), '2nd')
  assert.equal(ordinal(3), '3rd')
  assert.equal(ordinal(4), '4th')
  assert.equal(ordinal(11), '11th')
  assert.equal(ordinal(12), '12th')
  assert.equal(ordinal(13), '13th')
  assert.equal(ordinal(21), '21st')
  assert.equal(ordinal(22), '22nd')
  assert.equal(ordinal(23), '23rd')
  assert.equal(ordinal(101), '101st')
  assert.equal(ordinal(111), '111th')
  assert.equal(ordinal(112), '112th')
  assert.equal(ordinal(113), '113th')
})

// --------------------------------------------------------------------------
// dates.js — deterministic parts pinned exactly; locale parts checked loosely
// --------------------------------------------------------------------------
test('toApiDate formats a Date as zero-padded YYYY-MM-DD', () => {
  assert.equal(toApiDate(new Date(2026, 0, 5)), '2026-01-05') // Jan (month 0)
  assert.equal(toApiDate(new Date(2026, 11, 31)), '2026-12-31')
})

test('addDays crosses month and year boundaries', () => {
  assert.equal(toApiDate(addDays(new Date(2026, 6, 30), 3)), '2026-08-02')
  assert.equal(toApiDate(addDays(new Date(2026, 11, 31), 1)), '2027-01-01')
  assert.equal(toApiDate(addDays(new Date(2026, 6, 5), -6)), '2026-06-29')
})

test('monthDay strips leading zeros and tolerates a garbled date', () => {
  assert.equal(monthDay('2026-07-05'), '7/5')
  assert.equal(monthDay('2026-11-20'), '11/20')
  assert.equal(monthDay(''), '')
  assert.equal(monthDay(null), '')
  assert.equal(monthDay('nope'), '')
})

test('the localized date formatters return a non-empty label for a real date', () => {
  // Locale output varies by ICU; assert only what is stable — non-empty, and
  // the year appears where the format includes it.
  assert.ok(humanDate('2026-07-05').length > 0)
  assert.match(scorebookDate('2026-07-05'), /2026/)
  assert.match(longDate('2026-07-05'), /2026/)
})

test('scorebookDate and longDate fall back to empty string on a bad date', () => {
  assert.equal(scorebookDate(''), '')
  assert.equal(scorebookDate('2026-7-5'), '') // not zero-padded → rejected
  assert.equal(longDate(null), '')
  assert.equal(longDate('garbage'), '')
})

// --------------------------------------------------------------------------
// statTiers.js — SD buckets and population mean/sd
// --------------------------------------------------------------------------
test('tierForZ buckets by full standard deviations around the mean', () => {
  assert.equal(tierForZ(1.5), 'elite')
  assert.equal(tierForZ(1), 'elite') // the boundary is inclusive
  assert.equal(tierForZ(0.4), 'good')
  assert.equal(tierForZ(0), 'good')
  assert.equal(tierForZ(-0.5), 'average')
  assert.equal(tierForZ(-1), 'average')
  assert.equal(tierForZ(-1.1), 'below')
  assert.deepEqual(Object.keys(TIER_LABELS).sort(), ['average', 'below', 'elite', 'good'])
})

test('meanAndSd computes the population (n) mean and sd', () => {
  assert.deepEqual(meanAndSd([2, 4, 4, 4, 5, 5, 7, 9]), { mean: 5, sd: 2, n: 8 })
  assert.deepEqual(meanAndSd([]), { mean: 0, sd: 0, n: 0 }) // empty pool
})

// --------------------------------------------------------------------------
// runExpectancy.js — the RE288 state machine
// --------------------------------------------------------------------------
test('state key builders and the terminal-outs guard', () => {
  assert.equal(stateKey(1, 0, 2, 1), '1-0-2-1')
  assert.equal(re24Key(3, 2), '3-2')
  assert.equal(isTerminalOuts(3), true)
  assert.equal(isTerminalOuts(2), false)
})

test('advanceOnWalk force-advances only where every base behind is occupied', () => {
  assert.deepEqual(advanceOnWalk(0), { baseMask: 1, runsScored: 0 }) // batter to 1B
  assert.deepEqual(advanceOnWalk(1), { baseMask: 3, runsScored: 0 }) // 1B forced to 2B
  assert.deepEqual(advanceOnWalk(3), { baseMask: 7, runsScored: 0 }) // 1B,2B forced up
  assert.deepEqual(advanceOnWalk(7), { baseMask: 7, runsScored: 1 }) // loaded → forced run
})

test('stateAfterBall increments the count then walks on ball four', () => {
  assert.deepEqual(stateAfterBall(0, 0, 2, 1), { baseMask: 0, outs: 0, balls: 3, strikes: 1, immediateRuns: 0 })
  assert.deepEqual(stateAfterBall(7, 1, 3, 0), { baseMask: 7, outs: 1, balls: 0, strikes: 0, immediateRuns: 1 })
})

test('stateAfterStrike increments the count then records an out on strike three', () => {
  assert.deepEqual(stateAfterStrike(0, 0, 1, 1), { baseMask: 0, outs: 0, balls: 1, strikes: 2, immediateRuns: 0 })
  assert.deepEqual(stateAfterStrike(0, 1, 0, 2), { baseMask: 0, outs: 2, balls: 0, strikes: 0, immediateRuns: 0 })
})

const RE_TABLE = {
  states: {
    '0-0-0-0': { sum: 100, n: 200 }, // 0.5
    '1-0-0-0': { sum: 5, n: 5 }, // thin — should fall back to re24
    '7-2-0-0': { sum: 80, n: 100 }, // 0.8
  },
  re24: {
    '0-0': { sum: 60, n: 100 }, // 0.6
    '1-0': { sum: 30, n: 60 }, // 0.5
  },
}

test('lookupRE prefers a well-sampled per-count cell, else the RE24 fallback, else 0', () => {
  assert.equal(lookupRE(RE_TABLE, 0, 0, 0, 0), 0.5) // cell n=200, used directly
  assert.equal(lookupRE(RE_TABLE, 1, 0, 0, 0), 0.5) // cell n=5 too thin → re24 '1-0'
  assert.equal(lookupRE(RE_TABLE, 0, 3, 0, 0), 0) // terminal outs
  assert.equal(lookupRE(RE_TABLE, 2, 1, 0, 0), 0) // nothing in the table
})

test('pitchFavor is signed toward the batting team', () => {
  // Bases loaded, 2 outs, full count. A phantom strikeout (pitch was really a
  // ball, ump called strike three) robs a forced run → COSTS the batting team.
  const robbed = pitchFavor(RE_TABLE, 7, 2, 3, 2, false)
  assert.ok(robbed < 0)
  assert.ok(Math.abs(robbed - -1.8) < 1e-9) // -(1 forced run + RE(7,2,0,0)=0.8)

  // The mirror: a gifted walk (pitch was really a strike, ump called ball four)
  // hands them a forced run → HELPS the batting team, equal and opposite.
  const gifted = pitchFavor(RE_TABLE, 7, 2, 3, 2, true)
  assert.ok(gifted > 0)
  assert.ok(Math.abs(gifted - 1.8) < 1e-9)
})
