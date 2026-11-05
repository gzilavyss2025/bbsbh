import { useCallback, useEffect, useRef, useState } from 'react'

const PENDING = {
  loading: true,
  error: null,
  data: null,
  // Wall-clock time of the last successful resolve — the live-game
  // staleness indicator ("as of 7:42 PM") reads this. Untouched by a
  // failed run, so a flaky refresh doesn't blank an already-shown time.
  lastUpdated: null,
  run: null,
}

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
  // `run` tags the state with the deps run it belongs to (see the return below).
  const [state, setState] = useState(PENDING)
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
          setState((s) => ({ loading: false, error: null, data, lastUpdated: Date.now(), run: s.run }))
      })
      .catch((error) => {
        // Keep the last-good data on failure (stale-while-revalidate). A
        // transient refresh failure at a live game must not wipe an
        // already-loaded feed — callers distinguish "have data + error" (show a
        // non-blocking notice) from a true cold-load failure (data still null).
        if (runId.current === id)
          setState((s) => ({ ...s, loading: false, error }))
      })
    // `deps` is a caller-supplied array forwarded straight through — inherent
    // to a generic data-fetching hook wrapping useCallback, and can never be
    // an array literal at this call site (see the file header for why).
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, deps)

  useEffect(() => {
    // Deps changed: the previous deps' data describes a different thing (a
    // different date's slate, a different game) — drop it and tag the state with
    // this `run`. (The render before this effect already answered PENDING, see the
    // return below; this commits it.) `reload`
    // (the same `run`, same deps) deliberately skips this reset, keeping the
    // stale-while-revalidate behavior for in-place refreshes.
    // Same shape as React's own "Fetching data" example —
    // the loading state is reset as this effect starts synchronizing to a new
    // `run` identity, not as a derived-from-props value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => (s.run === run ? s : { ...PENDING, run }))
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

  // The render where deps change runs before the effect above can reset, so `state`
  // still holds the previous deps' run. Answer the pending shape instead: no caller ever
  // sees the old deps' `{ loading: false, data }` under the new deps (#2925).
  const { loading, error, data, lastUpdated } = state.run === run ? state : PENDING
  return { loading, error, data, lastUpdated, reload: run }
}
