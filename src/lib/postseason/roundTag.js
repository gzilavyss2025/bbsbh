// THE ROUND'S SHORT NAME, WITH ITS LEAGUE (ADR-0115): NLWC, ALDS, NLCS; the World Series is WS.
//
// Six surfaces print a round tag. Each kept its own table (WC, DS, LCS), because a postseason
// row from a ledger, a schedule or a Savant pitch carries no league. This module is the one
// table, and it finds the league from the club and the season, which every one of those rows
// does carry. A club it does not know gives the plain round (WC, DS, LCS), so a tag never
// claims a league it cannot name.
//
// A round below the World Series is inside one league, so the league of EITHER club works. The
// World Series is both, and never takes a league.
//
// Two clubs changed league since the 1995 postseason ledger starts, and both are here: the
// Astros played in the NL through 2012 and the AL from 2013; the Brewers played in the AL
// through 1997 and the NL from 1998. test/round-tag.test.js pins the table against
// public/data/teams.json, which holds each club's league now.

// [teamId, abbreviation, league now, ...other spellings of the abbreviation]. The spellings are
// the ones Savant and older schedules print (OAK, CHW, TBR), so a caller with only an
// abbreviation can still ask.
const CLUBS = [
  [108, 'LAA', 'AL', 'ANA'],
  [110, 'BAL', 'AL'],
  [111, 'BOS', 'AL'],
  [114, 'CLE', 'AL'],
  [116, 'DET', 'AL'],
  [117, 'HOU', 'AL'],
  [118, 'KC', 'AL', 'KCR'],
  [133, 'ATH', 'AL', 'OAK'],
  [136, 'SEA', 'AL'],
  [139, 'TB', 'AL', 'TBR', 'TBD'],
  [140, 'TEX', 'AL'],
  [141, 'TOR', 'AL'],
  [142, 'MIN', 'AL'],
  [145, 'CWS', 'AL', 'CHW'],
  [147, 'NYY', 'AL'],
  [109, 'AZ', 'NL', 'ARI'],
  [112, 'CHC', 'NL'],
  [113, 'CIN', 'NL'],
  [115, 'COL', 'NL'],
  [119, 'LAD', 'NL'],
  [120, 'WSH', 'NL', 'WAS', 'MON'],
  [121, 'NYM', 'NL'],
  [134, 'PIT', 'NL'],
  [135, 'SD', 'NL', 'SDP'],
  [137, 'SF', 'NL', 'SFG'],
  [138, 'STL', 'NL'],
  [143, 'PHI', 'NL'],
  [144, 'ATL', 'NL'],
  [146, 'MIA', 'NL', 'FLA'],
  [158, 'MIL', 'NL'],
]

// Through this season (inclusive) a club that moved was in the OTHER league.
const MOVED = { 117: [2012, 'NL'], 158: [1997, 'AL'] }

const LEAGUE_NOW = new Map()
const ID_BY_ABBR = new Map()
for (const [id, abbr, league, ...others] of CLUBS) {
  LEAGUE_NOW.set(id, league)
  for (const a of [abbr, ...others]) ID_BY_ABBR.set(a, id)
}

export const CLUB_LEAGUES = CLUBS.map(([id, , league]) => [id, league])

const yearOf = (season) => {
  const y = Number(String(season ?? '').slice(0, 4))
  return Number.isFinite(y) && y > 0 ? y : null
}

// 'AL', 'NL', or '' for a club this table does not know. `club` is a team id or an
// abbreviation; `season` is a year or a date, and with none the league is the club's now.
export function clubLeague(club, season) {
  const id = typeof club === 'string' && !/^\d+$/.test(club) ? ID_BY_ABBR.get(club.toUpperCase()) : Number(club)
  const now = LEAGUE_NOW.get(id)
  if (!now) return ''
  const moved = MOVED[id]
  const y = yearOf(season)
  return moved && y != null && y <= moved[0] ? moved[1] : now
}

// The round for a game type (F, D, L, W), named for a league when it has one.
export function roundName(gameType, league = '') {
  const round = { F: 'WC', D: 'DS', L: 'LCS', W: 'WS' }[gameType] ?? ''
  if (!league || !round || round === 'WS') return round
  return round === 'LCS' ? `${league}CS` : `${league}${round}`
}

// A minor-league club plays a Division Series (L) and a Championship Series (W), which the
// feed files under the same codes as MLB's LCS and World Series. At sportId 11-14 they read
// DS and CS, so a Double-A title round never wears "WS". Triple-A's pennant round is W only.
// `sportId` 1 (or none) keeps roundName's own table.
export function roundNameAt(gameType, sportId, league = '') {
  if (sportId >= 11 && sportId <= 14) return { L: 'DS', W: 'CS' }[gameType] ?? ''
  return roundName(gameType, league)
}

// The tag a row wears: the round, with the league of the club it was played by. '' for a game
// that is not a postseason round.
export function roundTag(gameType, club, season) {
  return roundName(gameType, clubLeague(club, season))
}
