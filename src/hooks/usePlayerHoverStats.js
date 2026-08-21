import { useEffect, useState } from 'react'
import { loadHoverCardStats } from '../api/playerHoverCard.js'

// One in-memory cache for the life of the tab, shared by every hover card —
// the same player's name often appears more than once on a page (a lineup
// card AND a box-score row), and re-hovering him a minute later shouldn't
// re-fire three requests. A Map of personId -> the resolved view model (or
// the in-flight Promise, so two near-simultaneous hovers of the same name
// share one fetch instead of racing two). Never invalidated: a hover card
// shows season-aggregate stats, which don't need to track a live game
// tick-by-tick the way the innings viewer does.
const cache = new Map()

function load(personId) {
  if (!cache.has(personId)) {
    cache.set(
      personId,
      loadHoverCardStats(personId).catch((error) => {
        cache.delete(personId) // a transient failure shouldn't cache-poison a retry
        throw error
      }),
    )
  }
  return cache.get(personId)
}

// `active` gates the fetch itself, not just the render — a page can carry
// dozens of PlayerLinks, so this must stay idle until a card is actually
// about to show, never fire on mount for every name on the page.
export function usePlayerHoverStats(personId, active) {
  const [state, setState] = useState({ loading: false, data: null, error: null })

  useEffect(() => {
    if (!active || !personId) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => (s.data || s.error ? s : { ...s, loading: true }))
    Promise.resolve(load(personId))
      .then((data) => {
        if (!cancelled) setState({ loading: false, data, error: null })
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, data: null, error })
      })
    return () => {
      cancelled = true
    }
  }, [personId, active])

  return state
}
