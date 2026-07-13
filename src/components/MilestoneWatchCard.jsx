import { useAsync } from '../hooks/useAsync.js'
import { loadMilestoneWatch, milestonesForPlayer, formatMilestoneProjection } from '../api/milestones.js'

// Milestone Watch — the player page's forward-looking companion to the plain
// "X shy of Y" progress line: a projected timeframe for each career-total
// milestone within reach, from the nightly league-wide precompute
// (api/milestones.js / scripts/gen-milestones.mjs), which scales the
// projection by how often the player actually plays rather than assuming
// every team game. `milestones` is the page's own live, spoiler-cutoff-safe
// progress data (person.js's milestoneWatchView) — always shown; the
// projection is an ADDITIONAL annotation, shown only on a bare current-day
// view (`asOf` unset). The precompute is generated against TODAY's pace and
// schedule, so it can't be retrofit to an old game's cutoff — a historical
// view just shows the plain progress line, no projection. `groupLabel`
// (a two-way player's block.title, "Batting"/"Pitching") disambiguates a
// second card when both groups have milestones pending — the achievements
// zone renders both blocks' cards together, ahead of either block's own
// heading.
export function MilestoneWatchCard({ playerId, asOf, milestones, groupLabel }) {
  const { data } = useAsync(() => (asOf ? Promise.resolve(null) : loadMilestoneWatch()), [asOf])
  if (!milestones?.length) return null
  const projections = data ? milestonesForPlayer(data, playerId) : []

  return (
    <div className="milestonewatch">
      <p className="milestonewatch__title">
        Milestone Watch{groupLabel ? ` — ${groupLabel}` : ''}
      </p>
      {milestones.map((m) => {
        const proj = projections.find((p) => p.stat === m.stat)
        const eta = formatMilestoneProjection(proj?.projection)
        return (
          <p key={m.stat} className="milestonewatch__row">
            <span>
              {m.value.toLocaleString('en-US')} {m.label} — {m.remaining} shy of {m.threshold.toLocaleString('en-US')}
            </span>
            {eta && <span className="milestonewatch__eta">Projected {eta}</span>}
          </p>
        )
      })}
    </div>
  )
}
