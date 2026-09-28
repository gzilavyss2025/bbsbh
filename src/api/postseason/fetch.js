// The postseason bracket's two statsapi reads (#1224, slice 3). Both are
// separate from fetchSchedule, the same way fetchSlateScores is (see the
// header of ../schedule.js): the slate model never carries a result, and
// nothing here goes through it.
//
// THE SKELETON (skeletonUrl) is every postseason game of one season: clubs,
// placeholders, dates, series numbers. It asks for NO result field — no
// status, no winner, no score. It is still not a pure calendar: statsapi turns
// a placeholder ("SD/CHC") into a club the moment the series that fills it
// ends, and drops an unplayed "if necessary" game at the same moment. So
// bracket.js takes structure from it and never a club it did not derive
// from the results itself.
//
// THE RESULTS (resultsUrl) are the winners, and ONLY for dates before the
// cutoff (endDate is the day before). The one result field is `isWinner`.
// Never runs, a score, a linescore, `seriesStatus` or `leagueRecord`: the last
// two read the state AFTER a game ("MIL leads 1-0" on NLDS Game 1), which is
// trap 1 of the build prompt. bracket.js re-applies the cutoff on its own,
// because a suspended game with an officialDate before the cutoff can still
// have gone Final on the cutoff date (its resumeGameDate).
//
// Every field path below was checked against live statsapi on 2026-09-28:
// the 2025 and 2026 postseason (gameType F,D,L,W), the 2022 ALDS postponed
// Games 2 and 5 (gamePks 715752, 715749) and the 2008 World Series suspended
// Game 5 (243847). Placeholders carry real-looking ids (5528 "HOU/CWS", 5513
// "AL Higher Seed", 2711 "Lower Seed League Champion"); `hydrate=team` gives
// each one an `abbreviation` ("HOU/CWS", "AL High") and a `league`.

import { getJson } from '../statsapi.js'
import { deriveBracket } from './bracket.js'

const GAME_TYPES = 'F,D,L,W'

const SKELETON_FIELDS = [
  'dates',
  'date',
  'games',
  'gamePk',
  'gameType',
  'officialDate',
  'resumeGameDate',
  'description',
  'seriesDescription',
  'seriesGameNumber',
  'gamesInSeries',
  'teams',
  'away',
  'home',
  'team',
  'id',
  'name',
  'abbreviation',
  'league',
].join(',')

const RESULT_FIELDS = [
  'dates',
  'date',
  'games',
  'gamePk',
  'officialDate',
  'resumeGameDate',
  'status',
  'abstractGameState',
  'teams',
  'away',
  'home',
  'team',
  'id',
  'isWinner',
].join(',')

// 'YYYY-MM-DD' minus one day, in UTC so no timezone can move it.
export function dayBefore(iso) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function skeletonUrl(season) {
  return `/api/v1/schedule?sportId=1&season=${season}&gameType=${GAME_TYPES}&hydrate=team&fields=${SKELETON_FIELDS}`
}

export function resultsUrl(season, cutoffDate) {
  return (
    `/api/v1/schedule?sportId=1&season=${season}&gameType=${GAME_TYPES}` +
    `&startDate=${season}-01-01&endDate=${dayBefore(cutoffDate)}&fields=${RESULT_FIELDS}`
  )
}

// Each game once, under the listing whose date IS its officialDate — the
// dedupe scripts/gen-highlights.mjs uses. A postponed game is listed under its
// old date too (officialDate = the new date, "Final", no winner); a resumed
// game is listed again on its resume date (officialDate = the old date). Both
// extra listings go.
function keptGames(json) {
  const seen = new Set()
  const out = []
  for (const d of json?.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.officialDate && d.date !== g.officialDate) continue
      if (seen.has(g.gamePk)) continue
      seen.add(g.gamePk)
      out.push(g)
    }
  }
  return out
}

function slotClub(team) {
  return {
    id: team?.id ?? null,
    name: team?.name ?? '',
    abbreviation: team?.abbreviation ?? '',
    leagueId: team?.league?.id ?? null,
  }
}

export function skeletonRowsFrom(json) {
  return keptGames(json).map((g) => ({
    gamePk: g.gamePk,
    gameType: g.gameType,
    officialDate: g.officialDate,
    resumeGameDate: g.resumeGameDate ?? null,
    description: g.description ?? '',
    seriesDescription: g.seriesDescription ?? '',
    gameNumber: g.seriesGameNumber ?? null,
    gamesInSeries: g.gamesInSeries ?? null,
    away: slotClub(g.teams?.away?.team),
    home: slotClub(g.teams?.home?.team),
  }))
}

export function resultRowsFrom(json) {
  return keptGames(json).map((g) => {
    const away = g.teams?.away
    const home = g.teams?.home
    const winnerId = away?.isWinner === true ? away.team?.id : home?.isWinner === true ? home.team?.id : null
    return {
      gamePk: g.gamePk,
      officialDate: g.officialDate,
      resumeGameDate: g.resumeGameDate ?? null,
      final: g.status?.abstractGameState === 'Final',
      winnerId: winnerId ?? null,
    }
  })
}

export async function fetchPostseasonSkeleton(season, { signal } = {}) {
  return skeletonRowsFrom(await getJson(skeletonUrl(season), { signal }))
}

export async function fetchPostseasonResults(season, cutoffDate, { signal } = {}) {
  return resultRowsFrom(await getJson(resultsUrl(season, cutoffDate), { signal }))
}

// Both reads, then the derivation. A failed results read FAILS the whole load
// rather than drawing every series 0-0: a wrong state is worse than none.
export async function loadPostseasonBracket(cutoffDate, season, { signal } = {}) {
  const [skeleton, results] = await Promise.all([
    fetchPostseasonSkeleton(season, { signal }),
    fetchPostseasonResults(season, cutoffDate, { signal }),
  ])
  return deriveBracket(skeleton, results, cutoffDate)
}
