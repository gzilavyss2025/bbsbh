import { useCallback, useEffect, useMemo, useState } from 'react'
import { fillTokens, resolveCopy, sanitizeOverrides } from './registry.js'
import { CopyContext } from './copyContext.js'

// App-wide provider for admin-editable UI copy. The contract that matters:
// copy ALWAYS resolves to something renderable. Resolution order is
// defaults <- localStorage cache <- live /api/copy fetch, each layered on top
// of the last through resolveCopy (which re-sanitizes every source). If the
// network is down, the store is unconfigured, or the cache is garbage, the app
// paints shipped defaults — the same graceful-degrade guarantee the rest of
// the account/content layer keeps. Nothing here is score-bearing, so a stale value is a
// cosmetic wording lag, never a spoiler. The consumer hook lives in
// copyContext.js.

const CACHE_KEY = 'bbsbh:copyOverrides'

function readCachedOverrides() {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    return sanitizeOverrides(JSON.parse(raw))
  } catch {
    return {}
  }
}

function writeCachedOverrides(overrides) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(overrides))
  } catch {
    // Private mode / storage disabled — the in-memory value still applies this
    // session; next load just re-fetches from the API.
  }
}

export function CopyProvider({ children }) {
  // Instant paint from cache (or defaults), then revalidate against the API.
  const [overrides, setOverrides] = useState(readCachedOverrides)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/copy')
        if (!res.ok || cancelled) return
        const data = await res.json()
        const clean = sanitizeOverrides(data?.copy)
        if (cancelled) return
        setOverrides(clean)
        writeCachedOverrides(clean)
      } catch {
        // Offline / API unreachable / no copy store on this deploy — the cached
        // (or default) copy already in state stands. This is expected on any
        // deploy that hasn't configured the store, and is not an error.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Adopt a map the app itself just wrote — the admin saving an edit from the
  // card, whose POST response IS the new authoritative override map. Without
  // this the owner would save, see nothing change, and be looking at their own
  // stale copy for up to a minute while the CDN cache aged out (`s-maxage=60`
  // on the public GET). The write path already has the answer; this hands it
  // straight back to the running app.
  //
  // Re-sanitized like every other source, even though it came from our own API:
  // the contract of this state is "only ever a clean override map", and a
  // caller that is trusted today is a caller that gets a second implementation
  // tomorrow. It costs one pass over a small object.
  const applyOverrides = useCallback((next) => {
    const clean = sanitizeOverrides(next)
    setOverrides(clean)
    writeCachedOverrides(clean)
  }, [])

  const value = useMemo(() => {
    const resolved = resolveCopy(overrides)
    const t = (id, tokens) =>
      Object.prototype.hasOwnProperty.call(resolved, id) ? fillTokens(resolved[id], tokens) : ''
    return { t, resolved, applyOverrides }
  }, [overrides, applyOverrides])

  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>
}
