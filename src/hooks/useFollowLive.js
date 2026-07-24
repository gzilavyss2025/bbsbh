import { useCallback, useEffect, useState } from 'react'
import { isUnlocked, nextResetAt } from '../lib/scoresUnlocked.js'

// The per-game "Follow Live" flag (src/api/liveEdge.js + ADR-0027). Stored as an
// EXPIRY epoch-ms (the next local 8am) under bbsbh:followLive:{gamePk} — the same
// expiry-not-boolean shape as the Scores Unlocked pass, parsed by the same
// fail-closed isUnlocked predicate, so a stale/garbled/overnight value can never
// silently keep auto-following. This makes the followLive consent copy's "no
// matter what, by {time}… nothing stays unsealed into tomorrow on its own"
// promise true even for a game suspended before Final (the usual clear is
// InningViewer's Final auto-clear via stopFollowing).
//
// Unlike the reveal mark (forward-only), this preference follows the latest
// write in EITHER direction across tabs. Turning it off never un-reveals — the
// mark it drove has already ratcheted forward and stays.
export const FOLLOW_LIVE_KEY = 'bbsbh:followLive:'

function readFollowing(storageKey) {
  if (!storageKey) return false
  try {
    return isUnlocked(window.localStorage.getItem(storageKey))
  } catch {
    return false
  }
}

export function useFollowLive(gamePk) {
  const storageKey = gamePk ? `${FOLLOW_LIVE_KEY}${gamePk}` : null
  const [following, setFollowing] = useState(() => readFollowing(storageKey))

  useEffect(() => {
    setFollowing(readFollowing(storageKey))
  }, [storageKey])

  const startFollowing = useCallback(() => {
    setFollowing(true)
    try {
      if (storageKey) window.localStorage.setItem(storageKey, String(nextResetAt()))
    } catch {
      // Private mode — in-session only.
    }
  }, [storageKey])

  const stopFollowing = useCallback(() => {
    setFollowing(false)
    try {
      if (storageKey) window.localStorage.removeItem(storageKey)
    } catch {
      // ignore — already treated as not following
    }
  }, [storageKey])

  // Cross-tab: pick up a start/stop made in another tab on the same game live.
  useEffect(() => {
    if (!storageKey) return undefined
    const onStorage = (e) => {
      if (e.key === storageKey || e.key === null) setFollowing(readFollowing(storageKey))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  return { following, startFollowing, stopFollowing }
}
