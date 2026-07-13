import { TIER_LABELS } from '../lib/statTiers.js'

// A small statistical-tier badge (SD buckets over a ranked pool's mean — see
// lib/statTiers.js) — shared by plate-umpire accuracy (UmpireTierPill, a thin
// alias of this) and Game Score rankings. Renders nothing without a
// recognized tier, so it never shows a badge for an unranked/unqualified row.
export function TierPill({ tier, className = '' }) {
  const label = TIER_LABELS[tier]
  if (!label) return null
  return <span className={`tierpill tierpill--${tier} ${className}`}>{label}</span>
}
