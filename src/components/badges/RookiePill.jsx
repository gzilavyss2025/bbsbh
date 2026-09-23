import { Pill } from '../ui/control/Pill.jsx'

// A neutral "rookie" pill for the roster/lineup surfaces: shown while a
// player is still under MLB's rookie limit (130 career at-bats / 50 innings
// pitched). Sibling to ProspectPill/MilestonePill — renders nothing when not
// active, so callers can splice it in unconditionally. `active` comes from
// showRookiePill (src/api/rookies.js, MLB-only — see DebutPill for the MiLB
// sibling surface), reading the nightly rookies precompute (scripts/gen-rookies.mjs).
export function RookiePill({ active }) {
  if (!active) return null
  return (
    <Pill ink="--field" title="Rookie">
      <span className="rookie__full">ROOKIE</span>
      <span className="rookie__short">R</span>
    </Pill>
  )
}
