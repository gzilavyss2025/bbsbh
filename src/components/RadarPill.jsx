// A small, explicitly-attributed pill for Fever Baseball's breakout/fade
// radar (see src/api/feverRadar.js + gen-fever-radar.mjs). Deliberately NOT
// styled or worded like a bbsbh callout (MilestonePill, RookiePill) — this is
// someone else's model output, not a fact bbsbh derived and can reconcile
// against the official record, so the pill always names its source and
// stays neutral-toned like ProspectPill rather than the accent-inked
// MilestonePill. `entry` comes from radarEntryFor; renders nothing when the
// player isn't on either MLB board, so callers can splice it in
// unconditionally.
export function RadarPill({ entry }) {
  if (!entry) return null
  const label = entry.board === 'mlb_breakout' ? 'Breakout' : 'Fade'
  const movementText = entry.movement
    ? ` (${entry.movement.delta > 0 ? '+' : ''}${entry.movement.delta} since ${entry.movement.sinceDate})`
    : ''
  return (
    <span
      className="radarpill"
      title={`Fever Baseball ${label} Radar #${entry.rank}${movementText} — 95th-pct exit velo ${entry.ev95} mph`}
    >
      {label} #{entry.rank}
      <span className="radarpill__source"> · Fever</span>
    </span>
  )
}
