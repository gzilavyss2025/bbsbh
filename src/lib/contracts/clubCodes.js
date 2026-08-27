// Club-code resolver for the historical contracts CSVs
// (scripts/data/contracts/{arbitration,extensions,free_agency}.csv). Pure, no
// fetch, so a contracts page or selector can call it at render time — money
// pages sit outside the spoiler scope (ADR-0034/0052), so nothing here needs
// a SealBox or a revealedThrough gate.
//
// THE PROBLEM (measured 2026-08-27, by enumerating every distinct code
// actually present in the four club-bearing columns — arbitration.club,
// extensions.club, free_agency.old_club, free_agency.new_club — not assumed
// from a Retrosheet reference table): those columns mix Retrosheet-style
// codes (NYA, SFN, CHN, TBA…) with plain modern abbreviations (BOS, MIL,
// NYM…) INCONSISTENTLY, sometimes within the same handful of seasons
// (arbitration.csv alone uses both ANA and LAA across 2018-2026, both OAK and
// ATH across 2018-2026, both KC and KCA, both SD and SDN, both SF and SFN,
// both STL and SLN). free_agency.csv's two club columns also carry six
// non-MLB sentinels for a player who left affiliated ball: KBO, MEX, NBP
// (a confirmed typo for NPB — the one NBP row, Pete Incaviglia 1995, reads
// "signed by Lotte Marines," the exact club-name pattern every other NPB row
// uses), NPB, dnp ("did not play"), and retired.
//
// scripts/lib/retrosheet-teams.mjs solves a narrower version of this same
// crosswalk for the build-time identity pipeline (gen-contracts-identity.mjs
// and its siblings). Its CLUB_CODE_TO_TEAM_ID table agrees with the one
// below — test/contracts-club-codes.test.js cross-checks them so the two
// can't silently drift — but it isn't imported here: src/ never pulls a
// scripts/lib module into the client bundle (see src/api/prospects.js's
// isPitcher for the same rule applied elsewhere). This file is the browser
// (and test) side of the same crosswalk, kept local on purpose.
//
// SEASON: the signature accepts `season` because a 2004 MON row is the
// Montreal Expos and a 2006 WAS row is the Washington Nationals — different
// clubs in baseball terms. But statsapi's own teamId is already
// FRANCHISE-persistent: it does not mint a new id when a club relocates or
// renames (Montreal -> Washington, Florida -> Miami, California -> Anaheim ->
// Los Angeles, Oakland -> "Athletics" all keep one id apiece). Confirmed
// directly against this app's own data, not assumed: the join target for
// this resolver, .scratch/team-success/roster-age-cache.json, keys its
// per-season rows as `hitting-{teamId}-{season}` / `pitching-{teamId}-{season}`
// and uses teamId 120 for BOTH `-2004` (the Expos' last season) and `-2005`
// through `-2006` (the Nationals' first seasons) — the exact same id, not two
// different ones. Every other MON/WAS-shaped pair in the CSVs (FLA/MIA,
// CAL/ANA/LAA, KC/KCA, SD/SDN, SF/SFN, STL/SLN, TB/TBA, OAK/ATH, NYM/NYN,
// CHA/CHN) is the same kind of era-dependent alias for one franchise-
// persistent id, confirmed by checking each pair's season ranges in the CSVs
// (docs/adr territory, not guessed). So `season` is accepted for the
// contract's documentation value and so a future ambiguous code has somewhere
// to be resolved, but no code in today's data needs it to pick a teamId — a
// caller joining to roster-age-cache.json by teamId gets the right row either
// way. If a future export ever needs a code disambiguated BY season, add that
// branch here and grow the coverage test's fixtures to catch it.

import { ALL_MLB_TEAM_IDS, isMlbTeamId } from '../teams.js'

// Every club code seen in the three CSVs that resolves to a current MLB
// franchise's teamId — the ids come from src/lib/teams.js (ALL_MLB_TEAM_IDS
// below asserts every value here is one of the 30), not invented. One entry
// per distinct spelling; several ids have more than one because the source
// spreadsheets were not consistent across the decades they cover.
const CODE_TO_TEAM_ID = {
  ANA: 108, // California/Anaheim Angels code, same franchise as LAA
  ARI: 109,
  ATH: 133, // this app's own current Athletics abbreviation
  ATL: 144,
  BAL: 110,
  BOS: 111,
  CAL: 108, // pre-1997 Angels code
  CHA: 145, // Retrosheet AL Chicago -> White Sox
  CHN: 112, // Retrosheet NL Chicago -> Cubs
  CIN: 113,
  CLE: 114,
  COL: 115,
  DET: 116,
  FLA: 146, // Florida Marlins, same franchise as MIA
  HOU: 117,
  KC: 118,
  KCA: 118, // Retrosheet AL Kansas City
  LAA: 108,
  LAN: 119, // Retrosheet NL Los Angeles -> Dodgers
  MIA: 146,
  MIL: 158,
  MIN: 142,
  MON: 120, // Montreal Expos, same franchise as WAS
  NYA: 147, // Retrosheet AL New York -> Yankees
  NYM: 121,
  NYN: 121, // Retrosheet NL New York -> Mets
  OAK: 133, // pre-2025 Oakland code, same franchise as ATH
  PHI: 143,
  PIT: 134,
  SD: 135,
  SDN: 135, // Retrosheet NL San Diego
  SEA: 136,
  SF: 137,
  SFN: 137, // Retrosheet NL San Francisco
  SLN: 138, // Retrosheet NL St. Louis -> Cardinals
  STL: 138,
  TB: 139,
  TBA: 139, // Retrosheet AL Tampa Bay
  TEX: 140,
  TOR: 141,
  WAS: 120,
}

// Every value above is one of src/lib/teams.js's 30 current MLB team ids —
// this table maps CODES onto that set, it never invents an id of its own.
// Runs unconditionally (not DEV-only) so a bad edit fails the moment the
// module loads, in a test or in the app.
for (const [code, teamId] of Object.entries(CODE_TO_TEAM_ID)) {
  if (!isMlbTeamId(teamId)) {
    throw new Error(`clubCodes: ${code} maps to ${teamId}, not a src/lib/teams.js MLB team id`)
  }
}

// The closed set of non-MLB destinations free_agency.csv's new_club column
// records for a player who left affiliated ball. NBP is folded into 'npb':
// it is a confirmed typo (see file header), not a fourth Asian league.
const CODE_TO_DESTINATION = {
  KBO: 'kbo',
  NPB: 'npb',
  NBP: 'npb', // typo for NPB, confirmed against the one row that uses it
  MEX: 'mexico',
  dnp: 'did-not-play',
  retired: 'retired',
}

// Resolves one raw club-code cell from arbitration.csv's `club`,
// extensions.csv's `club`, or free_agency.csv's `old_club`/`new_club`.
//
//   { teamId: 120, franchiseId: 120, destination: null }   - a known MLB club
//   { teamId: null, franchiseId: null, destination: 'npb' } - left MLB for a
//                                                              named destination
//   null - blank cell (free_agency.csv legitimately leaves old_club blank for
//          an undrafted international signing's first deal, and new_club
//          blank while a free agent's move is still pending) or a code this
//          table has never seen. A caller MUST tell these apart from a
//          resolved non-MLB destination — that is exactly what `null` vs. an
//          object with `destination` set does.
//
// `franchiseId` is always equal to `teamId` in this app: statsapi's teamId is
// already franchise-persistent (see the file header), so there is no separate
// franchise concept to carry. It is still a distinct field so a caller who
// means "this franchise, whichever club currently wears it" can read
// `franchiseId` and a caller who means "the exact statsapi team id used to
// join stats" can read `teamId`, even though today they are the same number.
export function resolveClubCode(code, _season) {
  if (typeof code !== 'string') return null
  const trimmed = code.trim()
  if (!trimmed) return null

  const teamId = CODE_TO_TEAM_ID[trimmed]
  if (teamId != null) {
    return { teamId, franchiseId: teamId, destination: null }
  }

  const destination = CODE_TO_DESTINATION[trimmed]
  if (destination != null) {
    return { teamId: null, franchiseId: null, destination }
  }

  return null
}

// Re-exported so a caller of this module never needs a second import from
// teams.js just to sanity-check a resolved teamId.
export { ALL_MLB_TEAM_IDS }
