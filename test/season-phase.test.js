// THE OFFSEASON GATE's pure half (src/lib/time/seasonPhase.js) — the module
// that decides whether the MLB slate is looking at a winter, and which dated
// milestones that winter is allowed to show.
//
// Every row below is a REAL statsapi seasons row, read live on 2026-09-15 from
// /api/v1/seasons/{year}?sportId=1. That matters more here than in most fixture
// tests: the whole design of this module rests on a shape MLB publishes and
// does not document — that a season row splits the winter it opens into an
// "offseason" half ending December 31 and a "preseason" half starting January
// 1, so neither half alone is the winter a reader lives through.
//
// The dates were also checked against the schedule itself. Across 2025-26 the
// MLB tab had no played game from November 2 to February 19 inclusive, which is
// exactly the join this module computes, to the day.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  currentMilestone,
  daysBetween,
  offseasonPhase,
  parseWinterCalendar,
} from '../src/lib/time/seasonPhase.js'

const SEASON_2025 = {
  seasonId: '2025',
  preSeasonStartDate: '2025-01-01',
  preSeasonEndDate: '2025-02-19',
  springStartDate: '2025-02-20',
  regularSeasonStartDate: '2025-03-18',
  regularSeasonEndDate: '2025-09-28',
  postSeasonStartDate: '2025-09-30',
  postSeasonEndDate: '2025-11-01',
  offseasonStartDate: '2025-11-02',
  offSeasonEndDate: '2025-12-31',
}

const SEASON_2026 = {
  seasonId: '2026',
  preSeasonStartDate: '2026-01-01',
  preSeasonEndDate: '2026-02-19',
  springStartDate: '2026-02-20',
  regularSeasonStartDate: '2026-03-25',
  regularSeasonEndDate: '2026-09-27',
  postSeasonStartDate: '2026-09-28',
  postSeasonEndDate: '2026-10-31',
  offseasonStartDate: '2026-11-01',
  offSeasonEndDate: '2026-12-31',
}

test('in season is not the offseason, at every stage of a season', () => {
  for (const date of [
    '2026-03-01', // spring training
    '2026-03-25', // Opening Day
    '2026-07-14', // the All-Star Game
    '2026-09-27', // the last day of the regular season
    '2026-10-15', // October — the case a games-are-empty test gets wrong
    '2026-10-31', // the last possible day of the World Series
  ]) {
    assert.equal(offseasonPhase(date, SEASON_2026), null, date)
  }
})

test('October is in season on the published dates alone', () => {
  // The design study asked whether October counts as offseason. It does not,
  // and nothing about the schedule is consulted to say so: postSeasonEndDate
  // runs to October 31 and offseasonStartDate opens November 1.
  assert.equal(offseasonPhase('2026-10-01', SEASON_2026), null)
  assert.deepEqual(offseasonPhase('2026-11-01', SEASON_2026), {
    seasonEnded: 2026,
    startDate: '2026-11-01',
    springStartDate: null,
    springFromNextSeason: 2027,
  })
})

test('November and December are the season that just ended, and look forward', () => {
  const phase = offseasonPhase('2026-12-10', SEASON_2026)
  // NOT `new Date().getFullYear() - 1`, which is wrong for all of November and
  // December — the season that just ended in December 2026 is 2026.
  assert.equal(phase.seasonEnded, 2026)
  assert.equal(phase.startDate, '2026-11-01')
  // Spring is on the NEXT row, so the caller is told which one to fetch.
  assert.equal(phase.springStartDate, null)
  assert.equal(phase.springFromNextSeason, 2027)
})

test('January and February are still last season, and need no second row', () => {
  const phase = offseasonPhase('2026-01-15', SEASON_2026)
  assert.equal(phase.seasonEnded, 2025)
  // statsapi rolled the season over on January 1, so this row is already the
  // upcoming season's and carries the spring date itself.
  assert.equal(phase.springStartDate, '2026-02-20')
  assert.equal(phase.springFromNextSeason, null)
})

test('the winter closes the day spring training opens', () => {
  assert.notEqual(offseasonPhase('2026-02-19', SEASON_2026), null)
  assert.equal(offseasonPhase('2026-02-20', SEASON_2026), null)
})

test('the join matches the schedule: Nov 2 2025 to Feb 19 2026, to the day', () => {
  // Measured live: the MLB tab had no played game across exactly this span.
  assert.equal(offseasonPhase('2025-11-01', SEASON_2025), null) // Series could still run
  assert.notEqual(offseasonPhase('2025-11-02', SEASON_2025), null)
  assert.notEqual(offseasonPhase('2026-02-19', SEASON_2026), null)
  assert.equal(offseasonPhase('2026-02-20', SEASON_2026), null)
})

test('it fails closed on anything it cannot read', () => {
  assert.equal(offseasonPhase('2026-12-10', null), null)
  assert.equal(offseasonPhase('2026-12-10', {}), null)
  assert.equal(offseasonPhase('', SEASON_2026), null)
  assert.equal(offseasonPhase('not-a-date', SEASON_2026), null)
  // A row for the wrong year describes a different winter, so every comparison
  // against it would be meaningless — refused rather than answered.
  assert.equal(offseasonPhase('2026-12-10', SEASON_2025), null)
  // A row missing either bound cannot place a date inside the winter.
  assert.equal(
    offseasonPhase('2026-12-10', { ...SEASON_2026, offseasonStartDate: undefined }),
    null,
  )
  assert.equal(offseasonPhase('2026-12-10', { ...SEASON_2026, springStartDate: '' }), null)
})

test('the winter calendar keeps only well-formed lines inside the window', () => {
  const rows = parseWinterCalendar(
    [
      '2026-12-10 | Rule 5 draft',
      '2027-01-09 | Arbitration filing',
      '', // blank
      'Winter meetings', // no date, no pipe
      '12-10 | Rule 5 draft', // not a full ISO date
      '2027-01-20 |', // no label
      '2026-06-01 | Trade deadline', // in season — outside the window
      '2027-04-01 | Opening Day', // after spring — outside the window
    ].join('\n'),
    { startDate: '2026-11-01', endDate: '2027-02-19' },
  )
  assert.deepEqual(rows, [
    { date: '2026-12-10', label: 'Rule 5 draft' },
    { date: '2027-01-09', label: 'Arbitration filing' },
  ])
})

test('an unedited calendar from last winter renders nothing, not wrong dates', () => {
  // The failure this module exists to prevent. Last winter's dates are all
  // outside this winter's window, so every one of them drops — the strip is
  // short rather than confidently wrong.
  const stale = '2025-12-10 | Rule 5 draft\n2026-01-09 | Arbitration filing'
  assert.deepEqual(
    parseWinterCalendar(stale, { startDate: '2026-11-01', endDate: '2027-02-19' }),
    [],
  )
})

test('the calendar sorts, dedupes exact repeats, and survives junk input', () => {
  const rows = parseWinterCalendar(
    [
      '2027-01-20 | Hall of Fame vote',
      '2026-11-18 | 40-man deadline',
      '2027-01-20 | Hall of Fame vote', // exact repeat — one line, twice
      '2027-01-20 | Arbitration figures', // same day, different thing — kept
    ].join('\n'),
    { startDate: '2026-11-01', endDate: '2027-02-19' },
  )
  assert.deepEqual(rows.map((r) => r.date), ['2026-11-18', '2027-01-20', '2027-01-20'])
  assert.deepEqual(parseWinterCalendar(null), [])
  assert.deepEqual(parseWinterCalendar(undefined), [])
  assert.deepEqual(parseWinterCalendar(42), [])
})

test('the calendar marks the next milestone, and nothing once they have passed', () => {
  const rows = [
    { date: '2026-11-18', label: '40-man deadline' },
    { date: '2026-12-10', label: 'Rule 5 draft' },
    { date: '2027-01-20', label: 'Hall of Fame vote' },
  ]
  assert.equal(currentMilestone(rows, '2026-11-01'), 0)
  assert.equal(currentMilestone(rows, '2026-12-10'), 1) // the day itself is still ahead
  assert.equal(currentMilestone(rows, '2026-12-11'), 2)
  assert.equal(currentMilestone(rows, '2027-02-01'), -1)
  assert.equal(currentMilestone([], '2026-12-10'), -1)
  assert.equal(currentMilestone(rows, 'nope'), -1)
})

test('the countdown counts calendar days, not elapsed hours', () => {
  assert.equal(daysBetween('2026-12-10', '2027-02-19'), 71)
  assert.equal(daysBetween('2027-02-18', '2027-02-19'), 1)
  assert.equal(daysBetween('2027-02-19', '2027-02-19'), 0)
  // Across a US daylight-saving boundary (November 1, 2026), where subtracting
  // two local Dates would give 24.04 days and round to the wrong side.
  assert.equal(daysBetween('2026-10-25', '2026-11-18'), 24)
  // And across a leap day.
  assert.equal(daysBetween('2028-02-01', '2028-03-01'), 29)
  assert.equal(daysBetween('bad', '2027-02-19'), null)
  assert.equal(daysBetween('2026-12-10', null), null)
})
