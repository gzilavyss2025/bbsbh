import { useMemo, useState } from 'react'
import { defaultPrimerSeries, primerSeriesFor } from '../../lib/postseason/primer/primerSeries.js'
import { useSeriesPrimerData } from './useSeriesPrimerData.js'

const NO_GAMES = []

// The home page's series primer (ADR-0087, 2026-10-08 addendum): which series it
// shows, which tab is open, and that series' finished games. One hook, called
// once by the slate, because the main column and the right column draw from the
// same answer. SeriesPrimer.jsx draws it.
//
//   enabled     false below BRACKET_RAIL_QUERY: nothing is read
//   postseason  usePostseasonBracket's answer: the bracket and its `cutoff`. With
//               Scores Unlocked on it is the live bracket, and once today's game is
//               Final it counts that game, so primerSeriesFor returns no series
//               (ADR-0087, 2026-10-08 addendum a)
//   games       the day's raw MLB slate, so a stacked doubleheader game counts
//
// -> { bracket, cutoff, slateDate, isToday, favoriteTeamId } always (what the
// survivors' board and the bracket rail need when there is no primer), plus
// { list, series, game, setPick, data } when there is one (`series` is null if not).
// Only the open series reads its games. A series read once is kept, so a tab
// flip back reads nothing.
export function usePrimer({ enabled, postseason, slateDate, isToday, games: slate, favoriteTeamId }) {
  const { bracket, cutoff } = postseason
  const games = slate ?? NO_GAMES // null while the slate loads
  const list = useMemo(
    () => (enabled ? primerSeriesFor(bracket, slateDate, games.map((g) => g.gamePk)) : []),
    [enabled, bracket, slateDate, games],
  )
  const [pickId, setPick] = useState(null)
  const series =
    list.find((s) => s.id === pickId) ??
    defaultPrimerSeries(list, {
      favoriteTeamId,
      // Only two series can tie on the favourite club.
      firstPitchByPk: list.length > 1 ? Object.fromEntries(games.map((g) => [g.gamePk, g.gameDate])) : {},
    })
  // Keyed by cutoff too: the same series has more games on a later day.
  const key = series && `${series.id}:${cutoff}`
  const [seen, setSeen] = useState({})
  const read = useSeriesPrimerData(seen[key] ? null : series, cutoff)
  // React re-renders at once when a component sets its own state while rendering.
  if (key && !seen[key] && !read.loading && !read.error) setSeen((s) => ({ ...s, [key]: read }))
  const data = seen[key] ?? read
  const base = { bracket, cutoff, slateDate, isToday, favoriteTeamId }
  if (!series) return base
  return { ...base, list, series, game: games.find((g) => g.gamePk === series.cutoffGame.gamePk), setPick, data }
}
