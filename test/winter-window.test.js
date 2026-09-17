// THE WINTER TAB's pure half (src/lib/winter/window.js) — the module that
// decides whether the rail carries a sixth tab on a given date, which leagues
// the picker offers, and which of them the tab opens on.
//
// The calendar below is REAL. Every date came off
// /api/v1/schedule?sportId=17&leagueId={id}&season=2025, read live on
// 2026-09-17, and the per-day game counts are that response's own. Two facts it
// pins are undocumented and were measured rather than assumed:
//
//   A winter league's season is named for the year it STARTS in. `season=2025`
//   answers October 2025 through February 2026. Asking `season=2026` for a
//   January 2026 date returns the NEXT winter, or nothing.
//
//   The four leagues do not run together. The AFL is over on November 14 while
//   the other three run to late January and, for Venezuela, February 2.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultWinterLeagueId,
  hasWinterTab,
  leaguesOnDate,
  resolveWinterLeagueId,
  winterSeasonFor,
} from '../src/lib/winter/window.js'

const FALL = 119
const MEX = 132
const VEN = 135
const DOM = 131

// Measured spans, with the game counts for the handful of days asserted below.
const CALENDAR = {
  [FALL]: {
    leagueId: FALL,
    firstDate: '2025-10-06',
    lastDate: '2025-11-14',
    gamesByDate: { '2025-10-08': 3, '2025-10-16': 3, '2025-11-04': 3, '2025-11-14': 3 },
  },
  [MEX]: {
    leagueId: MEX,
    firstDate: '2025-10-15',
    lastDate: '2026-01-25',
    gamesByDate: { '2025-10-16': 5, '2025-11-04': 5 },
  },
  [VEN]: {
    leagueId: VEN,
    firstDate: '2025-10-15',
    lastDate: '2026-02-02',
    gamesByDate: { '2025-10-16': 4, '2025-11-04': 4, '2025-12-15': 2, '2026-01-20': 2 },
  },
  [DOM]: {
    leagueId: DOM,
    firstDate: '2025-10-15',
    lastDate: '2026-01-27',
    gamesByDate: { '2025-10-16': 3, '2025-11-04': 3, '2025-12-15': 1 },
  },
}

test('a winter season is named for the year it starts in', () => {
  // October through December is its own year's winter.
  assert.equal(winterSeasonFor('2025-10-06'), 2025)
  assert.equal(winterSeasonFor('2025-12-31'), 2025)
  // January and February are still LAST year's winter, which is the whole
  // trap: asking statsapi for season=2026 on these dates answers with the next
  // winter, or with nothing at all.
  assert.equal(winterSeasonFor('2026-01-20'), 2025)
  assert.equal(winterSeasonFor('2026-02-02'), 2025)
  // The cut sits at August, two clear months before the earliest opener.
  assert.equal(winterSeasonFor('2026-07-15'), 2025)
  assert.equal(winterSeasonFor('2026-08-01'), 2026)
  assert.equal(winterSeasonFor(null), null)
  assert.equal(winterSeasonFor('not-a-date'), null)
})

test('the tab exists across the winter and nowhere else', () => {
  assert.equal(hasWinterTab(CALENDAR, '2025-10-05'), false) // day before the AFL opens
  assert.equal(hasWinterTab(CALENDAR, '2025-10-06'), true) // opening day
  assert.equal(hasWinterTab(CALENDAR, '2026-02-02'), true) // the last game of the winter
  assert.equal(hasWinterTab(CALENDAR, '2026-02-03'), false) // the day after
  // In season the rail is the five levels it has always been.
  assert.equal(hasWinterTab(CALENDAR, '2026-07-15'), false)
})

test('the picker offers a league on every day of its own season', () => {
  // Before the other three open, the AFL is alone.
  assert.deepEqual(
    leaguesOnDate(CALENDAR, '2025-10-08').map((l) => l.chip),
    ['FALL'],
  )
  // All four, in rail order rather than in the calendar's key order.
  assert.deepEqual(
    leaguesOnDate(CALENDAR, '2025-10-16').map((l) => l.chip),
    ['FALL', 'MEX', 'VEN', 'DOM'],
  )
  // FALL leaves when its season ends, not when it has an idle day.
  assert.deepEqual(
    leaguesOnDate(CALENDAR, '2025-12-15').map((l) => l.chip),
    ['MEX', 'VEN', 'DOM'],
  )
  // A league in season with no game today is still offered, and says so with a
  // zero rather than by disappearing.
  const dec15 = leaguesOnDate(CALENDAR, '2025-12-15')
  assert.equal(dec15.find((l) => l.chip === 'MEX').games, 0)
  assert.equal(dec15.find((l) => l.chip === 'VEN').games, 2)
})

test('FALL keeps the default while it plays, although it is never the busiest', () => {
  // October 16: the Mexican league has five games to the AFL's three. Volume
  // must not take the default, because the AFL is the league holding the
  // players whose own tabs went dark in September.
  assert.equal(defaultWinterLeagueId(CALENDAR, '2025-10-16'), FALL)
  assert.equal(defaultWinterLeagueId(CALENDAR, '2025-11-04'), FALL)
  // Once the AFL is over, volume decides.
  assert.equal(defaultWinterLeagueId(CALENDAR, '2025-12-15'), VEN)
  assert.equal(defaultWinterLeagueId(CALENDAR, '2026-01-20'), VEN)
  assert.equal(defaultWinterLeagueId(CALENDAR, '2026-07-15'), null)
})

test('a URL naming a league out of season falls back rather than showing nothing', () => {
  // A shared '/fall/12152025' — the AFL ended a month before this date.
  assert.equal(resolveWinterLeagueId(CALENDAR, '2025-12-15', FALL), VEN)
  // A league that IS in season is kept, whether or not it plays that day.
  assert.equal(resolveWinterLeagueId(CALENDAR, '2025-12-15', MEX), MEX)
  assert.equal(resolveWinterLeagueId(CALENDAR, '2025-10-16', DOM), DOM)
})

test('everything fails closed, so a bad fetch cannot re-order the rail', () => {
  for (const empty of [null, undefined, {}]) {
    assert.equal(hasWinterTab(empty, '2025-11-04'), false)
    assert.deepEqual(leaguesOnDate(empty, '2025-11-04'), [])
    assert.equal(defaultWinterLeagueId(empty, '2025-11-04'), null)
    assert.equal(resolveWinterLeagueId(empty, '2025-11-04', FALL), null)
  }
  // A league whose own call failed is absent from the calendar, and the rest
  // carry on. On 2026-09-17 this was the real state of the 2026-27 winter: the
  // Venezuelan schedule had not been published while the other three had.
  const partial = { [FALL]: CALENDAR[FALL], [MEX]: CALENDAR[MEX] }
  assert.deepEqual(
    leaguesOnDate(partial, '2025-11-04').map((l) => l.chip),
    ['FALL', 'MEX'],
  )
  // A row with an unusable span is dropped rather than trusted.
  const broken = { [FALL]: { leagueId: FALL, firstDate: null, lastDate: '2025-11-14' } }
  assert.equal(hasWinterTab(broken, '2025-11-04'), false)
  // An unparseable date is not a winter date.
  assert.equal(hasWinterTab(CALENDAR, 'tomorrow'), false)
})
