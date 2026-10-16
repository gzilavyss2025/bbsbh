import { useMemo } from 'react'
import { useAsync } from '../useAsync.js'
import { loadEventHistory } from '../../api/worldSeries/history.js'
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
