// A neutral "rookie" pill for the roster/lineup surfaces: shown while a
// player is still under MLB's rookie limit (130 career at-bats / 50 innings
// pitched). Sibling to ProspectPill/MilestonePill — renders nothing when not
// active, so callers can splice it in unconditionally. `active` comes from
// isActiveRookie (src/api/rookies.js), reading the nightly rookies precompute
// (scripts/gen-rookies.mjs).
export function RookiePill({ active }) {
  if (!active) return null
  return <span className="rookiepill">ROOKIE</span>
}
