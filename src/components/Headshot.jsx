import { useState, useEffect, useRef } from 'react'
import {
  realHeadshotUrl,
  milbHeadshotUrl,
  coachHeadshotUrl,
  teamLogoUrl,
  teamTintColor,
} from '../lib/teams.js'

// A person's headshot, keyed by the person id we already carry. Walks a
// fallback chain, each rung using the CDN WITHOUT its `d_people:generic`
// default-image transform so a personId with no photo on file 404s (rather
// than silently rendering the CDN's own gray silhouette) and the miss can
// degrade to the next rung. The photo rungs depend on who this is:
//   • players (default): silo → milb.
//       1. silo — the 1:1 transparent studio cutout (realHeadshotUrl);
//          preferred, it's what the app's floating-cutout treatment is drawn
//          for. MLB regulars have it; a prospect with no posed MLB shot does not.
//       2. milb — the same personId's milb.com photo (milbHeadshotUrl): a real
//          face for exactly those prospects the silo variant 404s on.
//   • coaches/managers (`coach`): the `{code}/coach` variant only — a coaching
//       personId has NO silo/milb (both 404), so trying them would just be two
//       wasted requests before the real photo (coachHeadshotUrl).
// Then, shared by both:
//   3. team logo — a real photo of the club he's with beats a faceless generic
//      silhouette when we have no face at all.
//   4. monogram — when there's no teamId either.
// A true network error takes the same path. The page's <h1> names the person,
// so the image is aria-hidden. The silo art is cover-cropped to the .shot
// frame's 3:4 top-center (see .shot img) so the head is never clipped; the
// milb and coach photos (~2:3 portraits) reframe the same way, head near the top.
//
// `teamId` (optional) also fills the frame with a soft 0.22-alpha wash of
// that club's brand color — the original Former Teammates treatment, now used
// everywhere a headshot takes a teamId. A MiLB (or unknown) club has no
// color, so it degrades to the transparent frame. The tint is dropped on the
// monogram fallback, whose graphite letter needs the light inset chip for
// contrast.
export function Headshot({
  personId,
  name,
  teamId = null,
  coach = false,
  className = '',
  onFallback,
  hideFallback = false,
}) {
  // Ordered photo-source builders for this person; we advance one rung per
  // 404/error via `rung`, then fall through to logo/monogram below.
  const sources = coach ? [coachHeadshotUrl] : [realHeadshotUrl, milbHeadshotUrl]
  const [rung, setRung] = useState(0)
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => {
    setRung(0)
    setLogoFailed(false)
  }, [personId, teamId, coach])

  // A single-letter monogram fallback, not a re-uppercase of displayed text.
  const monogram = (name ?? '').trim().charAt(0).toUpperCase() || '?' // caps-js-exempt
  const builder = personId ? sources[rung] : null
  const photoUrl = builder ? builder(personId) : null
  const bg = teamTintColor(teamId)
  const logoUrl = !photoUrl && teamId && !logoFailed ? teamLogoUrl(teamId) : null

  // Optional: lets a caller react to "no real photo" — e.g. moving a detail
  // normally anchored to the photo (a position tag) into plain text instead
  // once we're down to the logo/monogram. Read via a ref so a fresh inline
  // arrow function passed every parent render doesn't retrigger the effect.
  const onFallbackRef = useRef(onFallback)
  onFallbackRef.current = onFallback
  useEffect(() => {
    onFallbackRef.current?.(photoUrl ? null : logoUrl ? 'logo' : 'monogram')
  }, [photoUrl, logoUrl])

  if (!photoUrl) {
    // The caller has its own plan for a missing photo (e.g. a clean full
    // TeamLogo instead of this boxed/clipped one) — still report via
    // onFallback above, just render nothing of our own.
    if (hideFallback) return null
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
        onError={() => setRung((r) => r + 1)}
        aria-hidden="true"
      />
    </span>
  )
}
