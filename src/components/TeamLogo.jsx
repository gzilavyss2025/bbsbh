import { useState } from 'react'
import { teamLogoUrl } from '../lib/teams.js'

// Decorative team logo, keyed by the team id we already carry throughout the
// app. The label next to it always names the team in text, so the image is
// aria-hidden and purely visual.
//
// Two things keep it from ever showing a broken-image icon:
//   • no id (or no CDN logo for a lower-level MiLB club) -> monogram fallback;
//   • a load error at runtime -> the same monogram fallback.
// This mirrors the app's rule that MiLB data is rendered defensively.
export function TeamLogo({ teamId, name, size = 26, className = '' }) {
  const [failed, setFailed] = useState(false)
  const url = teamLogoUrl(teamId)
  const monogram = (name ?? '').trim().charAt(0).toUpperCase() || '?'
  const style = { width: size, height: size }

  if (!url || failed) {
    return (
      <span
        className={`teamlogo teamlogo--fallback ${className}`}
        style={style}
        aria-hidden="true"
      >
        {monogram}
      </span>
    )
  }

  return (
    <img
      className={`teamlogo ${className}`}
      style={style}
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      aria-hidden="true"
    />
  )
}
