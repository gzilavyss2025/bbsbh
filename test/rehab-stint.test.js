// ONE REHAB STINT RULE FOR THE BANNER AND THE LIST (#1361, #1362).
//
// The player page's rehab banner (detectRehabAssignment) and the league-wide
// Rehab Assignments list (gen-rehab.mjs, through rehabListRow) must agree on
// every day. Before this, they found the stint in two ways:
//
//   #1361  DES, OUT, CLW, DFA and SFA did not end a stint, so a player who was
//          designated for assignment and sent outright stayed on the list
//          until the 30-day cap (Rob Zastryzny, 2026).
//   #1362  The banner counted from the LATEST rehab leg and the list from the
//          EARLIEST; the list read only a 40-day window; and a plain "assigned
//          to X" row filed on the same day as a rehab move ended the stint for
//          the list but not for the banner (Beck Way, Gavin Stone, Blake
//          Treinen, 2026).
//
// Every row below is copied from the live response of
// https://statsapi.mlb.com/api/v1/transactions?playerId={id}&startDate=2026-06-01&endDate=2026-10-01
// on 2026-10-01 (fields cut to the ones the rule reads).
import assert from 'node:assert/strict'
import test from 'node:test'
import { detectRehabAssignment } from '../src/api/person.js'
import { isRehabEndingTxn, openRehabStint, rehabListRow } from '../src/api/rehab-policy.js'

const rows = (person, list) => list.map((t) => ({ ...t, person }))
const MLB_IDS = new Set([118, 119, 158])

const TREINEN = rows({ id: 595014, fullName: 'Blake Treinen' }, [
  {typeCode: 'SC', date: '2026-06-20', effectiveDate: '2026-06-20', toTeam: {id: 119, name: 'Los Angeles Dodgers'}, description: 'Los Angeles Dodgers placed RHP Blake Treinen on the 15-day injured list. Right elbow inflammation.'},
  {typeCode: 'SC', date: '2026-08-11', effectiveDate: '2026-08-11', toTeam: {id: 119, name: 'Los Angeles Dodgers'}, description: 'Los Angeles Dodgers transferred RHP Blake Treinen from the 15-day injured list to the 60-day injured list. Right elbow inflammation.'},
  {typeCode: 'ASG', date: '2026-08-15', effectiveDate: '2026-08-15', fromTeam: {id: 119, name: 'Los Angeles Dodgers'}, toTeam: {id: 6482, name: 'Ontario Tower Buzzers'}, description: 'Los Angeles Dodgers sent RHP Blake Treinen on a rehab assignment to Ontario Tower Buzzers.'},
  {typeCode: 'ASG', date: '2026-08-18', effectiveDate: '2026-08-18', fromTeam: {id: 119, name: 'Los Angeles Dodgers'}, toTeam: {id: 238, name: 'Oklahoma City Comets'}, description: 'Los Angeles Dodgers sent RHP Blake Treinen on a rehab assignment to Oklahoma City Comets.'},
  {typeCode: 'ASG', date: '2026-08-18', effectiveDate: '2026-08-18', toTeam: {id: 238, name: 'Oklahoma City Comets'}, description: 'RHP Blake Treinen assigned to Oklahoma City Comets.'},
  {typeCode: 'ASG', date: '2026-08-18', effectiveDate: '2026-08-18', fromTeam: {id: 119, name: 'Los Angeles Dodgers'}, toTeam: {id: 238, name: 'Oklahoma City Comets'}, description: 'Los Angeles Dodgers sent RHP Blake Treinen on a rehab assignment to Oklahoma City Comets.'},
  {typeCode: 'SC', date: '2026-09-02', effectiveDate: '2026-09-02', toTeam: {id: 119, name: 'Los Angeles Dodgers'}, description: 'Los Angeles Dodgers activated RHP Blake Treinen from the 60-day injured list.'},
  {typeCode: 'SC', date: '2026-09-27', effectiveDate: '2026-09-27', toTeam: {id: 119, name: 'Los Angeles Dodgers'}, description: 'Los Angeles Dodgers placed RHP Blake Treinen on the 15-day injured list. Right shoulder inflammation.'},
])

const ZASTRYZNY = rows({ id: 642239, fullName: 'Rob Zastryzny' }, [
  {typeCode: 'SC', date: '2026-06-03', effectiveDate: '2026-05-31', toTeam: {id: 158, name: 'Milwaukee Brewers'}, description: 'Milwaukee Brewers placed LHP Rob Zastryzny on the 15-day injured list retroactive to May 31, 2026. Left trapezius strain.'},
  {typeCode: 'ASG', date: '2026-07-03', effectiveDate: '2026-07-03', fromTeam: {id: 158, name: 'Milwaukee Brewers'}, toTeam: {id: 406, name: 'ACL Brewers'}, description: 'Milwaukee Brewers sent LHP Rob Zastryzny on a rehab assignment to ACL Brewers.'},
  {typeCode: 'ASG', date: '2026-07-10', effectiveDate: '2026-07-10', fromTeam: {id: 158, name: 'Milwaukee Brewers'}, toTeam: {id: 556, name: 'Nashville Sounds'}, description: 'Milwaukee Brewers sent LHP Rob Zastryzny on a rehab assignment to Nashville Sounds.'},
  {typeCode: 'ASG', date: '2026-07-10', effectiveDate: '2026-07-10', fromTeam: {id: 158, name: 'Milwaukee Brewers'}, toTeam: {id: 556, name: 'Nashville Sounds'}, description: 'Milwaukee Brewers sent LHP Rob Zastryzny on a rehab assignment to Nashville Sounds.'},
  {typeCode: 'SC', date: '2026-07-15', effectiveDate: '2026-07-15', toTeam: {id: 158, name: 'Milwaukee Brewers'}, description: 'Milwaukee Brewers placed LHP Rob Zastryzny on the 60-day injured list. Left trapezius strain.'},
  {typeCode: 'ASG', date: '2026-09-09', effectiveDate: '2026-09-09', fromTeam: {id: 158, name: 'Milwaukee Brewers'}, toTeam: {id: 556, name: 'Nashville Sounds'}, description: 'Milwaukee Brewers sent LHP Rob Zastryzny on a rehab assignment to Nashville Sounds.'},
  {typeCode: 'ASG', date: '2026-09-09', effectiveDate: '2026-09-09', fromTeam: {id: 158, name: 'Milwaukee Brewers'}, toTeam: {id: 556, name: 'Nashville Sounds'}, description: 'Milwaukee Brewers sent LHP Rob Zastryzny on a rehab assignment to Nashville Sounds.'},
  {typeCode: 'DES', date: '2026-09-17', effectiveDate: '2026-09-17', toTeam: {id: 158, name: 'Milwaukee Brewers'}, description: 'Milwaukee Brewers designated LHP Rob Zastryzny for assignment.'},
  {typeCode: 'SC', date: '2026-09-19', effectiveDate: '2026-09-19', toTeam: {id: 556, name: 'Nashville Sounds'}, description: 'Nashville Sounds activated LHP Rob Zastryzny.'},
  {typeCode: 'OUT', date: '2026-09-19', effectiveDate: '2026-09-19', fromTeam: {id: 158, name: 'Milwaukee Brewers'}, toTeam: {id: 556, name: 'Nashville Sounds'}, description: 'Milwaukee Brewers sent LHP Rob Zastryzny outright to Nashville Sounds.'},
])

const BECK_WAY = rows({ id: 694360, fullName: 'Beck Way' }, [
  {typeCode: 'SE', date: '2026-06-02', effectiveDate: '2026-06-02', fromTeam: {id: 541, name: 'Omaha Storm Chasers'}, toTeam: {id: 118, name: 'Kansas City Royals'}, description: 'Kansas City Royals selected the contract of RHP Beck Way from Omaha Storm Chasers.'},
  {typeCode: 'SC', date: '2026-07-28', effectiveDate: '2026-07-28', toTeam: {id: 118, name: 'Kansas City Royals'}, description: 'Kansas City Royals placed RHP Beck Way on the 15-day injured list. Low back spasms/tightness.'},
  {typeCode: 'ASG', date: '2026-08-18', effectiveDate: '2026-08-18', fromTeam: {id: 118, name: 'Kansas City Royals'}, toTeam: {id: 1350, name: 'Northwest Arkansas Naturals'}, description: 'Kansas City Royals sent RHP Beck Way on a rehab assignment to Northwest Arkansas Naturals.'},
  {typeCode: 'ASG', date: '2026-08-21', effectiveDate: '2026-08-21', fromTeam: {id: 118, name: 'Kansas City Royals'}, toTeam: {id: 541, name: 'Omaha Storm Chasers'}, description: 'Kansas City Royals sent RHP Beck Way on a rehab assignment to Omaha Storm Chasers.'},
  {typeCode: 'ASG', date: '2026-08-21', effectiveDate: '2026-08-21', fromTeam: {id: 118, name: 'Kansas City Royals'}, toTeam: {id: 541, name: 'Omaha Storm Chasers'}, description: 'Kansas City Royals sent RHP Beck Way on a rehab assignment to Omaha Storm Chasers.'},
  {typeCode: 'SC', date: '2026-09-28', effectiveDate: '2026-09-28', toTeam: {id: 118, name: 'Kansas City Royals'}, description: 'Kansas City Royals activated RHP Beck Way from the 15-day injured list.'},
])

const GAVIN_STONE = rows({ id: 694813, fullName: 'Gavin Stone' }, [
  {typeCode: 'ASG', date: '2026-08-06', effectiveDate: '2026-08-06', fromTeam: {id: 119, name: 'Los Angeles Dodgers'}, toTeam: {id: 238, name: 'Oklahoma City Comets'}, description: 'Los Angeles Dodgers sent RHP Gavin Stone on a rehab assignment to Oklahoma City Comets.'},
  {typeCode: 'ASG', date: '2026-08-06', effectiveDate: '2026-08-06', fromTeam: {id: 119, name: 'Los Angeles Dodgers'}, toTeam: {id: 238, name: 'Oklahoma City Comets'}, description: 'Los Angeles Dodgers sent RHP Gavin Stone on a rehab assignment to Oklahoma City Comets.'},
  {typeCode: 'ASG', date: '2026-09-09', effectiveDate: '2026-09-09', fromTeam: {id: 119, name: 'Los Angeles Dodgers'}, toTeam: {id: 238, name: 'Oklahoma City Comets'}, description: 'Los Angeles Dodgers sent RHP Gavin Stone on a rehab assignment to Oklahoma City Comets.'},
])

// The feed as of `day`: the banner's caller caps it at the cutoff, and the
// nightly list reads only what has been filed by the day it runs.
const asOfDay = (ts, day) => ts.filter((t) => (t.effectiveDate || t.date) <= day)
const bannerOn = (ts, day) => detectRehabAssignment(asOfDay(ts, day), 2014, day) != null
const listOn = (ts, day) => rehabListRow(asOfDay(ts, day), MLB_IDS, day) != null

function days(from, to) {
  const out = []
  for (let d = Date.parse(`${from}T00:00:00Z`); d <= Date.parse(`${to}T00:00:00Z`); d += 86400000) {
    out.push(new Date(d).toISOString().slice(0, 10))
  }
  return out
}
// The days in [from, to] on which `on` is true, as "first..last" runs.
function onRuns(ts, from, to, on) {
  const runs = []
  let start = null
  let prev = null
  for (const d of days(from, to)) {
    if (on(ts, d)) {
      if (!start) start = d
      prev = d
    } else if (start) {
      runs.push(`${start}..${prev}`)
      start = null
    }
  }
  if (start) runs.push(`${start}..${prev}`)
  return runs
}

// ---------------------------------------------------------------------------
// #1361: a move that takes him off the 40-man roster ends the stint
// ---------------------------------------------------------------------------

test('DES, OUT, CLW, DFA and SFA each end a rehab stint (#1361)', () => {
  for (const typeCode of ['DES', 'OUT', 'CLW', 'DFA', 'SFA']) {
    assert.equal(isRehabEndingTxn({ typeCode, description: '' }), true, typeCode)
  }
})

test('Rob Zastryzny leaves the list the day he is designated for assignment (#1361)', () => {
  // ASG rehab 09-09, DES 09-17, OUT 09-19. rehab.json on 2026-10-01 still listed him.
  assert.ok(listOn(ZASTRYZNY, '2026-09-16'))
  assert.equal(listOn(ZASTRYZNY, '2026-09-17'), false)
  assert.equal(rehabListRow(ZASTRYZNY, MLB_IDS, '2026-10-01'), null)
  assert.equal(detectRehabAssignment(ZASTRYZNY, 2016, '2026-10-01'), null)
  assert.deepEqual(onRuns(ZASTRYZNY, '2026-09-01', '2026-10-01', listOn), ['2026-09-09..2026-09-16'])
})

// ---------------------------------------------------------------------------
// #1362: one start rule, one tie rule, no window cut
// ---------------------------------------------------------------------------

test('Beck Way: the stint starts at the FIRST leg; moving clubs does not restart the 30 days', () => {
  // Rehab 08-18 (NW Arkansas), 08-21 (Omaha). The 30-day cap counts from 08-18.
  const stint = openRehabStint(asOfDay(BECK_WAY, '2026-09-01'), '2026-09-01')
  assert.equal(stint.since, '2026-08-18')
  assert.equal(stint.club.name, 'Omaha Storm Chasers')
  assert.deepEqual(onRuns(BECK_WAY, '2026-08-01', '2026-10-01', bannerOn), ['2026-08-18..2026-09-17'])
  assert.deepEqual(onRuns(BECK_WAY, '2026-08-01', '2026-10-01', listOn), ['2026-08-18..2026-09-17'])
})

test('Gavin Stone: a leg after the 30-day cap has run out starts a NEW stint', () => {
  // Rehab 08-06, then 09-09 with no end row between: 34 days, past the cap.
  assert.equal(openRehabStint(asOfDay(GAVIN_STONE, '2026-09-10'), '2026-09-10').since, '2026-09-09')
  const want = ['2026-08-06..2026-09-05', '2026-09-09..2026-10-01']
  assert.deepEqual(onRuns(GAVIN_STONE, '2026-08-01', '2026-10-01', bannerOn), want)
  assert.deepEqual(onRuns(GAVIN_STONE, '2026-08-01', '2026-10-01', listOn), want)
})

test('Blake Treinen: an "assigned to X" row on the same day as a rehab move does not end the stint', () => {
  // Rehab 08-15, then on 08-18 a rehab move AND "assigned to Oklahoma City
  // Comets"; activated off the 60-day IL 09-02.
  assert.equal(openRehabStint(asOfDay(TREINEN, '2026-08-20'), '2026-08-20').since, '2026-08-15')
  const want = ['2026-08-15..2026-09-01']
  assert.deepEqual(onRuns(TREINEN, '2026-08-01', '2026-10-01', bannerOn), want)
  assert.deepEqual(onRuns(TREINEN, '2026-08-01', '2026-10-01', listOn), want)
})

test('the list row names the org, the club and the stint start', () => {
  const row = rehabListRow(asOfDay(TREINEN, '2026-08-25'), MLB_IDS, '2026-08-25')
  assert.equal(row.playerId, 595014)
  assert.equal(row.playerName, 'Blake Treinen')
  assert.equal(row.orgId, 119)
  assert.equal(row.clubId, 238)
  assert.equal(row.since, '2026-08-15')
})

test('the banner and the list agree on every day for every player here', () => {
  for (const ts of [ZASTRYZNY, BECK_WAY, GAVIN_STONE, TREINEN]) {
    for (const d of days('2026-06-01', '2026-10-01')) {
      assert.equal(bannerOn(ts, d), listOn(ts, d), `${ts[0].person.fullName} ${d}`)
    }
  }
})
