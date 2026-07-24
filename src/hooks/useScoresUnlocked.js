import { useCallback, useEffect, useState } from 'react'
import { isUnlocked, msUntilReset, nextResetAt } from '../lib/scoresUnlocked.js'

// The site-wide "Scores Unlocked" day pass (see src/lib/scoresUnlocked.js for
// the pure math + ADR-0026). Stores an EXPIRY timestamp under
// bbsbh:scoresUnlocked; "unlocked" is only ever true while now < expiry and the
// value is in-window, so it fails sealed on anything malformed, stale, or
// overnight. This hook is the single React entry point; it never touches or
// reads a score — only the toggle state.
//
// Three things keep it honest against a backgrounded tab:
//   - a `storage` listener re-reads when another same-device tab flips it;
//   - a `visibilitychange` re-check re-evaluates on foreground, because mobile
//     Safari suspends/throttles timers and the armed timeout may never fire;
//   - the armed timeout re-seals a foregrounded tab exactly at 8am.
// Every path funnels through refresh(), which also deletes an expired key so a
// stale value can't linger.

export const SCORES_UNLOCKED_KEY = 'bbsbh:scoresUnlocked'

function readRaw() {
  try {
    return window.localStorage.getItem(SCORES_UNLOCKED_KEY)
  } catch {
    return null
  }
}

export function useScoresUnlocked() {
  const [expiry, setExpiry] = useState(readRaw)

  // Re-read storage and normalize: an expired/garbage value is cleared and
  // collapsed to null, so `unlocked` below can trust `expiry`.
  const refresh = useCallback(() => {
    let cur = readRaw()
    if (cur != null && !isUnlocked(cur)) {
      try {
        window.localStorage.removeItem(SCORES_UNLOCKED_KEY)
      } catch {
        // ignore — value is already treated as sealed
      }
      cur = null
    }
    setExpiry(cur)
  }, [])

  const enable = useCallback(() => {
    const at = String(nextResetAt())
    try {
      window.localStorage.setItem(SCORES_UNLOCKED_KEY, at)
    } catch {
      // Private mode — the in-session value below still applies this tab.
    }
    setExpiry(at)
  }, [])

  const disable = useCallback(() => {
    try {
      window.localStorage.removeItem(SCORES_UNLOCKED_KEY)
    } catch {
      // ignore
    }
    setExpiry(null)
  }, [])

  // Clean up an expired value on mount (state may have initialized to a stale one).
  useEffect(() => {
    refresh()
  }, [refresh])

  // Cross-tab: pick up another tab's enable/disable live.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === SCORES_UNLOCKED_KEY || e.key === null) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  // Foreground re-check — mandatory, since a timer armed hours ago may have been
  // suspended while the tab was backgrounded (mobile Safari).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  // Arm a timer to re-seal exactly at expiry for a tab that stays foregrounded.
  useEffect(() => {
    const ms = msUntilReset(expiry)
    if (ms == null) return undefined
    const id = setTimeout(refresh, ms + 100)
    return () => clearTimeout(id)
  }, [expiry, refresh])

  const unlocked = isUnlocked(expiry)
  return {
    unlocked,
    resetAt: unlocked ? Number(expiry) : null,
    enable,
    disable,
  }
}
