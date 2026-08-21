// Coverage for src/screens/team/data/shared.js's Preferred Lineup scoping —
// a team-hub roster page must not credit a player with a position he's never
// played FOR THIS CLUB. Pure logic, no fetch/mock needed. Fixture values below
// are real, captured 2026-08-21 (statsapi.mlb.com), not invented:
//
// - Jihwan Bae was added to the Nashville Sounds (team 556) but had not yet
//   played for them ("Not Yet Reported"); his only fielding splits on file
//   were tagged to Syracuse (team 552), including 4 games started at CF.
//   Before this fix, the roster page's Preferred Lineup showed him as the
//   Sounds' preferred center fielder off that Syracuse line.
// - Jett Williams was the Sounds' own actual leader at CF among players still
//   on the club's roster (15 games started there for team 556), tagged SS as
//   his roster position.
// - Luis Lara led the Sounds at CF this season (69 games started for team
//   556) before being promoted to the Brewers mid-season (status "Assigned to
//   New Team/Level") — still the same organization, so he should still count.
// - Starling Marte started 19 games in RF for the Royals (team 118) this
//   season before they released him on 2026-08-19 ("Released") — a real
//   departure, so his games should NOT still win him a spot two days later.
import assert from 'node:assert/strict'
import test from 'node:test'
import { preferTeamSplits, preferredLineupFrom } from '../src/screens/team/data/shared.js'

function fieldingSplit(teamId, pos, gamesStarted) {
  return { team: { id: teamId }, position: { abbreviation: pos }, stat: { gamesStarted } }
}

function rosterRow(id, fullName, rosterPos, statusCode, fieldingSplits) {
  return {
    person: {
      id,
      fullName,
      stats: [{ group: { displayName: 'fielding' }, splits: fieldingSplits }],
    },
    position: { abbreviation: rosterPos },
    status: { code: statusCode },
  }
}

test('preferTeamSplits returns only the requested team\'s rows when present', () => {
  const splits = [fieldingSplit(552, 'CF', 4), fieldingSplit(556, 'CF', 2)]
  assert.deepStrictEqual(preferTeamSplits(splits, 556), [fieldingSplit(556, 'CF', 2)])
})

test('preferTeamSplits does not leak another team\'s rows when none match', () => {
  // Bae's real shape: every split tagged to Syracuse, none to the Sounds.
  const splits = [fieldingSplit(552, '2B', 33), fieldingSplit(552, 'CF', 4)]
  assert.deepStrictEqual(preferTeamSplits(splits, 556), [])
})

test('preferTeamSplits falls back to the raw list only when nothing is team-tagged', () => {
  const splits = [{ position: { abbreviation: 'CF' }, stat: { gamesStarted: 90 } }]
  assert.deepStrictEqual(preferTeamSplits(splits, 556), splits)
})

test('preferredLineupFrom skips a rostered-but-unplayed pickup and falls through to a teammate\'s real starts', () => {
  const bae = rosterRow(1, 'Jihwan Bae', 'CF', 'NYR', [
    fieldingSplit(552, '2B', 33),
    fieldingSplit(552, 'CF', 4),
  ])
  const williams = rosterRow(2, 'Jett Williams', 'SS', 'D7', [fieldingSplit(556, 'CF', 15)])
  const lineup = preferredLineupFrom([bae, williams], 556)
  const cf = lineup.find((p) => p.position === 'CF')
  assert.equal(cf?.id, 2)
  assert.equal(cf?.gs, 15)
})

test('preferredLineupFrom still credits a player promoted within the same org this season', () => {
  const lara = rosterRow(3, 'Luis Lara', 'CF', 'ASG', [
    fieldingSplit(556, 'CF', 69),
    fieldingSplit(556, 'RF', 7),
  ])
  const williams = rosterRow(2, 'Jett Williams', 'SS', 'D7', [fieldingSplit(556, 'CF', 15)])
  const lineup = preferredLineupFrom([lara, williams], 556)
  const cf = lineup.find((p) => p.position === 'CF')
  assert.equal(cf?.id, 3)
  assert.equal(cf?.gs, 69)
})

test('preferredLineupFrom excludes a player the club has since released, even with the most starts on file', () => {
  const marte = rosterRow(4, 'Starling Marte', 'RF', 'RL', [
    fieldingSplit(118, 'RF', 19),
    fieldingSplit(118, 'LF', 5),
  ])
  const backup = rosterRow(5, 'Backup Outfielder', 'CF', 'A', [fieldingSplit(118, 'RF', 6)])
  const lineup = preferredLineupFrom([marte, backup], 118)
  const rf = lineup.find((p) => p.position === 'RF')
  assert.equal(rf?.id, 5)
  assert.equal(rf?.gs, 6)
})

test('preferredLineupFrom leaves a position empty when every candidate on file has left the org', () => {
  const marte = rosterRow(4, 'Starling Marte', 'RF', 'RL', [fieldingSplit(118, 'RF', 19)])
  const lineup = preferredLineupFrom([marte], 118)
  assert.equal(lineup.find((p) => p.position === 'RF'), undefined)
})
