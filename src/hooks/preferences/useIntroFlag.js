import { useCallback, useState } from 'react'
import { INTRO_KEY, hasSeenIntro, parseIntro, serializeIntro } from '../../lib/account/intro.js'

function readIntro() {
  try {
    return parseIntro(window.localStorage.getItem(INTRO_KEY))
  } catch {
    return null
  }
}

// Whether this visitor has ever finished (or dismissed) the first-visit intro
// — see src/lib/account/intro.js for why this replaced the old
// bbsbh:favoriteTeam-presence proxy. `hasClubOpinion` (usePreferences().has
// ('club'), from the caller) seeds an EXISTING visitor as already-seen on
// first read, so nobody who picked a club before this flag existed gets the
// welcome modal a second time.
export function useIntroFlag(hasClubOpinion) {
  const [state, setState] = useState(() => readIntro() ?? (hasClubOpinion ? { seen: true, step: 1, at: 0 } : null))

  const markSeen = useCallback((step) => {
    try {
      window.localStorage.setItem(INTRO_KEY, serializeIntro(step))
    } catch {
      // Private mode — the in-session flag below still stops the modal from
      // reopening for the rest of this visit.
    }
    setState({ seen: true, step: step === 2 ? 2 : 1, at: Date.now() })
  }, [])

  return [hasSeenIntro(state), markSeen]
}
