import { useCallback, useState } from 'react'

// Whether to hold the screen-wake lock on a live game page, persisted across
// visits like useGameScoreVisible. Off by default — an always-on screen for a
// 3-hour game is a real battery cost, so this stays opt-in rather than
// automatic just because a game is live.
const KEEP_AWAKE_KEY = 'bbsbh:keepAwake'

function readStoredKeepAwake() {
  try {
    return window.localStorage.getItem(KEEP_AWAKE_KEY) === '1'
  } catch {
    return false
  }
}

export function useKeepAwakePreference() {
  const [keepAwake, setStored] = useState(readStoredKeepAwake)

  const setKeepAwake = useCallback((value) => {
    setStored(value)
    try {
      window.localStorage.setItem(KEEP_AWAKE_KEY, value ? '1' : '0')
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [])

  return { keepAwake, setKeepAwake }
}
