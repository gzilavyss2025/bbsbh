import assert from 'node:assert/strict'
import test from 'node:test'
import { detectInjuredList, careerRegisterView } from '../src/api/person.js'

// ---------------------------------------------------------------------------
// Real fixture rows — pulled live from
// https://statsapi.mlb.com/api/v1/transactions?playerId={id}&startDate=…&endDate=…
// on 2026-08-04 while auditing which roster moves the player page drops.
// Every field is copied verbatim from the live response.
//
// Two defects motivated this file, both in the SC keyword matching that
// detectInjuredList (and the career register's gap note) key on:
//
//   1. The injured list was called the DISABLED list until 2019. The
//      predicates only matched /injured list/, so no pre-2019 placement was
//      ever seen — a player genuinely on the DL read as healthy, and a season
//      lost to injury could not earn the register's "Injured — missed season"
//      note. The feed is inconsistent WITHIN a stint too (Betts 2018 is placed
//      on a "disabled list" and activated from an "injured list"), and one
//      2021 row drops the hyphen entirely ("the 10 day disabled list").
//   2. An All-Star selection re-parks an injured player on the All-Star club's
//      RESERVE list, and his own club then activates him from THAT list — so
//      the stint never gets an "activated from the injured list" row at all.
//      The stint stayed open until the season-boundary reset, pinning the IL
//      banner on a healthy player for the rest of the year.
// ---------------------------------------------------------------------------

const RED_SOX = { id: 111, name: 'Boston Red Sox' }
const DODGERS = { id: 119, name: 'Los Angeles Dodgers' }
const ASTROS = { id: 117, name: 'Houston Astros' }
const YANKEES = { id: 147, name: 'New York Yankees' }
const NL_ALL_STARS = { id: 160, name: 'National League All-Stars' }

// Betts 2015 — a pre-2019 stint, "disabled list" on both ends.
const BETTS_2015_DL = [
  {
    id: 240022, typeCode: 'SC', date: '2015-07-29', effectiveDate: '2015-07-29',
    person: { id: 605141, fullName: 'Mookie Betts' }, toTeam: RED_SOX,
    description: 'Boston Red Sox placed CF Mookie Betts on the 7-day disabled list. Concussion symptoms',
  },
  {
    id: 241522, typeCode: 'ASG', date: '2015-08-09', effectiveDate: '2015-08-09',
    person: { id: 605141, fullName: 'Mookie Betts' }, fromTeam: RED_SOX,
    toTeam: { id: 546, name: 'Portland Sea Dogs' },
    description: 'Boston Red Sox sent OF Mookie Betts on a rehab assignment to Portland Sea Dogs.',
  },
  {
    id: 241763, typeCode: 'SC', date: '2015-08-11', effectiveDate: '2015-08-11',
    person: { id: 605141, fullName: 'Mookie Betts' }, toTeam: RED_SOX,
    description: 'Boston Red Sox activated RF Mookie Betts from the 7-day disabled list.',
  },
]

// Betts 2018 — the feed switches vocabulary mid-stint: placed on a "disabled
// list", activated from an "injured list".
const BETTS_2018_MIXED = [
  {
    id: 356934, typeCode: 'SC', date: '2018-06-01', effectiveDate: '2018-05-29',
    person: { id: 605141, fullName: 'Mookie Betts' }, toTeam: RED_SOX,
    description: 'Boston Red Sox placed RF Mookie Betts on the 10-day disabled list retroactive to May 29, 2018. Left abdominal strain.',
  },
  {
    id: 359142, typeCode: 'SC', date: '2018-06-11', effectiveDate: '2018-06-11',
    person: { id: 605141, fullName: 'Mookie Betts' }, toTeam: RED_SOX,
    description: 'Boston Red Sox activated RF Mookie Betts from the 10-day injured list.',
  },
]

// Valdez 2021 — the unhyphenated "10 day disabled list" form.
const VALDEZ_2021_UNHYPHENATED = [
  {
    id: 476025, typeCode: 'SC', date: '2021-04-01', effectiveDate: '2021-03-29',
    person: { id: 664285, fullName: 'Framber Valdez' }, toTeam: ASTROS,
    description: 'Houston Astros placed P Framber Valdez on the 10 day disabled list.',
  },
  {
    id: 491208, typeCode: 'SC', date: '2021-05-28', effectiveDate: '2021-05-28',
    person: { id: 664285, fullName: 'Framber Valdez' }, toTeam: ASTROS,
    description: 'Houston Astros activated LHP Framber Valdez from the 10-day injured list.',
  },
]

// Betts 2024 — the All-Star reserve-list closer. He is hurt on 6-17, selected
// to the NL All-Stars on 7-15 (which parks him on THEIR reserve list), and the
// Dodgers activate him from the reserve list on 8-12. There is no "activated
// from the injured list" row anywhere in the stint.
const BETTS_2024_RESERVE_LIST = [
  {
    id: 781002, typeCode: 'SC', date: '2024-06-17', effectiveDate: '2024-06-17',
    person: { id: 605141, fullName: 'Mookie Betts' }, toTeam: DODGERS,
    description: 'Los Angeles Dodgers placed RF Mookie Betts on the 10-day injured list. Left hand fracture.',
  },
  {
    id: 786336, typeCode: 'SC', date: '2024-07-15', effectiveDate: '2024-07-15',
    person: { id: 605141, fullName: 'Mookie Betts' }, toTeam: NL_ALL_STARS,
    description: 'National League All-Stars placed RF Mookie Betts on the reserve list.',
  },
  {
    id: 785744, typeCode: 'ASG', date: '2024-07-15', effectiveDate: '2024-07-15',
    person: { id: 605141, fullName: 'Mookie Betts' }, toTeam: NL_ALL_STARS,
    description: 'RF Mookie Betts assigned to National League All-Stars.',
  },
  {
    id: 794137, typeCode: 'SC', date: '2024-08-12', effectiveDate: '2024-08-12',
    person: { id: 605141, fullName: 'Mookie Betts' }, toTeam: DODGERS,
    description: 'Los Angeles Dodgers activated RF Mookie Betts from the reserve list.',
  },
]

// Judge 2023 — the PHANTOM reinstatement the existing guard exists for: the
// All-Star club "activates" a player who is still hurt. His real return is the
// Yankees' own activation 18 days later. Must not close the stint early.
const JUDGE_2023_PHANTOM = [
  {
    id: 702060, typeCode: 'SC', date: '2023-06-07', effectiveDate: '2023-06-04',
    person: { id: 592450, fullName: 'Aaron Judge' }, toTeam: YANKEES,
    description: 'New York Yankees placed RF Aaron Judge on the 10-day injured list retroactive to June 4, 2023. Right great toe sprain.',
  },
  {
    id: 707851, typeCode: 'SC', date: '2023-07-10', effectiveDate: '2023-07-10',
    person: { id: 592450, fullName: 'Aaron Judge' }, toTeam: { id: 159, name: 'American League All-Stars' },
    description: 'American League All-Stars activated RF Aaron Judge from the 10-day injured list.',
  },
  {
    id: 715301, typeCode: 'SC', date: '2023-07-28', effectiveDate: '2023-07-28',
    person: { id: 592450, fullName: 'Aaron Judge' }, toTeam: YANKEES,
    description: 'New York Yankees activated RF Aaron Judge from the 10-day injured list.',
  },
]

// Cole 2025 — modern wording throughout, the control that already passed.
const COLE_2025_CONTROL = [
  {
    id: 821509, typeCode: 'SC', date: '2025-03-22', effectiveDate: '2025-03-22',
    person: { id: 543037, fullName: 'Gerrit Cole' }, toTeam: YANKEES,
    description: 'New York Yankees placed RHP Gerrit Cole on the 60-day injured list. Tommy John surgery recovery.',
  },
  {
    id: 875260, typeCode: 'SC', date: '2025-11-06', effectiveDate: '2025-11-06',
    person: { id: 543037, fullName: 'Gerrit Cole' }, toTeam: YANKEES,
    description: 'New York Yankees activated RHP Gerrit Cole from the 60-day injured list.',
  },
]

// A feed is always capped at the page's spoiler cutoff by the caller, so a
// game-scoped view sees only rows dated on or before `asOf` — mirror that here
// rather than handing the detector the future.
const asOf = (rows, date) => rows.filter((r) => (r.effectiveDate || r.date) <= date)

// --- Defect 1: pre-2019 "disabled list" wording ----------------------------

test('detectInjuredList sees a pre-2019 "disabled list" placement', () => {
  assert.deepEqual(
    detectInjuredList(asOf(BETTS_2015_DL, '2015-08-05'), '2015-08-05'),
    { days: '7', label: '7-Day', team: RED_SOX },
  )
})

test('a pre-2019 "disabled list" activation closes the stint', () => {
  assert.equal(detectInjuredList(asOf(BETTS_2015_DL, '2015-08-20'), '2015-08-20'), null)
})

test('a stint placed on a "disabled list" and activated off an "injured list" opens and closes', () => {
  assert.deepEqual(
    detectInjuredList(asOf(BETTS_2018_MIXED, '2018-06-05'), '2018-06-05'),
    { days: '10', label: '10-Day', team: RED_SOX },
  )
  assert.equal(detectInjuredList(asOf(BETTS_2018_MIXED, '2018-06-20'), '2018-06-20'), null)
})

test('the day count parses from the unhyphenated "10 day disabled list" form', () => {
  assert.deepEqual(
    detectInjuredList(asOf(VALDEZ_2021_UNHYPHENATED, '2021-04-15'), '2021-04-15'),
    { days: '10', label: '10-Day', team: ASTROS },
  )
})

// --- Defect 2: the All-Star reserve-list closer -----------------------------

test('an activation from the All-Star reserve list closes an open IL stint', () => {
  // Still hurt before the All-Star break.
  assert.deepEqual(
    detectInjuredList(asOf(BETTS_2024_RESERVE_LIST, '2024-07-01'), '2024-07-01'),
    { days: '10', label: '10-Day', team: DODGERS },
  )
  // Being parked on the All-Star club's reserve list is not a return.
  assert.deepEqual(
    detectInjuredList(asOf(BETTS_2024_RESERVE_LIST, '2024-07-20'), '2024-07-20'),
    { days: '10', label: '10-Day', team: DODGERS },
  )
  // His own club activating him from that list IS the return.
  assert.equal(detectInjuredList(asOf(BETTS_2024_RESERVE_LIST, '2024-08-20'), '2024-08-20'), null)
  assert.equal(detectInjuredList(asOf(BETTS_2024_RESERVE_LIST, '2024-09-25'), '2024-09-25'), null)
})

test('an All-Star club "activating" a still-injured player is still a phantom', () => {
  // The guard this file must not regress: only the Yankees' own 7-28 row ends it.
  assert.deepEqual(
    detectInjuredList(asOf(JUDGE_2023_PHANTOM, '2023-07-15'), '2023-07-15'),
    { days: '10', label: '10-Day', team: YANKEES },
  )
  assert.equal(detectInjuredList(asOf(JUDGE_2023_PHANTOM, '2023-08-01'), '2023-08-01'), null)
})

test('modern injured-list wording is unaffected', () => {
  assert.deepEqual(
    detectInjuredList(asOf(COLE_2025_CONTROL, '2025-06-01'), '2025-06-01'),
    { days: '60', label: '60-Day', team: YANKEES },
  )
  assert.equal(detectInjuredList(asOf(COLE_2025_CONTROL, '2025-11-20'), '2025-11-20'), null)
})

// --- Defect 1, second symptom: the career register's gap note ---------------

const season = (yr) => ({
  season: String(yr),
  sport: { id: 1 },
  team: { id: 111, name: 'Boston Red Sox' },
  stat: { gamesPlayed: 150, atBats: 600, hits: 170, homeRuns: 25, rbi: 80, avg: '.283' },
})

test('a season lost to a pre-2019 disabled-list stint reads as injured, not as a plain gap', () => {
  const view = careerRegisterView({
    mlbSplits: [season(2014), season(2016)],
    milbSplits: [],
    group: 'hitting',
    role: null,
    debutYear: 2014,
    currentSeason: 2016,
    currentSportId: 1,
    transactions: [
      {
        id: 1, typeCode: 'SC', date: '2015-04-10', effectiveDate: '2015-04-10',
        person: { id: 605141, fullName: 'Mookie Betts' }, toTeam: RED_SOX,
        description: 'Boston Red Sox placed CF Mookie Betts on the 60-day disabled list. Left knee surgery.',
      },
    ],
  })
  const gap = view.rows.find((r) => r.gap)
  assert.equal(gap.year, '2015')
  assert.equal(gap.note, 'Injured — missed season')
})
