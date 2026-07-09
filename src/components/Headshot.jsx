import { useState, useEffect } from 'react'
import { headshotUrl } from '../lib/teams.js'

// A player headshot, keyed by the person id we already carry. Mirrors
// TeamLogo's defensive fallback: the mlbstatic CDN serves a transparent
// silhouette PNG for an id it has no photo for, so most gaps degrade
// server-side; a true network/404 flips to a local monogram so it never shows a
// broken image. The page's <h1> names the player, so the image is aria-hidden.
// Source art is a 1:1 transparent silo cutout, cover-cropped to the .shot
// frame's 3:4 top-center (see .shot img) so the head is never clipped.
export function Headshot({ personId, name, className = '' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [personId])

  const monogram = (name ?? '').trim().charAt(0).toUpperCase() || '?'
  const url = personId && !failed ? headshotUrl(personId) : null

  if (!url) {
    return (
      <span className={`shot shot--fallback ${className}`} aria-hidden="true">
        {monogram}
      </span>
    )
  }

  return (
    <span className={`shot ${className}`}>
      <img
        key={url}
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        aria-hidden="true"
      />
    </span>
  )
}
