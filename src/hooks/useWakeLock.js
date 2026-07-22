import { useEffect, useRef } from 'react'

// Holds the Screen Wake Lock (https://w3c.github.io/screen-wake-lock/) for as
// long as `active` is true — keeps the phone's screen from sleeping between
// batters during a live game, propping it up like a real scorebook. Purely a
// display-power effect, never touches any game data, so it carries none of
// the spoiler concerns the rest of this app is built around.
//
// Two browser realities this works around:
// - The lock is released automatically whenever the tab/PWA backgrounds (the
//   OS reclaims it), so it has to be re-requested on the next
//   `visibilitychange` back to visible, not just once on mount.
// - Support is real but not universal (and was long broken specifically
//   inside iOS home-screen PWAs, fixed in iOS 18.4 / March 2025) — feature-
//   detect and no-op silently rather than surfacing an error, same
//   degrade-gracefully convention as the rest of the app's optional data.
export function useWakeLock(active) {
  const sentinelRef = useRef(null)

  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined

    let cancelled = false
    const request = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          sentinel.release().catch(() => {})
          return
        }
        sentinelRef.current = sentinel
      } catch {
        // Denied (e.g. low battery mode) or the page isn't visible yet —
        // nothing to recover from here; the visibilitychange listener below
        // will retry the next time the tab becomes visible.
      }
    }

    request()
    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinelRef.current?.release().catch(() => {})
      sentinelRef.current = null
    }
  }, [active])
}
