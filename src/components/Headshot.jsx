import { useState, useEffect } from 'react'
import { realHeadshotUrl, milbHeadshotUrl, teamLogoUrl, teamTintColor } from '../lib/teams.js'

// A player headshot, keyed by the person id we already carry. Walks a fallback
// chain, each rung using the CDN WITHOUT its `d_people:generic` default-image
// transform so a personId with no photo on file 404s (rather than silently
// rendering the CDN's own gray silhouette) and the miss can degrade to the
// next rung:
//   1. silo — the 1:1 transparent studio cutout (realHeadshotUrl); preferred,
//      it's what the app's floating-cutout treatment is drawn for. MLB
//      regulars have it; a prospect with no posed MLB shot yet does not.
//   2. milb — the same personId's milb.com photo (milbHeadshotUrl): a real
//      face for exactly those prospects the silo variant 404s on.
//   3. team logo — a real photo of the club he plays for beats a faceless
//      generic silhouette when we have no face at all.
//   4. monogram — when there's no teamId either.
// A true network error takes the same path. The page's <h1> names the player,
// so the image is aria-hidden. The silo art is cover-cropped to the .shot
// frame's 3:4 top-center (see .shot img) so the head is never clipped; the
// milb photo (a ~2:3 portrait) reframes the same way, head near the top.
//
// `teamId` (optional) also fills the frame with a soft 0.22-alpha wash of
// that club's brand color — the original Former Teammates treatment, now used
// everywhere a headshot takes a teamId. A MiLB (or unknown) club has no
// color, so it degrades to the transparent frame. The tint is dropped on the
// monogram fallback, whose graphite letter needs the light inset chip for
// contrast.
export function Headshot({ personId, name, teamId = null, className = '' }) {
  const [siloFailed, setSiloFailed] = useState(false)
  const [milbFailed, setMilbFailed] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => {
    setSiloFailed(false)
    setMilbFailed(false)
    setLogoFailed(false)
  }, [personId, teamId])

  const monogram = (name ?? '').trim().charAt(0).toUpperCase() || '?'
  // Walk the photo rungs in order: silo, then the milb variant once silo 404s.
  const siloUrl = personId && !siloFailed ? realHeadshotUrl(personId) : null
  const milbUrl =
    personId && siloFailed && !milbFailed ? milbHeadshotUrl(personId) : null
  const photoUrl = siloUrl || milbUrl
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
        onError={() => (siloUrl ? setSiloFailed(true) : setMilbFailed(true))}
        aria-hidden="true"
      />
    </span>
  )
}
