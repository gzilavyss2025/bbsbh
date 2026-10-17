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
import { fetchGameBoxscore } from '../../api/postseasonSeries.js'
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
  // One box score read per game, shared by the ledger's runs and the bullpen.
  const boxes = new Map()
  const getBox = (pk) => {
    if (!boxes.has(pk)) boxes.set(pk, fetchGameBoxscore(pk))
    return boxes.get(pk)
  }
  // A card whose read fails goes without; it never blanks the others.
  const soft = (p, fallback) => p.catch(() => fallback)
  const [clubGamesList, hotBatList, runsByGame, standings, meetings, history] = await Promise.all([
    Promise.all(clubIds.map((id) => soft(fetchClubGames(season, id, slateDate, { signal, live }), []))),
    Promise.all(clubIds.map((id) => fetchHotBatSplits(season, id, slateDate, { signal }))),
    soft(fetchSeriesRuns(games, slateDate, { live, getBox }), {}),
    soft(fetchStandingsFor(season, { signal }), {}),
    fetchMeetings(season, a, b, slateDate, { signal }),
    soft(loadSeriesHistory(), null),
  ])
  const boxList = await Promise.all(clubGamesList.map((rows) => soft(fetchClubBoxscores(rows, slateDate, { getBox }), [])))
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
    [key, slateDate, live, (games ?? []).length],
  )
  return { data, loading: Boolean(clubIds) && loading }
}
