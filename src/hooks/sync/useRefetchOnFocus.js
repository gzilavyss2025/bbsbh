import { useEffect } from 'react'

// Call `pull` whenever this device comes back to the foreground. A phone and a
// laptop are both open; the phone changes something. Without this, the laptop
// shows the old state until someone reloads it. The foreground is exactly when
// a user looks at it. Used by the sync components that re-pull (StampsCloudSync,
// PreferencesCloudSync).
export function useRefetchOnFocus(enabled, pull) {
  useEffect(() => {
    if (!enabled) return undefined
    const onFocus = () => {
      if (document.visibilityState === 'hidden') return
      pull()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [enabled, pull])
}
