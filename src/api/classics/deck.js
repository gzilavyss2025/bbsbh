// The classics deck (issue #1525): MLB games from 1960 on, dealt to be scored
// by hand. Two plain schedule calls per deal, no pool file.
//
// SPOILER-FREE BY THE `fields=` LIST. A plain schedule row carries `score`,
// `isWinner` and `leagueRecord`. CLASSICS_FIELDS names only ids, names, dates,
// the venue and `status.detailedState`, so the response holds none of them (0
// keys in the 1982 Brewers' season, 57 KB). Never `hydrate=linescore`. A game
// is dealt on who played, never on what happened (ADR-0080).
import { getJson } from '../statsapi.js'
import { seedFrom, pickGame } from '../milbPool.js'

export { seedFrom }

export const CLASSICS_FIELDS =
  'dates,date,games,gamePk,gameType,officialDate,gameNumber,seriesGameNumber,teams,away,home,team,id,name,abbreviation,venue,status,detailedState'

const FIRST_SEASON = 1960
const TEAM_FIELDS = 'teams,id,abbreviation'
// Regular season, wild card, division, league and world series. No spring, exhibition or all-star.
const GAME_TYPES = new Set(['R', 'F', 'D', 'L', 'W'])

export const scheduleUrl = (teamId, season) =>
  `/api/v1/schedule?sportId=1&teamId=${teamId}&season=${season}&fields=${CLASSICS_FIELDS}`
export const teamsUrl = (season) => `/api/v1/teams?sportId=1&season=${season}&fields=${TEAM_FIELDS}`

// Schedule rows -> pickGame entries. `abbr` maps teamId -> abbreviation for that
// season's AL/NL clubs; a club outside it is not a major-league game.
export function classicsFrom(rows, abbr) {
  return rows
    .filter(
      (g) =>
        GAME_TYPES.has(g.gameType) &&
        g.officialDate >= `${FIRST_SEASON}-01-01` &&
        g.status?.detailedState === 'Final' &&
        abbr.has(g.teams?.away?.team?.id) &&
        abbr.has(g.teams?.home?.team?.id),
    )
    .map((g) => ({
      pk: g.gamePk,
      date: g.officialDate,
      away: { abbr: abbr.get(g.teams.away.team.id) },
      home: { abbr: abbr.get(g.teams.home.team.id) },
      g: g.gameNumber ?? 1,
    }))
}

// One deal. `era` is a decade (1980), `teamId` a club; both optional. Walks the
// seasons in a seeded order until one yields a game, so a club that did not exist
// in a season, or an empty season, costs a call rather than a dead card.
// ponytail: season, then club, then game is not uniform over games; fine for a card.
export async function rollClassic({
  seed = 0,
  step = 0,
  era = null,
  teamId = null,
  lastSeason = new Date().getFullYear() - 1,
  isStarted = null,
  fetchJson = getJson,
} = {}) {
  const decade = Number(era) || null
  const seasons = []
  for (let y = FIRST_SEASON; y <= lastSeason; y++) if (!decade || Math.floor(y / 10) * 10 === decade) seasons.push(y)
  const order = pickOrder(seasons, seed)
  for (const season of order) {
    const clubs = (await fetchJson(teamsUrl(season)))?.teams ?? []
    const abbr = new Map(clubs.map((t) => [t.id, t.abbreviation]))
    const club = teamId ?? clubs[Math.floor(seedFrom(`${seed}|${season}|club`) / 4294967296 * clubs.length)]?.id
    if (!abbr.has(club)) continue
    const rows = (await fetchJson(scheduleUrl(club, season)))?.dates?.flatMap((d) => d.games) ?? []
    const dealt = pickGame(classicsFrom(rows, abbr), { seed: seedFrom(`${seed}|${season}`), step, isStarted })
    if (dealt) return { ...dealt, season }
  }
  return null
}

// The season order and the club pick use separate hashes. One shared hash would sort
// the lowest value first and so pick club 0 for almost every seed.
const pickOrder = (seasons, seed) =>
  seasons.map((y) => [seedFrom(`${seed}|${y}|order`), y]).sort((a, b) => a[0] - b[0]).map((p) => p[1])
