// The World Series home page's reads (#1906, slice 3): hot bats, each club's
// postseason games and bullpen box scores, the standings and regular-season
// meetings for the tape, the ledger's runs, and the reel's clips and photos.
//
// SPOILER FOOTING (ADR-0087, ADR-0088). Every read here is bounded to games
// dated BEFORE the slate date, in the request (endDate is the day before) and
// again on the rows that come back, so a caller that hands in too much cannot
// get the slate date's game. Past games' runs, clip titles and photos are
// open by decision (the bracket brief: yesterday's results are not protected).
// Today's game never has its play feed, clips or photos read.
//
// Field paths checked against live statsapi on 2026-10-17 (stats byDateRange
// splits: stat.plateAppearances, stat.ops as a string; see the issue's
// pre-research item 2).
import { ballparkFor } from '../../lib/ballpark/ballparkData.js'
import { teamAbbr } from '../../lib/teams.js'
import { fetchPersonStats } from '../person-fetch.js'
import { getJson } from '../statsapi.js'
import { fetchGamePhotos } from '../gamePhotos.js'
import { fetchGameBoxscore, foldRunsByGame } from '../postseasonSeries.js'
import { dayBefore, keptGames } from './fetch.js'

// The last day a read may include.
const counts = (date, slateDate) => date < slateDate

export function hotBatsUrl(season, teamId, slateDate) {
  return (
    `/api/v1/stats?stats=byDateRange&group=hitting&gameType=P&season=${season}&teamId=${teamId}` +
    `&startDate=${season}-01-01&endDate=${dayBefore(slateDate)}&playerPool=ALL&limit=500`
  )
}

// The raw splits for pickHotBat. [] on any failure: the card hides.
export async function fetchHotBatSplits(season, teamId, slateDate, { signal } = {}) {
  try {
    const data = await getJson(hotBatsUrl(season, teamId, slateDate), { signal })
    return data?.stats?.[0]?.splits ?? []
  } catch {
    return []
  }
}

const CLUB_GAME_FIELDS = [
  'dates', 'date', 'games', 'gamePk', 'gameType', 'officialDate', 'seriesGameNumber', 'status', 'abstractGameState',
  'teams', 'away', 'home', 'team', 'id', 'isWinner',
].join(',')

export function clubGamesUrl(season, teamId, slateDate) {
  return (
    `/api/v1/schedule?sportId=1&season=${season}&gameType=F,D,L,W&teamId=${teamId}` +
    `&startDate=${season}-01-01&endDate=${dayBefore(slateDate)}&fields=${CLUB_GAME_FIELDS}`
  )
}

// One club's postseason games before the slate date, oldest first:
// { gamePk, date, gameType, gameNumber, final, homeId, awayId, winnerId }.
export async function fetchClubGames(season, teamId, slateDate, { signal } = {}) {
  const json = await getJson(clubGamesUrl(season, teamId, slateDate), { signal })
  return keptGames(json)
    .filter((g) => counts(g.officialDate, slateDate))
    .map((g) => {
      const { away, home } = g.teams ?? {}
      const winnerId = away?.isWinner === true ? away.team?.id : home?.isWinner === true ? home.team?.id : null
      return {
        gamePk: g.gamePk,
        date: g.officialDate,
        gameType: g.gameType,
        gameNumber: g.seriesGameNumber ?? null,
        final: g.status?.abstractGameState === 'Final',
        homeId: home?.team?.id ?? null,
        awayId: away?.team?.id ?? null,
        winnerId: winnerId ?? null,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)
}

// The bullpen grid's input: box scores of the club's last `limit` Final games
// before the slate date. A box score that fails to load is left out.
export async function fetchClubBoxscores(games, slateDate, { limit = 6, getBox = fetchGameBoxscore } = {}) {
  const recent = (games ?? []).filter((g) => g.final && g.date < slateDate).slice(-limit)
  const boxes = await Promise.all(recent.map((g) => getBox(g.gamePk)))
  return recent.map((g, i) => ({ gamePk: g.gamePk, date: g.date, boxscore: boxes[i] })).filter((g) => g.boxscore)
}

// The ledger's runs, folded by club id. Only games that count (dated before the slate date).
export async function fetchSeriesRuns(games, slateDate, { getBox = fetchGameBoxscore } = {}) {
  const list = (games ?? []).filter((g) => g.date && counts(g.date, slateDate))
  const boxes = await Promise.all(list.map((g) => getBox(g.gamePk)))
  return foldRunsByGame(list, boxes)
}

// No `date`: a date inside the postseason answers with no records at all
// (checked live, 2025-10-23). The regular season is over whenever the World
// Series is on, so the undated answer is the final regular-season table, which
// no postseason game can change.
export function standingsUrl(season) {
  return `/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&fields=records,teamRecords,team,id,wins,losses,runDifferential`
}

// { [teamId]: { wins, losses, runDiff } }, the final regular-season table.
export async function fetchStandingsFor(season, { signal } = {}) {
  const data = await getJson(standingsUrl(season), { signal })
  const out = {}
  for (const r of data?.records ?? []) {
    for (const t of r.teamRecords ?? []) out[t.team?.id] = { wins: t.wins ?? null, losses: t.losses ?? null, runDiff: t.runDifferential ?? null }
  }
  return out
}

export function meetingsUrl(season, teamId, opponentId, slateDate) {
  return (
    `/api/v1/schedule?sportId=1&teamId=${teamId}&opponentId=${opponentId}&gameType=R&season=${season}` +
    `&startDate=${season}-01-01&endDate=${dayBefore(slateDate)}&fields=${CLUB_GAME_FIELDS}`
  )
}

// The two clubs' regular-season games before the slate date, shaped like
// fetchClubGames' rows. [] when they did not meet or on a failed read.
export async function fetchMeetings(season, teamId, opponentId, slateDate, { signal } = {}) {
  try {
    const json = await getJson(meetingsUrl(season, teamId, opponentId, slateDate), { signal })
    return keptGames(json)
      .filter((g) => g.officialDate < slateDate)
      .map((g) => ({
        gamePk: g.gamePk,
        date: g.officialDate,
        final: g.status?.abstractGameState === 'Final',
        winnerId: g.teams?.away?.isWinner ? g.teams.away.team?.id : g.teams?.home?.isWinner ? g.teams.home.team?.id : null,
      }))
  } catch {
    return []
  }
}

// The reel's raw material: each game's clip items and photo rows. A game dated
// on or after the slate date is dropped BEFORE any read, so today's content is
// never requested. games: [{ gamePk, gameNumber, date, tag, filter }].
export async function fetchReelGames(games, slateDate) {
  const past = (games ?? []).filter((g) => g.date < slateDate)
  return Promise.all(
    past.map(async (g) => {
      // One /content read feeds both the clips and the photos.
      let content = null
      try {
        content = await getJson(`/api/v1/game/${g.gamePk}/content`)
      } catch {
        return { ...g, clips: [], photos: [] }
      }
      const items = content?.highlights?.highlights?.items
      return { ...g, clips: Array.isArray(items) ? items : [], photos: await fetchGamePhotos(g.gamePk, content) }
    }),
  )
}

// A pitcher's postseason game log this year, through the day before the slate
// date (endDate in the request, and the rows filtered again): the Probables
// card's bars and line. Each split gets `opponent.abbreviation`.
export async function fetchPostseasonOutings(personId, season, slateDate) {
  const splits = await fetchPersonStats(personId, {
    type: 'gameLog',
    group: 'pitching',
    season,
    gameType: 'F,D,L,W',
    endDate: dayBefore(slateDate),
  })
  return splits
    .filter((s) => s.date && s.date < slateDate)
    .map((s) => ({ ...s, opponent: { ...s.opponent, abbreviation: teamAbbr(s.opponent) } }))
}

// A park for the trip card: where it is, its clock, roof and seats, and the
// posted fence distances. Geography only, no game: spoiler-free. null on any
// failure, which hides the card.
const tripVenues = new Map()
export function fetchTripVenue(venueId) {
  if (!venueId) return Promise.resolve(null)
  if (!tripVenues.has(venueId)) tripVenues.set(venueId, readTripVenue(venueId))
  return tripVenues.get(venueId)
}

async function readTripVenue(venueId) {
  try {
    const data = await getJson(`/api/v1/venues/${venueId}?hydrate=location,fieldInfo,timezone`)
    const v = data.venues?.[0]
    const c = v?.location?.defaultCoordinates
    if (!v || c?.latitude == null) return null
    const park = ballparkFor(v.name, v.id)
    return {
      id: v.id,
      name: v.name,
      lat: Number(c.latitude),
      lon: Number(c.longitude),
      // The offset on game day, not the standard one: Phoenix keeps no DST.
      offset: v.timeZone?.offsetAtGameTime ?? v.timeZone?.offset ?? null,
      roof: v.fieldInfo?.roofType ?? park?.roof ?? '',
      seats: park?.capacity ?? v.fieldInfo?.capacity ?? null,
      dist: park?.dist ?? null,
    }
  } catch {
    return null
  }
}
