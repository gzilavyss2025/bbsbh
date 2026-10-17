// useWorldSeriesHome({ clubIds, games, slateDate, live }) — everything the
// World Series home page loads for one slate date (#1906, slice 3).
//
//   clubIds   the two Series clubs' ids, or null to skip every read
//   games     the bracket's worldSeries.games (counted: Final before the cutoff)
//   slateDate YYYY-MM-DD
//   live      Scores Unlocked: the slate date's own Finals count (ADR-0026)
//
// Returns { data, loading } with data null until loaded, else raw rows for the
// selectors in lib/postseason/worldseries/: { runsByGame, hotBats: {[clubId]:
// splits}, clubGames: {[clubId]: rows}, boxscores: {[clubId]: rows},
// standings, meetings, seriesHistory }. Every read ends the day before the slate
// date (api/postseason/worldSeriesHome.js). The reel loads separately, from the
// reel component.
import { useAsync } from '../useAsync.js'
import {
  fetchClubBoxscores,
  fetchClubGames,
  fetchHotBatSplits,
  fetchMeetings,
  fetchSeriesRuns,
  fetchStandingsFor,
} from '../../api/postseason/worldSeriesHome.js'
import { loadSeriesHistory } from '../../api/worldSeries/history.js'

async function load(clubIds, games, slateDate, live, signal) {
  const season = Number(slateDate.slice(0, 4))
  const [a, b] = clubIds
  const [clubGamesList, hotBatList, runsByGame, standings, meetings, history] = await Promise.all([
    Promise.all(clubIds.map((id) => fetchClubGames(season, id, slateDate, { signal, live }))),
    Promise.all(clubIds.map((id) => fetchHotBatSplits(season, id, slateDate, { signal }))),
    fetchSeriesRuns(games, slateDate, { live }),
    fetchStandingsFor(season, { signal }).catch(() => ({})),
    fetchMeetings(season, a, b, slateDate, { signal }),
    loadSeriesHistory(),
  ])
  const boxList = await Promise.all(clubGamesList.map((rows) => fetchClubBoxscores(rows, slateDate)))
  const byClub = (list) => Object.fromEntries(clubIds.map((id, i) => [id, list[i]]))
  return {
    runsByGame,
    hotBats: byClub(hotBatList),
    clubGames: byClub(clubGamesList),
    boxscores: byClub(boxList),
    standings,
    meetings,
    seriesHistory: history?.series ?? [],
  }
}

export function useWorldSeriesHome({ clubIds, games, slateDate, live = false }) {
  const key = clubIds ? clubIds.join('-') : ''
  const { data, loading } = useAsync(
    (signal) => (clubIds && slateDate ? load(clubIds, games ?? [], slateDate, live, signal) : Promise.resolve(null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for clubIds; games change only with the slate date
    [key, slateDate, live, (games ?? []).length],
  )
  return { data, loading: Boolean(clubIds) && loading }
}
