import { useMemo } from 'react'
import { useAsync } from '../useAsync.js'
import { loadEventHistory, loadSeriesHistory } from '../../api/worldSeries/history.js'
import { fetchWorldSeriesStartsBefore } from '../../api/postseason/pitcherWorldSeries.js'
import { wsPlayCtx } from '../../api/callout-notes/worldSeries/events.js'

// events.json for a World Series game; null for any other game (no request) and until it loads.
export function useEventHistory(feed) {
  const isWs = feed?.gameData?.game?.type === 'W'
  return useAsync(() => (isWs ? loadEventHistory() : null), [isWs]).data ?? null
}

// The play card's "last time" ctx (buildWsLastTimeNotes); null outside the World Series.
export function useWsPlayCtx(feed, bundle) {
  const history = useEventHistory(feed)
  return useMemo(() => (bundle ? wsPlayCtx(feed, bundle, history) : null), [feed, bundle, history])
}

// One request per starter and date, however many surfaces ask (the strip and Between Innings both do).
const startsOnce = new Map()
const startsBefore = (id, date) => {
  const key = `${id}|${date}`
  if (!startsOnce.has(key)) startsOnce.set(key, fetchWorldSeriesStartsBefore(id, date))
  return startsOnce.get(key)
}

// The pre-half strip's and Between Innings' World Series inputs: series.json, and each probable's
// earlier World Series starts cut at the game's own date. Both null outside the World Series (no
// request) and until they load.
export function useWsCalloutInputs(feed) {
  const isWs = feed?.gameData?.game?.type === 'W'
  const seriesHistory = useAsync(() => (isWs ? loadSeriesHistory() : null), [isWs]).data ?? null
  const probables = feed?.gameData?.probablePitchers
  const wsDate = isWs ? feed?.gameData?.datetime?.officialDate : null
  const wsStarts = useAsync(async () => {
    if (!wsDate) return null
    const ids = [probables?.away?.id, probables?.home?.id].filter(Boolean)
    const counts = await Promise.all(ids.map((id) => startsBefore(id, wsDate)))
    return Object.fromEntries(ids.map((id, i) => [id, counts[i]]))
  }, [wsDate, probables?.away?.id, probables?.home?.id]).data ?? null
  return { seriesHistory, wsStarts }
}
