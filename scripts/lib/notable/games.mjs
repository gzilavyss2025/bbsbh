// The pure half of scripts/gen-notable.mjs, part 2: the season game map.
//
// THE SPINE. One schedule call per season, with the linescore and the team hydrated.
// Every row of every kind takes its date, its clubs and its score from this map, by
// gamePk, so a score costs no extra call (D5). The map holds only the games the index
// may hold (rules.mjs isKeptGame). rules.mjs lists the live checks behind each field.
import { isKeptGame } from './rules.mjs'

// The `fields=` list for the schedule call: the ten-times saving findings.md measured.
// `league` carries the club's league id, which is how a Negro league game is dropped.
export const SCHEDULE_FIELDS =
  'dates,games,gamePk,officialDate,gameType,gameNumber,status,detailedState,' +
  'teams,away,home,score,team,id,abbreviation,name,league,' +
  'linescore,innings,num,hits,runs'

export function scheduleUrl(season) {
  return (
    `/api/v1/schedule?sportId=1&season=${season}&gameType=R,F,D,L,W` +
    `&hydrate=team,linescore&fields=${SCHEDULE_FIELDS}`
  )
}

const num = (v) => (typeof v === 'number' ? v : null)

function clubOf(side, linescoreSide) {
  const team = side?.team ?? {}
  return {
    id: team.id ?? null,
    abbr: team.abbreviation ?? '',
    name: team.name ?? '',
    leagueId: team.league?.id ?? null,
    // The game's own score first; the linescore total when the row has none.
    runs: num(side?.score) ?? num(linescoreSide?.runs),
    hits: num(linescoreSide?.hits),
  }
}

// One schedule row as the map holds it. `innings` stays for the no-hitter marks and
// is never written to a file.
export function gameFromRow(row) {
  const ls = row?.linescore ?? {}
  return {
    gamePk: row?.gamePk,
    officialDate: row?.officialDate ?? '',
    gameType: row?.gameType ?? '',
    gameNumber: row?.gameNumber ?? 1,
    state: row?.status?.detailedState ?? '',
    away: clubOf(row?.teams?.away, ls.teams?.away),
    home: clubOf(row?.teams?.home, ls.teams?.home),
    innings: Array.isArray(ls.innings) ? ls.innings : [],
  }
}

// Map<gamePk, game> of the kept games. The schedule lists a suspended game twice, under
// the first date and the resume date (1975 has 7, with the same gamePk, clubs and score),
// so a gamePk is read once: the first kept row wins.
export function buildGameMap(dates) {
  const map = new Map()
  for (const day of dates ?? []) {
    for (const row of day?.games ?? []) {
      if (map.has(row?.gamePk)) continue
      const game = gameFromRow(row)
      if (isKeptGame(game)) map.set(game.gamePk, game)
    }
  }
  return map
}

// Which side a club was on in a game, or null.
export function sideOfClub(game, clubId) {
  if (clubId == null) return null
  if (game.away.id === clubId) return 'away'
  if (game.home.id === clubId) return 'home'
  return null
}

export const otherSide = (side) => (side === 'home' ? 'away' : 'home')

// The last day the map holds a played game for: the date the data runs through.
export function lastPlayedDate(map) {
  let last = ''
  for (const game of map.values()) if (game.officialDate > last) last = game.officialDate
  return last
}

// The part of a game every row carries: its identity, its date and both clubs with the
// score. The club's abbreviation and name are the ones of that season.
export function gameHead(game) {
  const club = (c) => ({ id: c.id, abbr: c.abbr, name: c.name, runs: c.runs })
  return {
    gamePk: game.gamePk,
    officialDate: game.officialDate,
    gameType: game.gameType,
    gameNumber: game.gameNumber,
    away: club(game.away),
    home: club(game.home),
  }
}
