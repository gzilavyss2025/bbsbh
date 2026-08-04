import assert from 'node:assert/strict'
import test from 'node:test'
import { injuredListStints, transactionTimelineView } from '../src/api/person.js'

// ---------------------------------------------------------------------------
// Injured-list stints on the career transaction timeline.
//
// The type whitelist used to drop the injured list wholesale, which left the
// defining stretch of a lot of careers off the page entirely — Gerrit Cole's
// ledger was EMPTY from 2023 through 2026, the Tommy John years. It is back,
// but as one row per STINT rather than per raw row: the feed spreads a single
// stay on the list across a placement, sometimes a same-day duplicate at a
// different day count, an optional transfer to the 60-day list, one rehab row
// per affiliate visited, and an activation.
//
// Fixture rows are copied verbatim from live
// https://statsapi.mlb.com/api/v1/transactions responses, pulled 2026-08-04.
// ---------------------------------------------------------------------------

const YANKEES = { id: 147, name: 'New York Yankees' }
const DODGERS = { id: 119, name: 'Los Angeles Dodgers' }
const RED_SOX = { id: 111, name: 'Boston Red Sox' }
const SOMERSET = { id: 1958, name: 'Somerset Patriots' }
const SCRANTON = { id: 531, name: 'Scranton/Wilkes-Barre RailRiders' }

const sc = (date, description, toTeam = YANKEES) => ({
  typeCode: 'SC', date, effectiveDate: date, toTeam, description,
})
const rehab = (date, toTeam, description) => ({
  typeCode: 'ASG', date, effectiveDate: date, fromTeam: YANKEES, toTeam, description,
})

// --- stint folding ----------------------------------------------------------

test('a placement, its rehab stops and its activation fold into one stint', () => {
  const stints = injuredListStints([
    sc('2024-03-28', 'New York Yankees placed RHP Gerrit Cole on the 60-day injured list. Right elbow inflammation.'),
    rehab('2024-06-04', SOMERSET, 'New York Yankees sent RHP Gerrit Cole on a rehab assignment to Somerset Patriots.'),
    rehab('2024-06-14', SCRANTON, 'New York Yankees sent RHP Gerrit Cole on a rehab assignment to Scranton/Wilkes-Barre RailRiders.'),
    rehab('2024-06-14', SCRANTON, 'New York Yankees sent RHP Gerrit Cole on a rehab assignment to Scranton/Wilkes-Barre RailRiders.'),
    sc('2024-06-19', 'New York Yankees activated RHP Gerrit Cole from the 60-day injured list.'),
  ])
  assert.equal(stints.length, 1)
  assert.equal(stints[0].start, '2024-03-28')
  assert.equal(stints[0].end, '2024-06-19')
  assert.equal(stints[0].days, 83)
  // Repeated rehab rows for the same club collapse to one visit.
  assert.deepEqual(stints[0].rehabClubs, ['Somerset Patriots', 'Scranton/Wilkes-Barre RailRiders'])
})

test('a same-day duplicate placement at a second day count is one stint, not two', () => {
  // Ohtani, 2023-09-16 — placed on BOTH a 10-day and a 15-day list that day.
  const stints = injuredListStints([
    sc('2023-09-16', 'Los Angeles Angels placed RHP Shohei Ohtani on the 10-day injured list. Oblique.'),
    sc('2023-09-16', 'Los Angeles Angels placed RHP Shohei Ohtani on the 15-day injured list. Oblique.'),
    sc('2023-10-02', 'Los Angeles Angels activated RHP Shohei Ohtani from the 15-day injured list.'),
  ])
  assert.equal(stints.length, 1)
  assert.equal(stints[0].start, '2023-09-16')
  assert.equal(stints[0].days, 16)
})

test('an escalation to the 60-day list extends the stint instead of starting a new one', () => {
  // Judge's 2026 rib fracture: MLB writes the 10-day -> 60-day move as a fresh
  // "placed", not a "transferred". Splitting on it produced two rows for one
  // absence, the first showing no return at all.
  const stints = injuredListStints([
    sc('2026-06-02', 'New York Yankees placed RF Aaron Judge on the 10-day injured list. Right rib stress fracture.'),
    sc('2026-07-18', 'New York Yankees placed RF Aaron Judge on the 60-day injured list. Right rib stress fracture.'),
  ])
  assert.equal(stints.length, 1)
  assert.equal(stints[0].start, '2026-06-02')
  assert.equal(stints[0].days60, '60')
  assert.equal(stints[0].end, null)
})

test('a "transferred" escalation also extends the stint', () => {
  const stints = injuredListStints([
    sc('2026-04-01', 'New York Yankees placed RHP Gerrit Cole on the 15-day injured list. Elbow.'),
    sc('2026-05-01', 'New York Yankees transferred RHP Gerrit Cole from the 15-day injured list to the 60-day injured list.'),
    sc('2026-06-30', 'New York Yankees activated RHP Gerrit Cole from the 60-day injured list.'),
  ])
  assert.equal(stints.length, 1)
  assert.equal(stints[0].days60, '60')
  assert.equal(stints[0].days, 90)
})

test('a stint left open by a missed closer never spans into the next season', () => {
  const stints = injuredListStints([
    sc('2024-08-01', 'New York Yankees placed RF Aaron Judge on the 10-day injured list. Wrist.'),
    sc('2025-05-01', 'New York Yankees placed RF Aaron Judge on the 10-day injured list. Hamstring.'),
  ])
  assert.equal(stints.length, 2)
  // No end and no invented span — an unclosed stint is a data hole, and a
  // fabricated day count is worse than none.
  assert.equal(stints[0].end, null)
  assert.equal(stints[0].days, null)
  assert.equal(stints[1].start, '2025-05-01')
})

test('a recall closes a stint that never got an activation row', () => {
  const stints = injuredListStints([
    sc('2026-04-01', 'New York Yankees placed RHP Gerrit Cole on the 15-day injured list. Elbow.'),
    { typeCode: 'CU', date: '2026-05-01', effectiveDate: '2026-05-01', fromTeam: SCRANTON, toTeam: YANKEES, description: 'New York Yankees recalled RHP Gerrit Cole from Scranton/Wilkes-Barre RailRiders.' },
  ])
  assert.equal(stints.length, 1)
  assert.equal(stints[0].end, '2026-05-01')
  assert.equal(stints[0].days, 30)
})

test('a feed with no injured-list rows yields no stints', () => {
  assert.deepEqual(injuredListStints([
    { typeCode: 'TR', date: '2018-01-13', effectiveDate: '2018-01-13', fromTeam: RED_SOX, toTeam: YANKEES, description: 'Pittsburgh Pirates traded RHP Gerrit Cole to Houston Astros.' },
  ]), [])
  assert.deepEqual(injuredListStints([]), [])
  assert.deepEqual(injuredListStints(null), [])
})

// --- the rendered timeline row ---------------------------------------------

const ilRows = (txns, opts = {}) =>
  (transactionTimelineView(txns, opts)?.rows ?? []).filter((r) => r.code === 'IL')

test('the stint row keeps the feed\'s wording, minus the redundant subject, plus the arc', () => {
  const [row] = ilRows([
    sc('2024-03-28', 'New York Yankees placed RHP Gerrit Cole on the 60-day injured list. Right elbow inflammation.'),
    rehab('2024-06-04', SOMERSET, 'New York Yankees sent RHP Gerrit Cole on a rehab assignment to Somerset Patriots.'),
    sc('2024-06-19', 'New York Yankees activated RHP Gerrit Cole from the 60-day injured list.'),
  ])
  assert.equal(row.date, '2024-03-28')
  assert.equal(row.label, 'Injured List')
  assert.equal(row.tone, 'out')
  assert.deepEqual(row.club, { id: 147, name: 'New York Yankees' })
  // The club/player prefix is dropped — the club is the mark beside the chip
  // and the player is whose page this is.
  assert.equal(
    row.description,
    '60-day injured list. Right elbow inflammation. Rehab: Somerset Patriots. Activated Jun 19 — 83 days.',
  )
})

test('an open stint carries no activation clause and no invented span', () => {
  const [row] = ilRows([
    sc('2026-06-02', 'New York Yankees placed RF Aaron Judge on the 10-day injured list. Right rib stress fracture.'),
  ])
  assert.equal(row.description, '10-day injured list. Right rib stress fracture.')
})

test('a one-day stint says "1 day", not "1 days"', () => {
  const [row] = ilRows([
    sc('2026-06-02', 'New York Yankees placed RF Aaron Judge on the 10-day injured list. Wrist.'),
    sc('2026-06-03', 'New York Yankees activated RF Aaron Judge from the 10-day injured list.'),
  ])
  assert.match(row.description, /Activated Jun 3 — 1 day\.$/)
})

test('the feed\'s own repeated sentence and missing period are tidied', () => {
  // Betts 2021-08-11 repeats the injury verbatim; Betts 2015 ends without a
  // period, which used to run straight into the appended clause.
  const [repeated] = ilRows([
    sc('2021-08-11', 'Los Angeles Dodgers placed RF Mookie Betts on the 10-day injured list. Right hip inflammation. Right hip inflammation.', DODGERS),
    sc('2021-08-26', 'Los Angeles Dodgers activated RF Mookie Betts from the 10-day injured list.', DODGERS),
  ])
  assert.equal(
    repeated.description,
    '10-day injured list. Right hip inflammation. Activated Aug 26 — 15 days.',
  )

  const [unpunctuated] = ilRows([
    sc('2015-07-29', 'Boston Red Sox placed CF Mookie Betts on the 7-day disabled list. Concussion symptoms', RED_SOX),
    sc('2015-08-11', 'Boston Red Sox activated RF Mookie Betts from the 7-day disabled list.', RED_SOX),
  ])
  assert.equal(
    unpunctuated.description,
    '7-day disabled list. Concussion symptoms. Activated Aug 11 — 13 days.',
  )
})

test('a long rehab tour lists three clubs and counts the rest', () => {
  const stops = ['Somerset Patriots', 'Hudson Valley Renegades', 'Scranton/Wilkes-Barre RailRiders', 'Tampa Tarpons']
  const [row] = ilRows([
    sc('2026-03-25', 'New York Yankees placed RHP Gerrit Cole on the 15-day injured list. Tommy John surgery recovery.'),
    ...stops.map((name, i) =>
      rehab(`2026-04-0${i + 1}`, { id: 900 + i, name }, `New York Yankees sent RHP Gerrit Cole on a rehab assignment to ${name}.`)),
    sc('2026-05-22', 'New York Yankees activated RHP Gerrit Cole from the 15-day injured list.'),
  ])
  assert.match(
    row.description,
    /Rehab: Somerset Patriots, Hudson Valley Renegades, Scranton\/Wilkes-Barre RailRiders \+1 more\./,
  )
})

// --- what stays out ---------------------------------------------------------

test('the private-life lists stay off the timeline', () => {
  // Deliberate, not an oversight — see transactionTimelineView's header.
  const rows = transactionTimelineView([
    sc('2025-04-18', 'Los Angeles Dodgers placed TWP Shohei Ohtani on the paternity list.', DODGERS),
    sc('2025-04-20', 'Los Angeles Dodgers activated TWP Shohei Ohtani from the paternity list.', DODGERS),
    sc('2018-07-10', 'Houston Astros placed RHP Gerrit Cole on the bereavement list.', DODGERS),
    sc('2024-08-03', 'Los Angeles Dodgers placed 1B Freddie Freeman on the restricted list.', DODGERS),
  ])
  assert.equal(rows, null)
})

test('roster-status noise and number changes still drop', () => {
  const rows = transactionTimelineView([
    sc('2025-04-15', 'TWP Shohei Ohtani changed number to 42.', DODGERS),
    { typeCode: 'NUM', date: '2025-04-16', effectiveDate: '2025-04-16', toTeam: DODGERS, description: 'TWP Shohei Ohtani changed number to 17.' },
    sc('2026-02-05', 'Japan activated TWP Shohei Ohtani.', DODGERS),
    sc('2025-07-14', 'National League All-Stars activated TWP Shohei Ohtani.', DODGERS),
    sc('2024-03-01', 'Los Angeles Dodgers reassigned RHP Walker Buehler to the minor leagues.', DODGERS),
  ])
  assert.equal(rows, null)
})

test('an IL stint after the spoiler cutoff is not shown', () => {
  // The caller caps the feed, but the row date is checked again on the way in.
  const rows = ilRows(
    [sc('2026-06-02', 'New York Yankees placed RF Aaron Judge on the 10-day injured list. Right rib stress fracture.')],
    { endDate: '2026-05-01' },
  )
  assert.deepEqual(rows, [])
})
