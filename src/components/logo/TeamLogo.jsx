import { useState } from 'react'
import { teamLogoUrl } from '../../lib/teams.js'

// Decorative team logo, keyed by the team id we already carry throughout the
// app. The label next to it always names the team in text, so the image is
// aria-hidden and purely visual.
//
// `variant` picks which mark to draw ('base' | 'primary' | 'cap' | 'wordmark' |
// 'alternate' | 'city-connect' | 'mono'). The last three resolve to a LOCAL
// asset (teamLogoUrl, teams.js) rather than the mlbstatic CDN — the curated
// jersey-treatment art, and the precomputed one-color knockout mark the navy
// section mastheads wear (ADR-0031) — and coverage of all three is partial by
// design, which is what the fallback below is for: a club with no knockout art
// yet wears its full-color mark on the bar rather than nothing.
// Fallback degrades in two steps, consistent with the app's "MiLB data is
// rendered defensively" rule:
//   • a variant that fails to load -> retry the plain base logo;
//   • no id, no base logo, or the base also failing -> monogram.
// So it never shows a broken-image icon, and asking for a mark a club happens to
// lack quietly falls back rather than erroring.
export function TeamLogo({
  teamId,
  name,
  size = 26,
  bw = false,
  variant = 'base',
  className = '',
  // `crop={true}` is the square "vibe" treatment below. `crop="bar"` is the
  // SectionMasthead treatment: the mark stretches to the full height of its
  // `.metricbar`, cancelling that bar's own vertical padding to bleed edge to
  // edge, with 7% clipped off its own top and bottom (see the CSS partial) —
  // `size` is unused in this mode since the bar's height, not a pixel prop,
  // drives it.
  crop = false,
  // Above-the-fold marks (the slate's first cards) opt out of lazy loading —
  // for them `loading="lazy"` defers the largest visible images past the
  // initial layout pass, delaying the page's LCP for no bandwidth saved.
  eager = false,
  // A caller's own art to try FIRST, ahead of `variant` entirely — the City
  // Connect masthead override (teams.js's cityConnectMastheadUrl) is the one
  // caller today. Absent for every other caller, which is what keeps this
  // whole prop invisible to them. Still just the first rung of the same
  // fallback chain below: if it 404s, `onError` drops straight to the normal
  // `variant` resolution exactly as a failed non-base variant drops to
  // 'base' — so a club whose override file goes missing quietly gets its
  // ordinary mark back instead of a broken image.
  overrideUrl = null,
}) {
  const cropSquare = crop === true
  const cropBar = crop === 'bar'
  // 'stage' tracks how far down the fallback chain we are for the current
  // (teamId, variant, overrideUrl). Reset whenever any of them change so a
  // re-picked mark — or a freshly re-uploaded override — starts fresh
  // instead of inheriting a prior failure.
  const [stage, setStage] = useState(overrideUrl ? 'override' : 'variant')
  // Reset computed during render (React's "adjust state while rendering"
  // pattern) rather than in an effect — see Headshot.jsx for the same shape.
  const identityKey = `${teamId}|${variant}|${overrideUrl ?? ''}`
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey)
  if (identityKey !== prevIdentityKey) {
    setPrevIdentityKey(identityKey)
    setStage(overrideUrl ? 'override' : 'variant')
  }

  // A single-letter monogram fallback, not a re-uppercase of displayed text.
  const monogram = (name ?? '').trim().charAt(0).toUpperCase() || '?' // caps-js-exempt
  const bwClass = bw ? 'teamlogo--bw' : ''

  const effectiveVariant = stage === 'variant' ? variant : 'base'
  const url =
    stage === 'override'
      ? overrideUrl
      : stage === 'monogram'
        ? null
        : teamLogoUrl(teamId, effectiveVariant)

  // A wordmark's own SVG is wide-and-short (verified live across the league:
  // ratios from ~1.75:1 up to ~7:1 width:height, never square), unlike every
  // other variant here, which is drawn to a square viewBox. Forcing it into
  // the same fixed square box the other variants use pads it top and bottom.
  // So a wordmark gets its own wide box — `size` is still the height, but the
  // width is sized to a generous fixed aspect ratio rather than a square, so
  // `object-fit: contain` (below, in CSS) crops that padding away for every
  // team at or under that ratio and only letterboxes the handful of outlier
  // clubs whose wordmark runs wider still — a fixed box (vs. sizing width to
  // each SVG's own intrinsic ratio) keeps this predictable and never lets an
  // outlier's width overflow the layout around it.
  const isWordmark = variant === 'wordmark'
  const WORDMARK_ASPECT = 3.5
  const style = isWordmark
    ? { height: size, width: size * WORDMARK_ASPECT }
    : { width: size, height: size }

  const onError = () => {
    // A failed override drops to the normal variant chain, which then gets
    // its own shot at 'base' before giving up — a non-base variant that
    // fails drops to base; anything else is unrecoverable.
    setStage((s) => {
      if (s === 'override') return 'variant'
      if (s === 'variant' && variant !== 'base') return 'base'
      return 'monogram'
    })
  }

  if (!url) {
    if (cropBar) {
      return (
        <span
          className={`teamlogo-crop-bar teamlogo--fallback ${bwClass} ${className}`}
          aria-hidden="true"
        >
          {monogram}
        </span>
      )
    }
    return (
      <span
        className={`teamlogo teamlogo--fallback ${bwClass} ${className}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {monogram}
      </span>
    )
  }

  const img = (
    <img
      key={url}
      className={`teamlogo ${cropSquare ? 'teamlogo--crop' : ''} ${cropBar ? 'teamlogo--crop-bar' : ''} ${bwClass} ${crop ? '' : className}`}
      style={crop ? undefined : style}
      src={url}
      alt=""
      width={isWordmark ? size * WORDMARK_ASPECT : size}
      height={size}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      decoding="async"
      onError={onError}
      aria-hidden="true"
    />
  )

  // `crop={true}` is a small "vibe" treatment (the affiliate-level chip on a
  // prospect table row, not meant for precise club identification): most
  // team-logo SVGs carry internal padding within their viewBox, so a plain
  // object-fit: contain leaves visible whitespace at this size. Wrapping in
  // a clipped square box and zooming the image past its own padding fills
  // the box edge-to-edge instead.
  if (cropSquare) {
    return (
      <span
        className={`teamlogo-crop ${className}`}
        style={{ width: size, height: size }}
      >
        {img}
      </span>
    )
  }

  // `crop="bar"` — the wrapper's own height comes from the CSS bleed (it
  // stretches to fill and overshoot `.metricbar`'s padding, see the partial),
  // never from `size`, so no inline style here.
  if (cropBar) {
    return <span className={`teamlogo-crop-bar ${className}`}>{img}</span>
  }

  return img
}
