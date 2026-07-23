import { useEffect, useState } from 'react'
import { teamLogoUrl } from '../lib/teams.js'

// Decorative team logo, keyed by the team id we already carry throughout the
// app. The label next to it always names the team in text, so the image is
// aria-hidden and purely visual.
//
// `variant` picks which mark to draw ('base' | 'primary' | 'cap' | 'wordmark' |
// 'alternate' | 'city-connect'). The last two resolve to a locally curated
// asset (teamLogoUrl -> localLogoUrl, teams.js) rather than the mlbstatic CDN,
// and coverage is partial by design — that's what the fallback below is for.
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
  crop = false,
}) {
  // 'stage' tracks how far down the fallback chain we are for the current
  // (teamId, variant). Reset whenever either changes so a re-picked mark starts
  // fresh instead of inheriting a prior failure.
  const [stage, setStage] = useState('variant')
  useEffect(() => setStage('variant'), [teamId, variant])

  // A single-letter monogram fallback, not a re-uppercase of displayed text.
  const monogram = (name ?? '').trim().charAt(0).toUpperCase() || '?' // caps-js-exempt
  const bwClass = bw ? 'teamlogo--bw' : ''

  const effectiveVariant = stage === 'variant' ? variant : 'base'
  const url = stage === 'monogram' ? null : teamLogoUrl(teamId, effectiveVariant)

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
    // A non-base variant that fails drops to base; anything else is unrecoverable.
    setStage((s) => (s === 'variant' && variant !== 'base' ? 'base' : 'monogram'))
  }

  if (!url) {
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
      className={`teamlogo ${crop ? 'teamlogo--crop' : ''} ${bwClass} ${crop ? '' : className}`}
      style={crop ? undefined : style}
      src={url}
      alt=""
      width={isWordmark ? size * WORDMARK_ASPECT : size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={onError}
      aria-hidden="true"
    />
  )

  // `crop` is a small "vibe" treatment (the affiliate-level chip on a
  // prospect table row, not meant for precise club identification): most
  // team-logo SVGs carry internal padding within their viewBox, so a plain
  // object-fit: contain leaves visible whitespace at this size. Wrapping in
  // a clipped square box and zooming the image past its own padding fills
  // the box edge-to-edge instead.
  if (crop) {
    return (
      <span
        className={`teamlogo-crop ${className}`}
        style={{ width: size, height: size }}
      >
        {img}
      </span>
    )
  }

  return img
}
