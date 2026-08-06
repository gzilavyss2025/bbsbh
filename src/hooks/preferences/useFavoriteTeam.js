import { useCallback } from 'react'
import { usePreferences } from './usePreferences.js'

// The user's chosen club, as one field of the My Tally preference document
// (src/lib/account/preferences.js). This used to own its own localStorage key,
// `bbsbh:favoriteTeam`; that key is now read once as a migration seed and the
// value lives in `bbsbh:prefs`, which is what lets it travel between a signed-in
// user's devices. Every call site keeps the same three-value shape it always
// had, so nothing above this line had to learn about the document.
//
// `isFirstVisit` still means "has this visitor ever answered?" — which is now
// asked of the document (an absent field is an unanswered question) rather than
// of a key's mere presence. Same answer for an existing visitor, whose legacy
// key seeds the field on first read.
export function useFavoriteTeam() {
  const { club, has, set } = usePreferences()

  const setFavoriteTeam = useCallback((teamId) => set('club', teamId), [set])

  return {
    favoriteTeamId: club,
    isFirstVisit: !has('club'),
    setFavoriteTeam,
  }
}
