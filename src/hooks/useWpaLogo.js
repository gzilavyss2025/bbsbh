import { useEffect, useState } from 'react'
import { wpaLogoFor, wpaLogoWithFallback } from '../lib/wpaLogo.js'

// The mark a WPA band should tile for this (team, treatment), with the club's
// Main mark standing in when the treatment's own art isn't on file.
//
// Why a hook rather than a pure lookup: procured treatment art (Alternate,
// City Connect, …) is added club by club, and lib/wpaLogo.js deliberately has
// no manifest of which files exist — coverage grows by dropping a PNG into
// public/team-logos/, same convention TeamLogo.jsx follows. So "does this art
// exist" can only be answered by asking for it. An <img> probe does that: its
// error event is the signal, and because the browser caches the result the
// real <image> in the pattern reuses the same request rather than fetching
// twice.
//
// Unlike an <img>, an SVG <image> inside a <pattern> can't report its own
// failure — a 404'd href just paints nothing, leaving a band with no marks on
// it at all. Hence the probe.
export function useWpaLogo(teamId, treatment) {
  const { src } = wpaLogoFor(teamId, treatment)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setMissing(false)
    if (!src) return undefined
    // `live` guards the late-arriving error of a probe whose (team,
    // treatment) has already been swapped out from under it — without it, a
    // stale 404 would knock the CURRENT team's good art back to base.
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

  // No URL to try at all (an unmapped club has no abbreviation, so there's no
  // procured path to build) is the same miss as a 404 — go to base either way.
  return wpaLogoWithFallback(teamId, treatment, missing || !src)
}
