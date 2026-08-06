import { useCallback } from 'react'
import { usePreferences } from './usePreferences.js'

// Whether to hold the screen-wake lock on a live game page — one field of the
// My Tally preference document. Off by default: an always-on screen for a
// three-hour game is a real battery cost, so this stays opt-in rather than
// automatic just because a game is live.
//
// Formerly its own `bbsbh:keepAwake` key, now migrated into `bbsbh:prefs` so it
// travels with the rest of a signed-in user's settings. Call-site shape
// unchanged.
export function useKeepAwakePreference() {
  const { keepAwake, set } = usePreferences()

  const setKeepAwake = useCallback((value) => set('keepAwake', Boolean(value)), [set])

  return { keepAwake, setKeepAwake }
}
