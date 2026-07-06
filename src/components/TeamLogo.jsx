import { useEffect, useState } from 'react'
import { teamLogoUrl } from '../lib/teams.js'

// Decorative team logo, keyed by the team id we already carry throughout the
// app. The label next to it always names the team in text, so the image is
// aria-hidden and purely visual.
//
// `variant` picks which mark to draw ('base' | 'primary' | 'cap' | 'wordmark').
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
}) {
  // 'stage' tracks how far down the fallback chain we are for the current
  // (teamId, variant). Reset whenever either changes so a re-picked mark starts
  // fresh instead of inheriting a prior failure.
  const [stage, setStage] = useState('variant')
  useEffect(() => setStage('variant'), [teamId, variant])

  const monogram = (name ?? '').trim().charAt(0).toUpperCase() || '?'
  const style = { width: size, height: size }
  const bwClass = bw ? 'teamlogo--bw' : ''

  const effectiveVariant = stage === 'variant' ? variant : 'base'
  const url = stage === 'monogram' ? null : teamLogoUrl(teamId, effectiveVariant)

  const onError = () => {
    // A non-base variant that fails drops to base; anything else is unrecoverable.
    setStage((s) => (s === 'variant' && variant !== 'base' ? 'base' : 'monogram'))
  }

  if (!url) {
    return (
      <span
        className={`teamlogo teamlogo--fallback ${bwClass} ${className}`}
        style={style}
        aria-hidden="true"
      >
        {monogram}
      </span>
    )
  }

  return (
    <img
      key={url}
      className={`teamlogo ${bwClass} ${className}`}
      style={style}
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={onError}
      aria-hidden="true"
    />
  )
}
