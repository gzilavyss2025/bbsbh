import { useState, useEffect } from 'react'
import { headshotUrl } from '../lib/teams.js'

// A player headshot, keyed by the person id we already carry. Mirrors
// TeamLogo's defensive fallback: the mlbstatic CDN serves a generic silhouette
// for an id it has no photo for, so most gaps degrade server-side; a true
// network/404 flips to a local monogram so it never shows a broken image. The
// page's <h1> names the player, so the image is aria-hidden. Source art is 2:3
// portrait — the .shot frame is sized to match so nothing truncates.
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
