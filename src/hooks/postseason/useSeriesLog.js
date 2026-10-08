import { loadSeriesStats } from '../../api/postseasonSeries.js'
import { fetchGameCardsByPk } from '../../api/schedule.js'
import { useAsync } from '../useAsync.js'
import { usePastGameSignals } from '../usePastGameSignals.js'

// Sweeps only the ALREADY-COUNTED games (before the cutoff) for their box
// scores, cards and win-probability signals — the same footing as
// PostseasonSeriesPage.jsx's loadSeries, minus the postseason-history.json
// read this page skips: `games` comes straight off the bracket Series. Never
// called with the cutoff game or an upcoming one — loadSeriesStats fetches a
// `/boxscore` per game, which for a still-live game would resolve its score.
async function loadGameLog(games, getSignals) {
  const [stats, cardsByPk, signalsEntries] = await Promise.all([
    loadSeriesStats(games),
    fetchGameCardsByPk(games.map((g) => g.gamePk)),
    Promise.all(
      games.map((g) =>
        getSignals(g.gamePk)
          .then((signals) => [g.gamePk, signals])
          .catch(() => [g.gamePk, null]),
      ),
    ),
  ])
  return { stats, cardsByPk, gameSignals: Object.fromEntries(signalsEntries) }
}

export const EMPTY_LOG = { stats: null, cardsByPk: {}, gameSignals: {} }

// useAsync over the counted games' log: { loading, error, data }. No games, no
// reads, so a caller can hold the list back (the primer waits for its shard).
export function useSeriesLog(games) {
  const getSignals = usePastGameSignals()
  const gamePks = games.map((g) => g.gamePk).join(',')
  return useAsync(
    () => (games.length ? loadGameLog(games, getSignals) : Promise.resolve(EMPTY_LOG)),
    [gamePks],
  )
}
