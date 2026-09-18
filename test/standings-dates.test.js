// THE STANDINGS PAGE'S DATE ARITHMETIC — split out of StandingsPage.jsx with
// the file (ADR-0038), and pinned here because a date that is one day out on
// that page is a spoiler rather than a cosmetic bug: "entering today" is the
// whole reason the page is safe to open in September.
import assert from 'node:assert/strict'
import test from 'node:test'
import { baseballToday, buildJumps, labelDate, shiftDays } from '../src/lib/time/standingsDates.js'

test('day math never drifts across a month, a year or a daylight-saving edge', () => {
  assert.equal(shiftDays('2026-07-07', -1), '2026-07-06')
  assert.equal(shiftDays('2026-03-01', -1), '2026-02-28')
  assert.equal(shiftDays('2026-01-01', -1), '2025-12-31')
  // US daylight saving began March 8, 2026. A local-midnight Date would land on
  // the 7th here and quietly fold a day of games back in.
  assert.equal(shiftDays('2026-03-09', -1), '2026-03-08')
  assert.equal(shiftDays('2026-07-07', -30), '2026-06-07')
})

test('the quick-jumps only offer days that are already past', () => {
  const jumps = buildJumps('2026-07-07')
  assert.equal(jumps[0].key, '30d')
  assert.equal(jumps[0].date, '2026-06-07')
  assert.deepEqual(
    jumps.slice(1).map((j) => j.date),
    ['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01'],
  )
  // On the 1st of a month that button would equal today and fold in tonight's
  // games, so it is simply absent.
  assert.deepEqual(
    buildJumps('2026-07-01')
      .slice(1)
      .map((j) => j.date),
    ['2026-04-01', '2026-05-01', '2026-06-01'],
  )
  // April is the first month offered — an earlier one would only ever show an
  // empty pre-season table.
  assert.equal(buildJumps('2026-04-15')[1].label, 'Apr 1')
})

test('a date reads as a date, and today is a plain ISO day', () => {
  assert.match(labelDate('2026-07-07'), /Jul 7, 2026/)
  assert.match(baseballToday(), /^\d{4}-\d{2}-\d{2}$/)
})
