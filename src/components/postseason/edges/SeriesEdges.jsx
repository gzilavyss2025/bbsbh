import '../../../styles/postseason/primer-main.css'
import { loadCareerMatchups, starterMatchupsFor } from '../../../api/careerMatchups.js'
import { loadUmpire } from '../../../api/umpires.js'
import { fetchWorkloadSummary, penDotsFrom, penSummaryClubs } from '../../../api/workload.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { matchupEdges } from '../../../lib/postseason/primer/matchupEdges.js'
import { SectionHead } from '../../ui/frame/SectionHead.jsx'
import { MatchupEdges } from './MatchupEdges.jsx'
import { PenEdge } from './PenEdge.jsx'
import { UmpireEdge } from './UmpireEdge.jsx'

// TODAY'S EDGES (home page primer, ADR-0087's 2026-10-08 addendum): three small
// cards for the game on the slate: the home plate umpire, both bullpens, and the
// career matchups against the starters. Each reads a spoiler-free file that
// exists before first pitch; none reads today's feed. A card with no data
// renders nothing, and the row renders nothing when all three are empty (MiLB
// and thin feeds degrade, never crash).
//
// workload-summary.json is regular season only (src/api/CLAUDE.md), so in
// October the bullpen card may never draw.
//
//   gamePk, date   the slate game and its date (the pens' freshness test)
//   season         the season's year (the umpire file)
//   awayId, homeId the two clubs
//   plateUmpire    { id, name } from fetchPlateUmpires, or null
export function SeriesEdges({ gamePk, date, season, awayId, homeId, plateUmpire }) {
  const { data: umpire } = useAsync(
    () => (plateUmpire?.id ? loadUmpire(plateUmpire.id, { seasonYear: season }).catch(() => null) : null),
    [plateUmpire?.id, season],
  )
  const { data: summary } = useAsync(fetchWorkloadSummary, [])
  const { data: career } = useAsync(loadCareerMatchups, [])
  const penClubs = penSummaryClubs(summary, date)
  const pens = [awayId, homeId]
    .map((id) => ({ id, counts: penClubs?.[id] }))
    .filter((p) => penDotsFrom(p.counts))
  const edges = matchupEdges([awayId, homeId].map((id) => starterMatchupsFor(career, gamePk, id)))
  if (!plateUmpire?.name && !pens.length && !edges.length) return null
  return (
    <section className="seriesedges" aria-label="Today's edges">
      <SectionHead look="label">Today&apos;s edges</SectionHead>
      <div className="seriesedges__cards">
        <UmpireEdge name={plateUmpire?.name} lean={umpire?.lean ?? null} />
        <PenEdge pens={pens} />
        <MatchupEdges edges={edges} />
      </div>
    </section>
  )
}
