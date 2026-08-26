// Club-code -> teamId crosswalk for the historical contract CSVs
// (scripts/data/contracts/*.csv). Those files were exported from decades-old
// spreadsheets and use a MIX of Retrosheet-style codes (NYA, SFN, CHN) and
// plain modern abbreviations (NYM, BOS, MIL) -- confirmed by enumerating every
// distinct code actually present across arbitration.csv/extensions.csv/
// free_agency.csv's club columns, not assumed from a Retrosheet reference.
//
// teamId is stable across a franchise's relocations and renames (Montreal ->
// Washington, Florida -> Miami, California -> Anaheim -> Los Angeles Angels
// all keep one id), so this is a flat map, not a season-ranged one -- no code
// here is reused by two different franchises within 1991-2026.
//
// free_agency.csv's new_club column also carries a handful of non-MLB
// sentinels for players who left affiliated ball entirely (retired, or signed
// in Korea/Japan/Mexico) -- those resolve to `{ teamId: null, leftMlb: true }`,
// never to an error and never silently dropped.

export const CLUB_CODE_TO_TEAM_ID = {
  ANA: 108, // California/Anaheim Angels -> LAA, same franchise
  ARI: 109,
  ATH: 133, // Athletics (bbsbh's own current abbreviation for this id)
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
  FLA: 146, // Florida Marlins -> Miami, same franchise
  HOU: 117,
  KC: 118,
  KCA: 118, // Retrosheet AL Kansas City
  LAA: 108,
  LAN: 119, // Retrosheet NL Los Angeles -> Dodgers
  MIA: 146,
  MIL: 158,
  MIN: 142,
  MON: 120, // Montreal Expos -> Washington, same franchise
  NYA: 147, // Retrosheet AL New York -> Yankees
  NYM: 121,
  NYN: 121, // Retrosheet NL New York -> Mets
  OAK: 133, // pre-rename Oakland code, same franchise as ATH
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

// Tokens observed in free_agency.csv's new_club column that mean "left MLB
// entirely," not a 31st team.
const NON_MLB_CODES = new Set(['dnp', 'retired', 'kbo', 'npb', 'nbp', 'mex'])

// Resolve one raw club-code cell from the contract CSVs.
//   { teamId, leftMlb: false } - a known MLB franchise
//   { teamId: null, leftMlb: true } - a recognized "left affiliated ball" sentinel
//   null - empty cell or a code this table has never seen (should not happen;
//          scripts/gen-contracts-identity.mjs treats this as a hard error so a
//          new source spreadsheet with an unrecognized code fails loudly
//          instead of silently producing unresolved rows).
export function resolveClubCode(code) {
  const trimmed = typeof code === 'string' ? code.trim() : ''
  if (!trimmed) return null
  if (NON_MLB_CODES.has(trimmed.toLowerCase())) return { teamId: null, leftMlb: true }
  const teamId = CLUB_CODE_TO_TEAM_ID[trimmed.toUpperCase()]
  return teamId ? { teamId, leftMlb: false } : null
}
