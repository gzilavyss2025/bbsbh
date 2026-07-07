import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal data-fetching hook: runs `fn` on mount / when `deps` change, tracks
// loading + error, and exposes a `reload` for manual refresh (the live-game
// Refresh button, error retries).
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  // Out-of-order guard: each run claims a fresh token, and only the holder of
  // the CURRENT token may commit state. Without it, a slow request left in
  // flight across a deps change (paging the slate date, back/forward between
  // deep links) could resolve after its replacement and clobber the newer data
  // — or paint a stale error over a perfectly fresh result. Bumping the token
  // in the effect cleanup also covers unmount, so no separate mounted ref.
  const runId = useRef(0)

  const run = useCallback(() => {
    const id = ++runId.current
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve()
      .then(fn)
      .then((data) => {
        if (runId.current === id) setState({ loading: false, error: null, data })
      })
      .catch((error) => {
        // Keep the last-good data on failure (stale-while-revalidate). A
        // transient refresh failure at a live game must not wipe an
        // already-loaded feed — callers distinguish "have data + error" (show a
        // non-blocking notice) from a true cold-load failure (data still null).
        if (runId.current === id)
          setState((s) => ({ loading: false, error, data: s.data }))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    // Deps changed: the previous deps' data describes a different thing (a
    // different date's slate, a different game) — drop it so it can't render
    // under the new deps' header while the new request is in flight. `reload`
    // (the same `run`, same deps) deliberately skips this reset, keeping the
    // stale-while-revalidate behavior for in-place refreshes.
    setState((s) => (s.data === null && s.error === null ? s : { loading: true, error: null, data: null }))
    run()
    return () => {
      // Deliberately the LIVE counter, not a snapshot — bumping it is what
      // invalidates the in-flight request (a counter ref, not a DOM node, so
      // the exhaustive-deps stale-ref warning doesn't apply).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runId.current++
    }
  }, [run])

  return { ...state, reload: run }
}
