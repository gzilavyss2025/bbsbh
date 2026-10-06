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

// ---- Which season the standings pages show, and whether it is over ----------
//
// The bug these pin: from the day after the last regular-season game to Oct 31
// the pages were neither "in season" nor "the offseason". They asked statsapi
// for standings dated YESTERDAY, a postseason day, and got zero records back
// (verified live: 2026-10-05 -> 0 records; no date -> the real final table).
// The row below is the real 2026 seasons row, trimmed to the dates that matter.
import {
  FIRST_STANDINGS_SEASON,
  WILD_CARD_ERA_FROM,
  standingsSeasonPhase,
  standingsSeasonsFrom,
  resolveStandingsSeason,
} from '../src/lib/time/standingsDates.js'

const ROW_2026 = {
  seasonId: '2026',
  springStartDate: '2026-02-20',
  regularSeasonStartDate: '2026-03-25',
  regularSeasonEndDate: '2026-09-27',
  offseasonStartDate: '2026-11-01',
}

test('mid-season is not final', () => {
  assert.deepEqual(standingsSeasonPhase('2026-07-07', ROW_2026), { final: false, season: 2026 })
})

test('the postseason is final: the regular season is over', () => {
  assert.deepEqual(standingsSeasonPhase('2026-10-06', ROW_2026), { final: true, season: 2026 })
})

test('the day after the last regular-season game is still not final: a tiebreaker game can land there', () => {
  // Game 163 is played the day after the scheduled finale. Asking for the
  // undated table while one is in progress could fold its result in.
  assert.equal(standingsSeasonPhase('2026-09-28', ROW_2026).final, false)
  assert.equal(standingsSeasonPhase('2026-09-29', ROW_2026).final, true)
})

test('winter still reads as the season that ended', () => {
  assert.deepEqual(standingsSeasonPhase('2026-12-14', ROW_2026), { final: true, season: 2026 })
  assert.deepEqual(
    standingsSeasonPhase('2027-01-20', { ...ROW_2026, seasonId: '2027', springStartDate: '2027-02-19', offseasonStartDate: '2027-11-01', regularSeasonEndDate: '2027-09-26' }),
    { final: true, season: 2026 },
  )
})

test('a missing or mismatched row fails closed to "in season"', () => {
  assert.deepEqual(standingsSeasonPhase('2026-10-06', null), { final: false, season: 2026 })
  assert.deepEqual(standingsSeasonPhase('2026-10-06', { ...ROW_2026, seasonId: '2025' }), { final: false, season: 2026 })
  assert.deepEqual(standingsSeasonPhase('2026-10-06', { ...ROW_2026, regularSeasonEndDate: undefined }), { final: false, season: 2026 })
})

test('the season list runs newest first down to the six-division era', () => {
  const list = standingsSeasonsFrom(2026)
  assert.equal(list[0], 2026)
  assert.equal(list.at(-1), FIRST_STANDINGS_SEASON)
  assert.equal(list.length, 2026 - FIRST_STANDINGS_SEASON + 1)
})

test('an asked-for season outside the list is the current one', () => {
  assert.equal(resolveStandingsSeason(2024, 2026), 2024)
  assert.equal(resolveStandingsSeason(2030, 2026), 2026)
  assert.equal(resolveStandingsSeason(1950, 2026), 2026)
  assert.equal(resolveStandingsSeason(undefined, 2026), 2026)
  assert.equal(resolveStandingsSeason('all', 2026), 2026)
})

test('a page with its own first season gets its own list and floor', () => {
  assert.deepEqual(standingsSeasonsFrom(2026, WILD_CARD_ERA_FROM), [2026, 2025, 2024, 2023, 2022])
  assert.equal(resolveStandingsSeason(2021, 2026, WILD_CARD_ERA_FROM), 2026)
  assert.equal(resolveStandingsSeason(2023, 2026, WILD_CARD_ERA_FROM), 2023)
})

test('the wild-card board starts with the 12-team format', () => {
  assert.equal(WILD_CARD_ERA_FROM, 2022)
})
