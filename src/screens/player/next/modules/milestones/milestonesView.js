// The Milestone watch module's pure view (#2017): the rows for the countdown ledger.
import { MILESTONE_DEFS } from '../../../../../api/person/milestones.js'
import { formatMilestoneProjection, MILESTONE_PAUSE_NOTE } from '../../../../../api/milestones.js'

const GROUP_WORD = { hitting: 'Batting', pitching: 'Pitching' }

// rows: milestoneWatchView's rows (nearest first). projections: milestonesForPlayer's rows.
// paused: the postseason pause (every ETA dashed). asOf set: no projection (the file is today's).
export function milestonesView({ rows, projections = [], paused = false, asOf = null, twoWay = false, role }) {
  if (!rows?.length) return null
  const showEta = !paused && !asOf
  return {
    tag: `${rows.length} ${rows.length === 1 ? 'mark' : 'marks'}`,
    group: twoWay ? GROUP_WORD[role] : null,
    note: paused && !asOf ? MILESTONE_PAUSE_NOTE : null,
    rows: rows.map((r, i) => {
      const prev = MILESTONE_DEFS.find((d) => d.stat === r.stat)?.thresholds.filter((t) => t < r.threshold).pop() ?? 0
      // The nightly file projects today's chase; a dated page can show an earlier mark of the same stat.
      const proj = projections.find((p) => p.stat === r.stat && p.threshold === r.threshold)
      return {
        key: r.stat,
        label: r.label,
        value: r.value,
        threshold: r.threshold,
        remaining: r.remaining,
        from: prev,
        fill: Math.round(((r.value - prev) / (r.threshold - prev)) * 100),
        eta: showEta ? formatMilestoneProjection(proj?.projection) : null,
        inked: i === 0,
      }
    }),
  }
}
