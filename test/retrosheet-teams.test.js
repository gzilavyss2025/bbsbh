// Unit coverage for scripts/lib/retrosheet-teams.mjs — the flat club-code ->
// teamId crosswalk the contract-identity pipeline resolves every row's team
// through. Every code here was enumerated from the real CSVs
// (scripts/data/contracts/*.csv), not guessed from a Retrosheet reference, so
// these tests pin that every code actually seen resolves, franchises that
// changed codes over time (Expos/Marlins/Angels) collapse to one stable
// teamId, and the non-MLB sentinels never get treated as a team.
import assert from 'node:assert/strict'
import test from 'node:test'
import { CLUB_CODE_TO_TEAM_ID, resolveClubCode } from '../scripts/lib/retrosheet-teams.mjs'

// Every code observed across arbitration.csv/extensions.csv/free_agency.csv's
// club, old_club, and new_club columns (enumerated directly, not assumed).
const OBSERVED_CODES = [
  'ANA', 'ARI', 'ATH', 'ATL', 'BAL', 'BOS', 'CAL', 'CHA', 'CHN', 'CIN', 'CLE',
  'COL', 'DET', 'FLA', 'HOU', 'KC', 'KCA', 'LAA', 'LAN', 'MIA', 'MIL', 'MIN',
  'MON', 'NYA', 'NYM', 'NYN', 'OAK', 'PHI', 'PIT', 'SD', 'SDN', 'SEA', 'SF',
  'SFN', 'SLN', 'STL', 'TB', 'TBA', 'TEX', 'TOR', 'WAS',
]

test('every code observed in the real CSVs resolves to a teamId', () => {
  for (const code of OBSERVED_CODES) {
    const resolved = resolveClubCode(code)
    assert.ok(resolved, `${code} should resolve`)
    assert.equal(typeof resolved.teamId, 'number', `${code} should have a numeric teamId`)
    assert.equal(resolved.leftMlb, false)
  }
})

test('a franchise that changed codes over its history collapses to one teamId', () => {
  assert.equal(resolveClubCode('MON').teamId, resolveClubCode('WAS').teamId, 'Expos/Nationals')
  assert.equal(resolveClubCode('FLA').teamId, resolveClubCode('MIA').teamId, 'Marlins')
  assert.equal(resolveClubCode('CAL').teamId, resolveClubCode('ANA').teamId, 'Angels: CAL/ANA')
  assert.equal(resolveClubCode('ANA').teamId, resolveClubCode('LAA').teamId, 'Angels: ANA/LAA')
  assert.equal(resolveClubCode('OAK').teamId, resolveClubCode('ATH').teamId, "Athletics")
})

test('a short code and its Retrosheet-style twin agree', () => {
  assert.equal(resolveClubCode('KC').teamId, resolveClubCode('KCA').teamId)
  assert.equal(resolveClubCode('SD').teamId, resolveClubCode('SDN').teamId)
  assert.equal(resolveClubCode('SF').teamId, resolveClubCode('SFN').teamId)
  assert.equal(resolveClubCode('STL').teamId, resolveClubCode('SLN').teamId)
  assert.equal(resolveClubCode('TB').teamId, resolveClubCode('TBA').teamId)
  assert.equal(resolveClubCode('NYM').teamId, resolveClubCode('NYN').teamId)
})

test('non-MLB sentinels resolve as "left MLB," never as an unknown code and never as a team', () => {
  for (const code of ['dnp', 'retired', 'KBO', 'NPB', 'NBP', 'mex']) {
    const resolved = resolveClubCode(code)
    assert.ok(resolved, `${code} should resolve`)
    assert.equal(resolved.teamId, null)
    assert.equal(resolved.leftMlb, true)
  }
})

test('an empty or unknown cell resolves to null, not a guess', () => {
  assert.equal(resolveClubCode(''), null)
  assert.equal(resolveClubCode(null), null)
  assert.equal(resolveClubCode(undefined), null)
  assert.equal(resolveClubCode('ZZZ'), null)
})

test('every mapped teamId is one of the 30 real MLB team ids', () => {
  const KNOWN_TEAM_IDS = new Set([
    108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 133,
    134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 158,
  ])
  for (const [code, teamId] of Object.entries(CLUB_CODE_TO_TEAM_ID)) {
    assert.ok(KNOWN_TEAM_IDS.has(teamId), `${code} -> ${teamId} is a real teamId`)
  }
})
