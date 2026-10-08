import { fetchCallouts } from '../../api/callouts.js'
import { apiDateToUrl } from '../../lib/route.js'
import { planShard, primerData, seriesBlockFor } from '../../lib/postseason/primer/primerGames.js'
import { useAsync } from '../useAsync.js'
import { useSeriesLog } from './useSeriesLog.js'

// The series primer's finished games and series stats for ONE series heading
// into `cutoff` (ADR-0087, 2026-10-08 addendum): the nightly shard block on
// today's game first, the live read for what it lacks (primerGames.js has the
// rules). -> { games, stats, source: 'shard' | 'live' | 'mixed', loading, error }.
//
// `series` is a bracket Series read WITHOUT { live: true }, so `series.games` is
// only what went Final before the cutoff. The shard is read for today's game,
// never for a counted one; no SealBox, no Scores Unlocked read.
export function useSeriesPrimerData(series, cutoff) {
  const counted = series?.games ?? []
  const todayPk = series?.cutoffGame?.gamePk ?? null
  const seriesId = series?.id ?? null
  // The answer carries the key it was read for. A deps change leaves the old
  // answer in place for one render, and that one must not count as ready.
  const key = `${seriesId}:${todayPk}`
  const { loading, data: shard } = useAsync(
    () =>
      todayPk
        ? fetchCallouts(apiDateToUrl(cutoff), [todayPk]).then(({ games }) => ({ key, block: seriesBlockFor(games[todayPk], seriesId) }))
        : Promise.resolve({ key, block: null }),
    [todayPk, cutoff, seriesId],
  )
  const shardLoading = loading || shard?.key !== key
  const block = shardLoading ? null : shard.block
  const { needLive } = planShard(block, counted)
  // Held back until the shard answers, so a good shard costs no live read.
  const { loading: logLoading, error: logError, data: log } = useSeriesLog(shardLoading || !needLive ? [] : counted)
  // `log?.stats` is null for the empty log a deps change leaves behind for one render.
  const logPending = needLive && !logError && (logLoading || !log?.stats)
  return { ...primerData(block, counted, log), loading: shardLoading || logPending, error: logError }
}
