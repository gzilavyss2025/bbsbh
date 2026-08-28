import { percentileRows } from '../../api/savantPercentiles.js'
import { PercentileStrip } from './PercentileStrip.jsx'

// STATCAST — season percentile ranks (Baseball Savant), drawn as one ruled
// strip on a shared 0–100 axis (PercentileStrip.jsx). Savant computes the
// percentiles AND their own qualification floor (see api/savantPercentiles.js)
// — this is a pure presentational read of whatever it hands back. Season
// aggregates are spoiler-free and, unlike SplitsVsTeam's last-game row, carry
// no single-game granularity to gate against the page's asOf cutoff — see
// .scratch/savant-percentiles/plan.md §4 for the full spoiler audit.
//
// Renders nothing when there's no data at all (MiLB player, or under Savant's
// sample floor for all but a couple of metrics) — no empty state, same as
// SplitsVsTeam/conversionNote.
//
// ONE ELEMENT, NOT TWO. This section used to render a five-spoke radar above a
// grid of flip cards holding the same percentiles again — the radar's own
// header called it "the same data twice on purpose", shape first and then the
// numbers. The strip is what makes that split unnecessary rather than merely
// redundant: a row already IS the label, the raw rate, the plotted rank and
// the rank in figures, on one line, so there is nothing left for a second
// element to add. Tapping a row still turns up the plain-language definition
// the flip cards carried — as an inline disclosure now, which keeps the
// columns aligned where a flipping tile would not. ADR-0040.
// `limit` trims to the strip's own leading rows (its canonical metric order,
// unchanged) — the Overview's preview asks for the top 3; the Analytics tab
// leaves it unset and gets every metric, same as before this prop existed.
export function StatcastPercentiles({ savant, raw, median, group, limit }) {
  const allRows = percentileRows(savant, raw, group, median)
  if (!allRows) return null
  const rows = limit ? allRows.slice(0, limit) : allRows

  return (
    <section className="statcast-section">
      <h3 className="section__title">
        <span>Statcast</span>
        <em>percentile rank</em>
      </h3>
      <PercentileStrip rows={rows} />
    </section>
  )
}
