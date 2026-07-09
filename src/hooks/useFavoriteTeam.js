import { useCallback, useState } from 'react'
import { PINNED_TEAM_ID } from '../lib/teams.js'

// localStorage key holding the user's chosen favorite team id. Its mere
// presence also doubles as the "has this visitor been through the welcome
// modal" flag (see GameSelect) — no separate flag to keep in sync.
const FAVORITE_TEAM_KEY = 'bbsbh:favoriteTeam'

function readStoredFavoriteTeam() {
  try {
    const raw = window.localStorage.getItem(FAVORITE_TEAM_KEY)
    if (raw == null) return null
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

// Favorite-team preference, persisted across visits. Defaults to the
// Brewers (the app's own pinned team) until the user picks one; `isFirstVisit`
// tells the caller whether that default has ever actually been confirmed, so
// the welcome modal only shows once.
export function useFavoriteTeam() {
  const [stored, setStored] = useState(readStoredFavoriteTeam)

  const setFavoriteTeam = useCallback((teamId) => {
    setStored(teamId)
    try {
      window.localStorage.setItem(FAVORITE_TEAM_KEY, String(teamId))
    } catch {
      // Private-mode / storage-disabled — degrade to in-session memory only.
    }
  }, [])

  return {
    favoriteTeamId: stored ?? PINNED_TEAM_ID,
    isFirstVisit: stored == null,
    setFavoriteTeam,
  }
}
