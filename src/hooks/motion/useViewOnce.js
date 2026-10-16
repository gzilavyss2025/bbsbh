import { useEffect, useState } from 'react'
import { hasSeen, markSeen, viewKey } from '../../lib/motion/inViewOnce.js'

// The motion gate for a team-page band: true when the band's entrance already played in this
// page visit (so it renders still). The answer is read once, on mount. The band is marked seen
// when `ready` turns true (its data arrived), so a re-render, a poll or Back never replays it.
export function useViewOnce(teamId, band, ready = true) {
  const key = viewKey(teamId, band)
  const [still] = useState(() => hasSeen(key))
  useEffect(() => {
    if (ready) markSeen(key)
  }, [ready, key])
  return still
}
