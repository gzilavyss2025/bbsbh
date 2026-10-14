import assert from 'node:assert/strict'
import test from 'node:test'
import { transactionTimelineView } from '../src/api/person.js'
import { SPORT_IDS } from '../src/lib/teams.js'

// ---------------------------------------------------------------------------
// The player rail's three "event" families: All-Star selections, spring-training
// invites / the earliest club assignment on file, and national-team or winter-league
// assignments. All three arrive with NO fromTeam, which is why the old ASG rule
// (both clubs required) and the SC gate dropped them.
//
// Fixture rows are copied from live https://statsapi.mlb.com/api/v1/transactions
// ?playerId=605141 (Mookie Betts) and 660271 (Shohei Ohtani), pulled 2026-10-14.
// ---------------------------------------------------------------------------

const NL_ASG = { id: 160, name: 'National League All-Stars' }
const SOX = { id: 111, name: 'Boston Red Sox' }
const USA = { id: 940, name: 'United States' }
const JAPAN = { id: 843, name: 'Japan' }
const AZL = { id: 404, name: 'ACL Angels' }
const ANGELS = { id: 108, name: 'Los Angeles Angels' }
const LEVELS = new Map([[USA.id, 51], [JAPAN.id, 51], [AZL.id, SPORT_IDS.ROK], [SOX.id, 1], [ANGELS.id, 1]])

const row = (typeCode, date, toTeam, description) => ({ typeCode, date, effectiveDate: date, toTeam, description })
const view = (txns) => transactionTimelineView(txns, { selfId: 1, levelByTeamId: LEVELS })?.rows ?? []

test('an All-Star assignment and its same-day activation are one All-Star row', () => {
  const rows = view([
    row('SC', '2022-07-18', NL_ASG, 'National League All-Stars activated RF Mookie Betts.'),
    row('ASG', '2022-07-18', NL_ASG, 'RF Mookie Betts assigned to National League All-Stars.'),
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, 'All-Star')
  assert.equal(rows[0].date, '2022-07-18')
})

test('an All-Star activation with no assignment row still shows (Betts, 2023)', () => {
  const rows = view([row('SC', '2023-07-10', NL_ASG, 'National League All-Stars activated RF Mookie Betts.')])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, 'All-Star')
})

test('an All-Star row dated after the cutoff is dropped', () => {
  const rows = transactionTimelineView(
    [row('ASG', '2024-07-15', NL_ASG, 'RF Mookie Betts assigned to National League All-Stars.')],
    { selfId: 1, endDate: '2024-07-14' },
  )
  assert.equal(rows, null)
})

test('a spring-training invite shows', () => {
  const rows = view([row('ASG', '2018-02-06', ANGELS, 'Los Angeles Angels invited non-roster RHP Shohei Ohtani to spring training.')])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, 'Spring Invite')
})

test('only the earliest club assignment on file shows', () => {
  const rows = view([
    row('ASG', '2014-02-27', SOX, '2B Mookie Betts assigned to Boston Red Sox.'),
    row('ASG', '2013-03-30', SOX, 'IF Mookie Betts assigned to Boston Red Sox.'),
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].date, '2013-03-30')
  assert.equal(rows[0].label, 'Assigned')
})

test('a national team is not the first club assignment (Ohtani)', () => {
  const rows = view([
    row('ASG', '2017-12-09', AZL, 'RHP Shohei Ohtani assigned to AZL Angels.'),
    row('ASG', '2023-02-09', JAPAN, 'RHP Shohei Ohtani assigned to Japan.'),
  ])
  const first = rows.find((r) => r.label === 'Assigned')
  assert.equal(first.date, '2017-12-09')
})

test('national-team assignment and activation are one National Team row', () => {
  const rows = view([
    row('ASG', '2023-02-09', JAPAN, 'RHP Shohei Ohtani assigned to Japan.'),
    row('SC', '2023-02-09', JAPAN, 'Japan activated RHP Shohei Ohtani.'),
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].label, 'National Team')
})

test('a bare club activation is still an echo and stays dropped', () => {
  const rows = view([row('SC', '2019-10-02', ANGELS, 'Los Angeles Angels activated LF Christian Yelich.')])
  assert.equal(rows.length, 0)
})
