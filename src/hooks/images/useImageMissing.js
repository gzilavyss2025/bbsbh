import { useEffect, useState } from 'react'

// True once an <img> probe for `src` has fired its error event. An SVG <image>
// inside a <pattern> can't report its own 404 (a miss just paints nothing), so
// the WPA logo hooks ask with a throwaway <img>; the browser caches the result,
// so the real <image> reuses the same request. No `src` is never "missing" —
// callers treat a falsy src as their own miss.
export function useImageMissing(src) {
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
    // `live` guards the late-arriving error of a probe whose src has already
    // been swapped out — without it, a stale 404 would knock the CURRENT
    // club's good art back to base.
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

  return missing
}
