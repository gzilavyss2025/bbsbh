import { teamAbbr } from '../../../lib/teams.js'
import { PenDots } from '../../workload/PenDots.jsx'
import { EdgeCard } from './EdgeCard.jsx'
import { Cluster } from '../../ui/layout/Cluster.jsx'

// BULLPEN HEALTH (one of "Today's edges"): PenDots for both clubs, available
// arms first, with the counts beside them. Nightly workload sidecar only, so it
// is spoiler-free (api/workload.js). Renders nothing when no club has arms on
// file.
//
//   pens   [{ id, counts: { fresh, limited, down } }], away club first, the
//          clubs that have a count only
export function PenEdge({ pens }) {
  if (!pens?.length) return null
  return (
    <EdgeCard title="Bullpen health" className="seriesedges__pens">
      {pens.map(({ id, counts }) => (
        <Cluster key={id} align="center" className="seriesedges__pen">
          <span className="seriesedges__club">{teamAbbr({ id })}</span>
          <PenDots counts={counts} size="sm" />
          <span className="seriesedges__counts">
            {counts.fresh} · {counts.limited} · {counts.down}
          </span>
        </Cluster>
      ))}
      <span className="seriesedges__label">Available · limited · likely down</span>
    </EdgeCard>
  )
}
