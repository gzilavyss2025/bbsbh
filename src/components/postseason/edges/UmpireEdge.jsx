import { LEAN_TIERS, LEAN_TIER_LABELS, leanCaretFraction } from '../../../lib/statTiers.js'
import { EdgeCard } from './EdgeCard.jsx'

// HOME PLATE UMPIRE (one of "Today's edges"): the umpire's name, and where his
// zone sits between pitcher friendly and hitter friendly. The band is the
// umpire page's five-tier lean (loadUmpire's `lean`, which umpireLeanFor feeds):
// a season aggregate of ball-strike judgments, never a run, so it is
// spoiler-free on the same footing as the lineup page's Umpires card
// (api/umpires.js). An umpire below the ranking floor has no `lean`: his name
// shows alone. Renders nothing without a name.
//
//   name   the home plate umpire's name (fetchPlateUmpires)
//   lean   loadUmpire(id).lean, or null
export function UmpireEdge({ name, lean }) {
  if (!name) return null
  return (
    <EdgeCard title="Home plate umpire" className="seriesedges__umpire">
      <p className="seriesedges__who">{name}</p>
      {lean && (
        <>
          <span className="seriesedges__label">Zone lean</span>
          <div className="seriesedges__lean" role="img" aria-label={`Zone lean: ${LEAN_TIER_LABELS[lean.tier]}`}>
            {LEAN_TIERS.map((t) => (
              <i key={t} className={t === lean.tier ? 'is-on' : undefined} />
            ))}
            <b style={{ left: `${leanCaretFraction(lean.z) * 100}%` }} />
          </div>
          <div className="seriesedges__poles">
            <span>{LEAN_TIER_LABELS.pitcher}</span>
            <span>{LEAN_TIER_LABELS.hitter}</span>
          </div>
        </>
      )}
    </EdgeCard>
  )
}
