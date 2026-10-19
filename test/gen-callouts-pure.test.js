import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  iso,
  DOW_OF,
  isBirthdayOn,
  walkoffInningOf,
  formatAvg,
  nearestHitterMilestone,
  nearestPitcherMilestone,
} from '../scripts/lib/callouts/pure.mjs'

test('iso formats a UTC calendar date', () => {
  assert.equal(iso(new Date('2026-07-05T23:59:00Z')), '2026-07-05')
})

test('DOW_OF reads the weekday at UTC noon', () => {
  assert.equal(DOW_OF('2026-07-05'), 0) // Sunday
  assert.equal(DOW_OF('2026-07-06'), 1) // Monday
})

test('isBirthdayOn compares month and day only', () => {
  assert.equal(isBirthdayOn('1995-07-05', '2026-07-05'), true)
  assert.equal(isBirthdayOn('1995-07-06', '2026-07-05'), false)
  assert.equal(isBirthdayOn(null, '2026-07-05'), false)
  assert.equal(isBirthdayOn('2000-02-29', '2026-02-28'), false)
})

test('walkoffInningOf finds a home win that took the lead in the last inning', () => {
  const walkoff = [
    { num: 1, away: { runs: 0 }, home: { runs: 0 } },
    { num: 2, away: { runs: 2 }, home: { runs: 0 } },
    { num: 3, away: { runs: 0 }, home: { runs: 3 } },
  ]
  assert.equal(walkoffInningOf(walkoff), 3)
})

test('walkoffInningOf is null when the home club already led, or on a road win', () => {
  assert.equal(
    walkoffInningOf([
      { num: 1, away: { runs: 0 }, home: { runs: 4 } },
      { num: 2, away: { runs: 0 }, home: { runs: 1 } },
    ]),
    null,
  )
  assert.equal(walkoffInningOf([{ num: 1, away: { runs: 3 }, home: { runs: 1 } }]), null)
  assert.equal(walkoffInningOf([]), null)
  assert.equal(walkoffInningOf(undefined), null)
})

test('formatAvg formats like the API and guards zero at-bats', () => {
  assert.equal(formatAvg(1, 0), '.000')
  assert.equal(formatAvg(7, 20), '.350')
  assert.equal(formatAvg(4, 4), '1.000')
})

test('the milestone pickers return null with no stat in reach', () => {
  assert.equal(nearestHitterMilestone({}), null)
  assert.equal(nearestPitcherMilestone({}), null)
})
