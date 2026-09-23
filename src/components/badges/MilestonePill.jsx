import { Pill } from '../ui/control/Pill.jsx'

// A small pregame pill for a lineup row: the nearest career milestone a
// player is within single-game-plausible reach of tonight ("4 H shy of
// 2,000"). Sibling to ProspectPill — renders nothing when there's no text,
// so callers can splice it in unconditionally. `text` comes from
// milestoneTextFor (src/api/callouts.js), reading the nightly callouts
// precompute (scripts/gen-callouts.mjs). An outline Pill in the accent ink: a
// milestone chase is its own kind of note, and the ink is what says so.
export function MilestonePill({ text }) {
  if (!text) return null
  return <Pill ink="--accent-primary">{text}</Pill>
}
