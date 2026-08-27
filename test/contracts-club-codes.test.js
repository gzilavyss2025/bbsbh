// Coverage + behavior for src/lib/contracts/clubCodes.js — the club-code
// resolver for the historical contracts CSVs (scripts/data/contracts/). The
// coverage test reads the CSVs directly (not a hardcoded snapshot of their
// codes) so it fails the moment a future export adds a code this module
// hasn't classified.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { parseCsv } from '../scripts/lib/csv.mjs'
import { CLUB_CODE_TO_TEAM_ID as PIPELINE_CODE_TO_TEAM_ID } from '../scripts/lib/retrosheet-teams.mjs'
import { ALL_MLB_TEAM_IDS, resolveClubCode } from '../src/lib/contracts/clubCodes.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'scripts', 'data', 'contracts')

function loadCsv(name) {
  return parseCsv(readFileSync(join(DATA_DIR, name), 'utf8'))
}

const arbitration = loadCsv('arbitration.csv')
const extensions = loadCsv('extensions.csv')
const freeAgency = loadCsv('free_agency.csv')

// Every non-blank code that actually appears in a club-bearing column, across
// all three CSVs. A blank cell (free_agency.csv legitimately leaves old_club
// blank for an undrafted international signing's first deal, and new_club
// blank while a free agent's move is still pending) is a real CSV state, not
// an unrecognized code — it is excluded here and covered by its own test
// below instead of being required to resolve.
function distinctCodes() {
  const codes = new Set()
  for (const r of arbitration) if (r.club) codes.add(r.club)
  for (const r of extensions) if (r.club) codes.add(r.club)
  for (const r of freeAgency) {
    if (r.old_club) codes.add(r.old_club)
    if (r.new_club) codes.add(r.new_club)
  }
  return [...codes].sort()
}

test('every distinct club code in the contracts CSVs resolves to a teamId or a named destination', () => {
  const unresolved = distinctCodes().filter((code) => resolveClubCode(code) === null)
  assert.deepEqual(unresolved, [], `unrecognized club code(s), classify in src/lib/contracts/clubCodes.js: ${unresolved.join(', ')}`)
})

test('the CSVs actually carry more than one code per franchise (the case this resolver exists for)', () => {
  // A sanity check on the fixture itself, not just the resolver: if a future
  // re-export normalizes every code to one modern abbreviation, this module
  // becomes unnecessary and should be simplified rather than silently kept.
  const codes = distinctCodes()
  assert.ok(codes.includes('ANA') && codes.includes('LAA'), 'expected both ANA and LAA in the CSVs')
  assert.ok(codes.includes('MON') && codes.includes('WAS'), 'expected both MON and WAS in the CSVs')
})

test('a blank club cell resolves to null, distinct from an unrecognized code, and both are distinct from a resolved destination', () => {
  assert.equal(resolveClubCode(''), null)
  assert.equal(resolveClubCode(undefined), null)
  assert.equal(resolveClubCode('ZZZ'), null) // not a real code in any CSV
  assert.notEqual(resolveClubCode('retired'), null)
})

test('MON (2004, Expos) and WAS (2006, Nationals) resolve to the same teamId', () => {
  // .scratch/team-success/roster-age-cache.json — the cache W1.1 joins salary
  // rows against — keys its per-season rows as
  // `hitting-{teamId}-{season}`/`pitching-{teamId}-{season}` and uses teamId
  // 120 for BOTH `-2004` (the Expos' last season) and `-2005`/`-2006` (the
  // Nationals' first seasons): confirmed directly in that file, not assumed.
  // statsapi's teamId is franchise-persistent, so a caller joining by teamId
  // reaches the right cached row regardless of which era's code it started from.
  const mon = resolveClubCode('MON', 2004)
  const was = resolveClubCode('WAS', 2006)
  assert.equal(mon.teamId, 120)
  assert.equal(was.teamId, 120)
  assert.equal(mon.teamId, was.teamId)
  assert.equal(mon.franchiseId, was.franchiseId)
})

test('FLA (2011, Florida Marlins) and MIA (2012, Miami Marlins) resolve to the same teamId', () => {
  const fla = resolveClubCode('FLA', 2011)
  const mia = resolveClubCode('MIA', 2012)
  assert.equal(fla.teamId, 146)
  assert.equal(mia.teamId, 146)
  assert.equal(fla.teamId, mia.teamId)
})

test('era-alias pairs coexisting in a single column resolve to one franchise', () => {
  const pairs = [
    [['ANA', 'CAL', 'LAA'], 108],
    [['OAK', 'ATH'], 133],
    [['KC', 'KCA'], 118],
    [['SD', 'SDN'], 135],
    [['SF', 'SFN'], 137],
    [['STL', 'SLN'], 138],
    [['TB', 'TBA'], 139],
    [['NYM', 'NYN'], 121],
  ]
  for (const [codes, teamId] of pairs) {
    for (const code of codes) {
      assert.equal(resolveClubCode(code)?.teamId, teamId, `${code} should resolve to teamId ${teamId}`)
    }
  }
})

test('non-MLB destinations resolve to the closed enum, teamId null', () => {
  const cases = {
    KBO: 'kbo',
    NPB: 'npb',
    NBP: 'npb', // confirmed typo for NPB, not a fourth league — see clubCodes.js header
    MEX: 'mexico',
    dnp: 'did-not-play',
    retired: 'retired',
  }
  for (const [code, destination] of Object.entries(cases)) {
    const resolved = resolveClubCode(code)
    assert.equal(resolved.destination, destination, `${code} should resolve to destination ${destination}`)
    assert.equal(resolved.teamId, null, `${code} should carry no teamId`)
    assert.equal(resolved.franchiseId, null, `${code} should carry no franchiseId`)
  }
})

test('every resolved teamId is one of src/lib/teams.js\'s 30 current MLB ids', () => {
  for (const code of distinctCodes()) {
    const resolved = resolveClubCode(code)
    if (resolved?.teamId != null) {
      assert.ok(ALL_MLB_TEAM_IDS.includes(resolved.teamId), `${code} -> ${resolved.teamId} is not a known MLB team id`)
    }
  }
})

test('agrees with scripts/lib/retrosheet-teams.mjs\'s crosswalk (no silent drift between the two)', () => {
  for (const [code, teamId] of Object.entries(PIPELINE_CODE_TO_TEAM_ID)) {
    const resolved = resolveClubCode(code)
    assert.equal(resolved?.teamId, teamId, `${code}: this module resolves ${resolved?.teamId}, retrosheet-teams.mjs resolves ${teamId}`)
  }
})
