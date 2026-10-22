// useWorldSeriesView(mode, slateDate) — what the World Series pieces share (#1906): the
// loaded home data, the focus game's park row, its plate umpire, and the played-game rows.
// WorldSeriesHome and the live series page both mount the pieces from it. `mode` is
// worldSeriesMode / seriesMode output, or null (every read is then skipped).
//
// Returns { series, clubIds, data, focusPk, game, umpire, parkOf, played }. Every read ends the
// day before `slateDate` (ADR-0087); the umpire is an assignment, not a result.
import { fetchPlateUmpires } from '../../api/postseason/plateUmpire.js'
import { fetchUpcomingSeriesGames } from '../../api/postseason/upcoming.js'
import { useAsync } from '../useAsync.js'
import { useWorldSeriesHome } from './useWorldSeriesHome.js'

export function useWorldSeriesView(mode, slateDate) {
  const series = mode?.series ?? null
  const clubIds = series ? series.slots.map((s) => s.club.id) : null
  const { data } = useWorldSeriesHome({ clubIds, games: series?.games, slateDate })
  const focus = series?.upcoming.find((g) => g.gameNumber === mode.gameNumber) ?? null
  const focusPk = focus?.gamePk ?? null
  const playedPks = (series?.games ?? []).map((g) => g.gamePk)
  const parkKey = [focusPk, ...playedPks].join(',')
  const parks = useAsync(() => fetchUpcomingSeriesGames([focusPk, ...playedPks]), [parkKey])
  // Tonight's plate umpire, once posted. Game day only.
  const dayType = mode?.dayType
  const umpires = useAsync(() => (dayType === 'game' ? fetchPlateUmpires(slateDate) : Promise.resolve({})), [dayType, slateDate])
  if (!series) return { series, clubIds, data, focusPk, game: null, umpire: null, parkOf: {}, played: [] }

  const parkOf = parks.data ?? {}
  const game = focusPk ? parkOf[focusPk] ?? null : null
  const abbr = Object.fromEntries(series.slots.map((s) => [s.club.id, s.club.abbreviation]))
  // Home and away come from the clubs' own schedule rows, so a failed park read
  // cannot leave the Box door with an empty matchup.
  const rowOf = Object.fromEntries(Object.values(data?.clubGames ?? {}).flat().map((r) => [r.gamePk, r]))
  const played = series.games.map((g) => ({
    gamePk: g.gamePk,
    gameNumber: g.gameNumber,
    date: g.date,
    park: parkOf[g.gamePk]?.venue?.name ?? '',
    awayAbbr: abbr[rowOf[g.gamePk]?.awayId] ?? '',
    homeAbbr: abbr[rowOf[g.gamePk]?.homeId] ?? '',
  }))
  return { series, clubIds, data, focusPk, game, umpire: focusPk ? umpires.data?.[focusPk] ?? null : null, parkOf, played }
}
