// Postseason series state for /research's "Series game" card (#3141). The store's shards
// hold no series facts, so a loaded season joins its postseason schedule by gamePk
// (Gary, 2026-11-16: a client fetch, no shard change).
//
// FIELDS (checked against the 2015, 2020, 2024 and 2025 postseasons on 2026-11-16):
// `seriesGameNumber`, `gamesInSeries`, `teams.{home,away}.{team.id,isWinner}`. A postponed
// or resumed game is listed twice (2020); postseason/fetch.js `keptGames` keeps one, and a
// game with no winner is left out.
//
// LOADED ON DEMAND. store.js `attachSeries` fetches a season's series only when a query has
// a Series game chip; a failed fetch is an error on the answer, never a silent empty card.
//
// DEFINITIONS (Gary, 2026-11-16). A series is won at more than half of `gamesInSeries`.
//   Series-deciding   the game the series ended in (a 4-1 World Series: its Game 5).
//   Sudden death      both clubs one win from taking the series (Game 7, a one-game wild card).
//   Potential clinch  read from the BATTING club: a win today takes the series.
//   Potential elimination  the batting club is out with a loss today.
//
// SPOILER CLASSIFICATION: spoiler-free. Past games only, on an open page (ADR-0034).

import { getJson } from '../statsapi.js'
import { keptGames } from '../postseason/fetch.js'

const PATH = '/api/v1/schedule?sportId=1&gameType=F,D,L,W&fields=dates,date,games,gamePk,gameType,officialDate,seriesGameNumber,gamesInSeries,teams,home,away,team,id,isWinner&season='

// Schedule JSON -> Map(gamePk -> { n, decider, sudden, home: { clinch, elim }, away: { clinch, elim } }).
export function seriesByGame(schedule) {
  const series = new Map()
  for (const g of keptGames(schedule)) {
    if (!g.gamesInSeries || !g.seriesGameNumber || !(g.teams?.home?.isWinner || g.teams?.away?.isWinner)) continue
    const ids = [g.teams?.home?.team?.id, g.teams?.away?.team?.id]
    if (ids.some((id) => id == null)) continue
    const k = `${g.gameType}-${[...ids].sort((a, b) => a - b).join('-')}`
    if (!series.has(k)) series.set(k, new Map())
    series.get(k).set(g.gamePk, g)
  }
  const out = new Map()
  for (const games of series.values()) {
    const wins = new Map()
    for (const g of [...games.values()].sort((a, b) => a.seriesGameNumber - b.seriesGameNumber)) {
      const need = Math.floor(g.gamesInSeries / 2) + 1
      const won = (side) => wins.get(g.teams[side].team.id) ?? 0
      const onEdge = (side) => won(side) === need - 1
      const info = {
        n: g.seriesGameNumber,
        sudden: onEdge('home') && onEdge('away'),
        home: { clinch: onEdge('home'), elim: onEdge('away') },
        away: { clinch: onEdge('away'), elim: onEdge('home') },
      }
      const winner = g.teams.home.isWinner ? 'home' : 'away'
      wins.set(g.teams[winner].team.id, won(winner) + 1)
      info.decider = won(winner) === need
      out.set(g.gamePk, info)
    }
  }
  return out
}

// One season's series map. Rejects when the feed fails.
export function fetchSeries(season) {
  return getJson(`${PATH}${season}`).then(seriesByGame)
}

// The "Series game" card's values for a plate appearance: none outside a postseason series.
export function seriesValues(pa) {
  const s = pa.series
  if (!s) return []
  const side = pa.top ? s.away : s.home
  return [`g${s.n}`, s.decider && 'last', s.sudden && 'sd', side.clinch && 'clinch', side.elim && 'elim'].filter(Boolean)
}
