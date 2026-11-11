// Club names, abbreviations and ids for the 30 MLB clubs. Split out of
// teams.js (#3039); teams.js re-exports it.

// A team's slug-safe abbreviation, derived from a schedule/roster payload's
// own team object. Some hydrations omit `abbreviation` (thin MiLB rows,
// hydration outages, or a raw stats-split row's embedded team object — see
// statsLevels.js's combineToPool) — for those, prefer the real abbreviation
// from TEAM_ABBR (the 30 current MLB clubs) over guessing from the name,
// since a naive first-three-letters slice mangles multi-word cities (San
// Francisco -> "SAN" instead of "SF", Arizona -> "ARI" instead of "AZ", New
// York -> "NEW" for both the Mets and Yankees). Only MiLB/unrecognized ids
// fall through to that truncation.
export function teamAbbr(team) {
  return (
    team?.abbreviation ||
    TEAM_ABBR[team?.id] ||
    (team?.teamName || team?.name || '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()
  )
}

// The 30 current MLB clubs' real abbreviations (verified against
// public/data/teams.json, itself sourced from statsapi's own `abbreviation`
// field via gen-teams.mjs) — same id set/shape as TEAM_COLORS below.
const TEAM_ABBR = {
  108: 'LAA',
  109: 'AZ',
  110: 'BAL',
  111: 'BOS',
  112: 'CHC',
  113: 'CIN',
  114: 'CLE',
  115: 'COL',
  116: 'DET',
  117: 'HOU',
  118: 'KC',
  119: 'LAD',
  120: 'WSH',
  121: 'NYM',
  133: 'ATH',
  134: 'PIT',
  135: 'SD',
  136: 'SEA',
  137: 'SF',
  138: 'STL',
  139: 'TB',
  140: 'TEX',
  141: 'TOR',
  142: 'MIN',
  143: 'PHI',
  144: 'ATL',
  145: 'CWS',
  146: 'MIA',
  147: 'NYY',
  158: 'MIL',
}

// The 30 MLB clubs' display names, split into [location, club nickname], keyed
// by the team id carried everywhere in the app. statsapi does expose these
// (locationName / teamName), but every surface that wants a name already has
// the id in hand and the identities are effectively immutable, so a static map
// beats threading extra name fields (or an extra fetch) through. MLB only — the
// name helpers below return null for a MiLB id, and callers degrade.
const MLB_TEAM_NAMES = {
  108: ['Los Angeles', 'Angels'],
  109: ['Arizona', 'Diamondbacks'],
  110: ['Baltimore', 'Orioles'],
  111: ['Boston', 'Red Sox'],
  112: ['Chicago', 'Cubs'],
  113: ['Cincinnati', 'Reds'],
  114: ['Cleveland', 'Guardians'],
  115: ['Colorado', 'Rockies'],
  116: ['Detroit', 'Tigers'],
  117: ['Houston', 'Astros'],
  118: ['Kansas City', 'Royals'],
  119: ['Los Angeles', 'Dodgers'],
  120: ['Washington', 'Nationals'],
  121: ['New York', 'Mets'],
  133: ['Athletics', 'Athletics'], // relocating club, MLB-branded simply "Athletics"
  134: ['Pittsburgh', 'Pirates'],
  135: ['San Diego', 'Padres'],
  136: ['Seattle', 'Mariners'],
  137: ['San Francisco', 'Giants'],
  138: ['St. Louis', 'Cardinals'],
  139: ['Tampa Bay', 'Rays'],
  140: ['Texas', 'Rangers'],
  141: ['Toronto', 'Blue Jays'],
  142: ['Minnesota', 'Twins'],
  143: ['Philadelphia', 'Phillies'],
  144: ['Atlanta', 'Braves'],
  145: ['Chicago', 'White Sox'],
  146: ['Miami', 'Marlins'],
  147: ['New York', 'Yankees'],
  158: ['Milwaukee', 'Brewers'],
}

// Every current MLB club's team id, in no particular order — for surfaces that
// need to enumerate the whole league (e.g. showing all 30 clubs even ones a
// given umpire/player hasn't touched this season).
export const ALL_MLB_TEAM_IDS = Object.keys(MLB_TEAM_NAMES).map(Number)

// True only for a CURRENT MLB club's team id — the 30 ids in MLB_TEAM_NAMES.
// A MiLB affiliate id, a null/undefined team, or anything else is false. Used
// to gate the Headshot fallback chain (headshotSources above): a confirmed
// major-leaguer never falls back to his stale `milb` prospect photo.
export function isMlbTeamId(teamId) {
  return teamId != null && MLB_TEAM_NAMES[teamId] != null
}

// "Pittsburgh" — the club's place name, for prose like "Last game against
// Pittsburgh". Null for a MiLB id.
export function teamLocationName(teamId) {
  return MLB_TEAM_NAMES[teamId]?.[0] ?? null
}

// "Pirates" — the club's nickname, for prose like "@ Pirates". Null for a MiLB id.
export function teamClubName(teamId) {
  return MLB_TEAM_NAMES[teamId]?.[1] ?? null
}

// A club nickname short enough for a tight two-line tile (the off-day card),
// where the canonical nickname would wrap. Only clubs whose nickname overflows
// get an entry; everyone else falls back to teamClubName. "D-backs" is the
// team's own brand-approved short form for the Diamondbacks.
const SHORT_CLUB_NAMES = {
  109: 'D-backs',
}

// "Pirates" / "D-backs" — the nickname to show on space-constrained tiles.
// Falls back to the full nickname (teamClubName) when there's no short form.
export function teamClubNameShort(teamId) {
  return SHORT_CLUB_NAMES[teamId] ?? teamClubName(teamId)
}

// "Pittsburgh Pirates" — the full club name. Collapses the relocating
// Athletics' duplicated halves to a single "Athletics". Null for a MiLB id.
//
// Also what a club is CALLED IN AN ADDRESS ('/team/pittsburgh-pirates-134',
// route.js `teamSegment`), which is why every MLB club's URL names itself with
// no caller passing anything. The two halves above exist for prose, where a club
// is one or the other and never both; a URL is read cold, with no sentence
// around it, so it gets the whole name.
export function teamFullName(teamId) {
  const t = MLB_TEAM_NAMES[teamId]
  if (!t) return null
  return t[0] === t[1] ? t[1] : `${t[0]} ${t[1]}`
}
