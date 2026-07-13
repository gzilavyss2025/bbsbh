import { UMPIRE_TIER_LABELS } from '../api/umpires.js'

// A small statistical-tier badge for a plate umpire's season accuracy — see
// api/umpires.js's accuracyIndex() for how `tier` is computed (SD buckets
// over the qualifying pool, not equal thirds). Renders nothing without a
// tier (below the ranking floor), so it never shows an unqualified badge.
export function UmpireTierPill({ tier, className = '' }) {
  const label = UMPIRE_TIER_LABELS[tier]
  if (!label) return null
  return <span className={`tierpill tierpill--${tier} ${className}`}>{label}</span>
}
