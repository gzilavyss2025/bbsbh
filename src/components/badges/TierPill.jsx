import { TIER_LABELS } from '../../lib/statTiers.js'
import { Pill } from '../ui/control/Pill.jsx'

// A small statistical-tier badge (SD buckets over a ranked pool's mean — see
// lib/statTiers.js) — shared by plate-umpire accuracy (UmpireTierPill, a thin
// alias of this) and Game Score rankings. Renders nothing without a
// recognized tier, so it never shows a badge for an unranked/unqualified row.
// The capsule is Pill's; each tier is a tint of it (.tier__tag--*, in
// styles/09-team-info.css).
export function TierPill({ tier, className = '' }) {
  const label = TIER_LABELS[tier]
  if (!label) return null
  return <Pill className={`tier__tag tier__tag--${tier}${className ? ` ${className}` : ''}`}>{label}</Pill>
}
