import { useState, useEffect } from 'react'
import { realHeadshotUrl, teamLogoUrl, teamTintColor } from '../lib/teams.js'

// A player headshot, keyed by the person id we already carry. Uses
// realHeadshotUrl (not the CDN's default-silo variant), so a personId with no
// real photo on file 404s rather than silently rendering the CDN's own gray
// silhouette placeholder — that miss then degrades to `teamId`'s team logo
// (a real photo of the club he plays for beats a faceless generic silhouette),
// and only falls back further to a monogram when there's no teamId either. A
// true network error takes the same path. The page's <h1> names the player,
// so the image is aria-hidden. Source art is a 1:1 transparent silo cutout,
// cover-cropped to the .shot frame's 3:4 top-center (see .shot img) so the
// head is never clipped.
//
// `teamId` (optional) also fills the frame with a soft 0.22-alpha wash of
// that club's brand color — the original Former Teammates treatment, now used
// everywhere a headshot takes a teamId. A MiLB (or unknown) club has no
// color, so it degrades to the transparent frame. The tint is dropped on the
// monogram fallback, whose graphite letter needs the light inset chip for
// contrast.
export function Headshot({ personId, name, teamId = null, className = '' }) {
  const [photoFailed, setPhotoFailed] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => {
    setPhotoFailed(false)
    setLogoFailed(false)
  }, [personId, teamId])

  const monogram = (name ?? '').trim().charAt(0).toUpperCase() || '?'
  const photoUrl = personId && !photoFailed ? realHeadshotUrl(personId) : null
  const bg = teamTintColor(teamId)

  if (!photoUrl) {
    const logoUrl = teamId && !logoFailed ? teamLogoUrl(teamId) : null
    if (logoUrl) {
      return (
        <span
          className={`shot shot--logo ${className}`}
          style={bg ? { backgroundColor: bg } : undefined}
          aria-hidden="true"
        >
          <img
            key={logoUrl}
            src={logoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setLogoFailed(true)}
            aria-hidden="true"
          />
        </span>
      )
    }
    return (
      <span className={`shot shot--fallback ${className}`} aria-hidden="true">
        {monogram}
      </span>
    )
  }

  return (
    <span className={`shot ${className}`} style={bg ? { backgroundColor: bg } : undefined}>
      <img
        key={photoUrl}
        src={photoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setPhotoFailed(true)}
        aria-hidden="true"
      />
    </span>
  )
}
