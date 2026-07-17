import { useState } from 'react'
import { TierPill } from './TierPill.jsx'
import { TIER_LABELS } from '../lib/statTiers.js'

// The lineup Umpires card's HP accuracy indicator, as a tap glyph rather
// than an upfront "Below Average" pill wrapping the name row — same
// unfold-in-place move as RadarPill's scouting glyph (see RadarPill.jsx),
// but the dot stays tier-colored at rest (unlike RadarPill's neutral ink)
// since that at-a-glance color read is the whole point in this tight card;
// tapping just adds his rank. Full depth (zone map, accuracy %, tendency,
// last five games) still lives one more tap away via onFullBreakdown, which
// opens the existing UmpireAccuracyModal — this note is deliberately just
// the tier tag + rank, not a second copy of the modal's numbers. The icon is
// a solid home-plate silhouette — a fine-lined strike-zone grid tried first,
// but thin strokes at 12px muddy on a phone; a single filled shape reads at
// any size.
function HomePlateIcon() {
  return (
    <svg viewBox="0 0 20 20" width="12" height="12" aria-hidden="true">
      <polygon points="3,4 17,4 17,11 10,17 3,11" fill="currentColor" />
    </svg>
  )
}

export function UmpireTierGlyph({ tier, rank, total, onFullBreakdown }) {
  const [open, setOpen] = useState(false)
  const label = TIER_LABELS[tier]
  if (!label) return null

  return (
    <>
      <button
        type="button"
        className={`umptier__glyph umptier__glyph--${tier}${open ? ' umptier__glyph--open' : ''}`}
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-label={`Umpire accuracy — ${label}`}
      >
        <HomePlateIcon />
      </button>
      {open && (
        <span className="umptier__note">
          <TierPill tier={tier} />
          {rank && <span className="umptier__note-stats">{rank} out of {total}</span>}
          <button type="button" className="umptier__note-link" onClick={onFullBreakdown}>
            Full breakdown →
          </button>
        </span>
      )}
    </>
  )
}
