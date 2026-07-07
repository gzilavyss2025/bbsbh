import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal data-fetching hook: runs `fn` on mount / when `deps` change, tracks
// loading + error, and exposes a `reload` for manual refresh (used by the
// "Game hasn't started yet" refresh button in a later phase).
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve()
      .then(fn)
      .then((data) => {
        if (mounted.current) setState({ loading: false, error: null, data })
      })
      .catch((error) => {
        // Keep the last-good data on failure (stale-while-revalidate). A
        // transient refresh failure at a live game must not wipe an
        // already-loaded feed — callers distinguish "have data + error" (show a
        // non-blocking notice) from a true cold-load failure (data still null).
        if (mounted.current)
          setState((s) => ({ loading: false, error, data: s.data }))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(run, [run])

  return { ...state, reload: run }
}
