import { useEffect, useState } from 'react'
import { tierOf } from '../../../lib/gameday/ladder.js'

const read = () => tierOf(window.innerWidth, window.innerHeight)

// The window's Gameday tier, re-read on resize and orientation change.
export function useTier() {
  const [tier, setTier] = useState(read)
  useEffect(() => {
    const sync = () => setTier(read())
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
    }
  }, [])
  return tier
}

// Gameday's new look, at `?look=new` on the Gameday step (docs/gameday-build.md). Every Gameday
// navigation builds a path with no query string, so the choice is kept for the tab
// (sessionStorage) until `?look=old` clears it.
const LOOK_KEY = 'bbsbh:gameday-look'
export function isLookNew() {
  const look = new URLSearchParams(window.location.search).get('look')
  try {
    if (look === 'new') sessionStorage.setItem(LOOK_KEY, 'new')
    else if (look === 'old') sessionStorage.removeItem(LOOK_KEY)
    return sessionStorage.getItem(LOOK_KEY) === 'new'
  } catch {
    return look === 'new'
  }
}
