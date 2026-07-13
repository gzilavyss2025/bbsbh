import { useCallback, useState } from 'react'

// Whether to show the Game Score badge ("FINAL · 7.5") on slate cards,
// persisted across visits like useFavoriteTeam. A taste preference, not a
// spoiler control (see ADR-0015) — off by default, since some readers would
// rather not see even a fuzzy quality signal on some days.
const GAME_SCORE_VISIBLE_KEY = 'bbsbh:gameScoreVisible'

function readStoredVisible() {
  try {
    return window.localStorage.getItem(GAME_SCORE_VISIBLE_KEY) === '1'
  } catch {
    return false
  }
}

export function useGameScoreVisible() {
  const [gameScoreVisible, setStored] = useState(readStoredVisible)

  const setGameScoreVisible = useCallback((visible) => {
    setStored(visible)
    try {
      window.localStorage.setItem(GAME_SCORE_VISIBLE_KEY, visible ? '1' : '0')
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [])

  return { gameScoreVisible, setGameScoreVisible }
}
