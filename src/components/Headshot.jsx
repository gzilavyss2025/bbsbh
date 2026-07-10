import { useState, useEffect } from 'react'
import { headshotUrl, teamTintColor } from '../lib/teams.js'

// A player headshot, keyed by the person id we already carry. Mirrors
// TeamLogo's defensive fallback: the mlbstatic CDN serves a transparent
// silhouette PNG for an id it has no photo for, so most gaps degrade
// server-side; a true network/404 flips to a local monogram so it never shows a
// broken image. The page's <h1> names the player, so the image is aria-hidden.
// Source art is a 1:1 transparent silo cutout, cover-cropped to the .shot
// frame's 3:4 top-center (see .shot img) so the head is never clipped.
//
// `teamId` (optional) fills the frame with a soft 0.22-alpha wash of that
// club's brand color — the original Former Teammates treatment, now used
// everywhere a headshot takes a teamId. A MiLB (or unknown) club has no
// color, so it degrades to the transparent frame. The tint is dropped on the
// monogram fallback, whose graphite letter needs the light inset chip for
// contrast.
export function Headshot({ personId, name, teamId = null, className = '' }) {
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

  const bg = teamTintColor(teamId)

  return (
    <span className={`shot ${className}`} style={bg ? { backgroundColor: bg } : undefined}>
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
