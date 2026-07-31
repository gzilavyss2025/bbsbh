import { useEffect, useState } from 'react'
import { milbWpaMarkUrl } from '../lib/milbColors.js'
import { teamLogoUrl } from '../lib/teams.js'

// The MiLB counterpart to useWpaLogo.js — same probe-and-fallback shape (an
// SVG <image> inside a <pattern> can't report its own 404, so a miss would
// otherwise paint a band with no marks on it at all, silently), reading
// milbColors.js's own Home/Away resolution chain instead of the MLB-keyed
// one. A miss — most likely a wordmark the CDN doesn't actually carry for
// this affiliate — falls back to the plain base mark, which every club has.
export function useMilbWpaLogo(teamId, variant, draft) {
  const src = milbWpaMarkUrl(teamId, variant, draft)
  const [missing, setMissing] = useState(false)
  // Reset computed during render (not as the first line of the effect below)
  // on a src change — see Headshot.jsx for the pattern.
  const [prevSrc, setPrevSrc] = useState(src)
  if (src !== prevSrc) {
    setPrevSrc(src)
    setMissing(false)
  }

  useEffect(() => {
    if (!src) return undefined
    // `live` guards the late-arriving error of a probe whose (team, variant)
    // has already been swapped out from under it.
    let live = true
    const probe = new Image()
    probe.onerror = () => {
      if (live) setMissing(true)
    }
    probe.src = src
    return () => {
      live = false
    }
  }, [src])

  return { src: missing ? teamLogoUrl(teamId, 'base') : src, recolor: null }
}
