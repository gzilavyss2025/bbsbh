import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal data-fetching hook: runs `fn` on mount / when `deps` change, tracks
// loading + error, and exposes a `reload` for manual refresh (the live-game
// Refresh button, error retries).
//
// `refetchOnForeground` additionally reruns `fn` when the tab/PWA becomes
// visible again. Installed-to-home-screen Safari has no browser chrome, so
// there's no pull-to-refresh and no reload button to fall back on — without
// this, a score-critical fetch left running in the background would just sit
// stale until the user finds the in-app Refresh button. Off by default: most
// callers (managers, weather, season lines, …) are deliberately excluded from
// re-fetching on a live-game Refresh already, and this would undo that.
export function useAsync(fn, deps = [], { refetchOnForeground = false } = {}) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
    // Wall-clock time of the last successful resolve — the live-game
    // staleness indicator ("as of 7:42 PM") reads this. Untouched by a
    // failed run, so a flaky refresh doesn't blank an already-shown time.
    lastUpdated: null,
  })
  // Out-of-order guard: each run claims a fresh token, and only the holder of
  // the CURRENT token may commit state. Without it, a slow request left in
  // flight across a deps change (paging the slate date, back/forward between
  // deep links) could resolve after its replacement and clobber the newer data
  // — or paint a stale error over a perfectly fresh result. Bumping the token
  // in the effect cleanup also covers unmount, so no separate mounted ref.
  const runId = useRef(0)
  const abortController = useRef(null)

  const run = useCallback(() => {
    const id = ++runId.current
    abortController.current?.abort()
    const controller = new AbortController()
    abortController.current = controller
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve()
      .then(() => fn(controller.signal))
      .then((data) => {
        if (runId.current === id)
          setState({ loading: false, error: null, data, lastUpdated: Date.now() })
      })
      .catch((error) => {
        // Keep the last-good data on failure (stale-while-revalidate). A
        // transient refresh failure at a live game must not wipe an
        // already-loaded feed — callers distinguish "have data + error" (show a
        // non-blocking notice) from a true cold-load failure (data still null).
        if (runId.current === id)
          setState((s) => ({ loading: false, error, data: s.data, lastUpdated: s.lastUpdated }))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    // Deps changed: the previous deps' data describes a different thing (a
    // different date's slate, a different game) — drop it so it can't render
    // under the new deps' header while the new request is in flight. `reload`
    // (the same `run`, same deps) deliberately skips this reset, keeping the
    // stale-while-revalidate behavior for in-place refreshes.
    setState((s) =>
      s.data === null && s.error === null
        ? s
        : { loading: true, error: null, data: null, lastUpdated: null },
    )
    run()
    return () => {
      // Deliberately the LIVE counter, not a snapshot — bumping it is what
      // invalidates the in-flight request (a counter ref, not a DOM node, so
      // the exhaustive-deps stale-ref warning doesn't apply).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runId.current++
      abortController.current?.abort()
      abortController.current = null
    }
  }, [run])

  useEffect(() => {
    if (!refetchOnForeground) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refetchOnForeground, run])

  return { ...state, reload: run }
}
