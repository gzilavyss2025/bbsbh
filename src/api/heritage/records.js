import { getJson } from '../statsapi.js'

// One club's season of games, regular season and postseason, trimmed to what
// yearRecordThrough (lib/heritage/pass.js) reads: about 50 KB for a full MLB year
// (Phillies 2022, checked 2026-10-29). Shared by club and season, so a page of
// passes asks once per club. Rows carry results, so only a revealed Heritage
// Pass may call this, and the query ends on the game's own date, so no later
// game's result is ever fetched (and a later pass asks afresh).
const FIELDS = 'dates,games,gamePk,gameType,status,abstractGameState,detailedState,teams,away,home,team,id,leagueRecord,wins,losses,ties,isWinner'
const seasons = new Map()

export function fetchClubSeason(teamId, season, sportId, through) {
  const key = `${teamId}:${season}:${sportId}:${through}`
  if (!seasons.has(key)) {
    const path = `/api/v1/schedule?teamId=${teamId}&season=${season}&sportId=${sportId}` +
      `&gameType=R,F,D,L,W&startDate=${season}-01-01&endDate=${through}&fields=${FIELDS}`
    seasons.set(key, getJson(path).then((json) => (json?.dates ?? []).flatMap((d) => d?.games ?? []))
      .catch((error) => { seasons.delete(key); throw error }))
  }
  return seasons.get(key)
}
