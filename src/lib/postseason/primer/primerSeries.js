// Which series the home page's series primer shows (ADR-0087, 2026-10-08
// addendum). The primer replaces the usual postseason page only on a day when
// every game on the MLB slate is in an LCS or the World Series, with one game
// per series. Any other day (a Division Series game, a doubleheader, a resumed
// game, a game the bracket does not know) returns [], and the page stays as it is.
// So does a live bracket (Scores Unlocked) that already counts today's game: the
// primer shows only the state heading into the cutoff. Every primer part starts
// here, so this one check keeps today's result out of all of them.
import { seriesPlayingToday } from '../bracketDisplay.js'

const PRIMER_ROUNDS = new Set(['lcs', 'worldseries'])

export function primerSeriesFor(bracket, slateDate, slateGamePks) {
  const list = seriesPlayingToday(bracket, slateDate).filter((s) => PRIMER_ROUNDS.has(s.round))
  if (!list.length || list.some((s) => s.games.some((g) => g.gamePk === s.cutoffGame.gamePk))) return []
  const count = new Map(list.map((s) => [s.key, 0]))
  for (const pk of slateGamePks ?? []) {
    const key = bracket.gameIndex[pk]?.key
    if (!count.has(key)) return []
    count.set(key, count.get(key) + 1)
  }
  return [...count.values()].every((n) => n === 1) ? list : []
}

// The tab that opens first on a two-series day: the favourite club's series,
// else the series whose game starts first, else the NL series.
// `firstPitchByPk` maps a gamePk to its ISO `gameDate`.
export function defaultPrimerSeries(list, { favoriteTeamId, firstPitchByPk = {} } = {}) {
  const fav = list.find((s) => s.slots.some((slot) => slot.club?.id === favoriteTeamId))
  if (fav) return fav
  const [a, b] = list.map((s) => firstPitchByPk[s.cutoffGame?.gamePk])
  if (a && b && a !== b) return a < b ? list[0] : list[1]
  return list.find((s) => s.league === 'NL') ?? list[0] ?? null
}
