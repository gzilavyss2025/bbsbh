// Coverage for divisionRecordFor / teamRecordFor / standingsRowsFor
// (src/screens/team/data/shared.js) against a division-less league. The
// Northwest League (Hillsboro Hops et al., sportId 13) has no divisions:
// scripts/gen-teams.mjs coalesces the missing division id to `null` in the
// static team file, but statsapi's own standings record just omits the
// `division` field, reading `undefined`. A strict `===` between `null` and
// `undefined` used to silently return no match, leaving these clubs' Numbers
// tab and Overview standings preview empty even though the feed had data.
import assert from 'node:assert/strict'
import test from 'node:test'
import { divisionRecordFor, teamRecordFor, standingsRowsFor } from '../src/screens/team/data/shared.js'

const hillsboroHops = { id: 419, division: { id: null, name: null } }

const northwestLeagueStandings = [
  {
    // No `division` key at all, matching statsapi's real response shape for
    // a division-less league.
    teamRecords: [
      { team: { id: 419, name: 'Hillsboro Hops' }, wins: 52, losses: 58, divisionRank: '3' },
      { team: { id: 403, name: 'Everett AquaSox' }, wins: 60, losses: 50, divisionRank: '1' },
    ],
  },
]

test('divisionRecordFor matches a division-less league (null team id vs. undefined feed field)', () => {
  const record = divisionRecordFor(northwestLeagueStandings, hillsboroHops)
  assert.equal(record, northwestLeagueStandings[0])
})

test('teamRecordFor still returns a record line for a division-less club', () => {
  const record = teamRecordFor(northwestLeagueStandings, hillsboroHops, 419)
  assert.deepEqual(record, { wins: 52, losses: 58, rank: '3', div: null })
})

test('standingsRowsFor still returns rows for a division-less club', () => {
  const rows = standingsRowsFor(northwestLeagueStandings, hillsboroHops, 419)
  assert.equal(rows.length, 2)
  assert.equal(rows.find((r) => r.id === 419).isMe, true)
})

test('divisionRecordFor still matches normally when both sides carry a real division id', () => {
  const team = { id: 158, division: { id: 205, name: 'NL Central' } }
  const standings = [
    { division: { id: 205 }, teamRecords: [{ team: { id: 158, name: 'Brewers' }, wins: 90, losses: 72 }] },
    { division: { id: 200 }, teamRecords: [{ team: { id: 143, name: 'Phillies' }, wins: 88, losses: 74 }] },
  ]
  assert.equal(divisionRecordFor(standings, team), standings[0])
})
