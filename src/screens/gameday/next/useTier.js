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

