// Which series the home page's series primer shows (ADR-0087, 2026-10-08
// addendum). The primer replaces the usual postseason page only on a day when
// every game on the MLB slate is in ONE round (the Wild Card, the Division
// Series, the LCS or the World Series), with one game per series. Any other day
// (two rounds on the slate, a doubleheader, a resumed game, a game the bracket
// does not know) returns [], and the page stays as it is. So does a live bracket
// (Scores Unlocked) that already counts today's game: the primer shows only the
// state heading into the cutoff. Every primer part starts here, so this one
// check keeps today's result out of all of them.
import { seriesPlayingToday } from '../bracketDisplay.js'

export function primerSeriesFor(bracket, slateDate, slateGamePks) {
  const list = seriesPlayingToday(bracket, slateDate)
  if (!list.length || new Set(list.map((s) => s.round)).size > 1) return []
  if (list.some((s) => s.games.some((g) => g.gamePk === s.cutoffGame.gamePk))) return []
  const count = new Map(list.map((s) => [s.key, 0]))
  for (const pk of slateGamePks ?? []) {
    const key = bracket.gameIndex[pk]?.key
    if (!count.has(key)) return []
    count.set(key, count.get(key) + 1)
  }
  return [...count.values()].every((n) => n === 1) ? list : []
}

// The tab that opens first: the favourite club's series, else the series whose
// game starts first, else the NL series. A tie on first pitch goes to the NL
// series among the tied. `firstPitchByPk` maps a gamePk to its ISO `gameDate`.
export function defaultPrimerSeries(list, { favoriteTeamId, firstPitchByPk = {} } = {}) {
  const fav = list.find((s) => s.slots.some((slot) => slot.club?.id === favoriteTeamId))
  if (fav) return fav
  const times = list.map((s) => firstPitchByPk[s.cutoffGame?.gamePk])
  const first = times.every(Boolean) ? [...times].sort()[0] : null
  const pool = first ? list.filter((_, i) => times[i] === first) : list
  return pool.find((s) => s.league === 'NL') ?? pool[0] ?? null
}
