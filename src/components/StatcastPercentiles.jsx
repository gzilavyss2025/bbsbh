import { BATTER_METRICS, PITCHER_METRICS } from '../api/savantPercentiles.js'

// STATCAST — season percentile-rank bars (Baseball Savant), redrawn in the
// paper-scorebook idiom: one inked bar per metric, filled to the percentile,
// with the number in mono tabular figures. Savant computes the percentiles
// AND their own qualification floor (see api/savantPercentiles.js) — this is
// a pure presentational read of whatever it hands back. Season aggregates are
// spoiler-free and, unlike SplitsVsTeam's last-game row, carry no single-game
// granularity to gate against the page's asOf cutoff — see
// .scratch/savant-percentiles/plan.md §4 for the full spoiler audit.
//
// Renders nothing when there's no data at all (MiLB player, or under
// Savant's sample floor for every metric this app keeps) — no empty state,
// same as SplitsVsTeam/conversionNote.
export function StatcastPercentiles({ savant, group }) {
  if (!savant) return null
  const metrics = group === 'pitching' ? PITCHER_METRICS : BATTER_METRICS
  const rows = metrics.filter((m) => savant[m.key] != null)
  if (!rows.length) return null

  return (
    <section className="statcast">
      <h3 className="section__title"><span>Statcast</span></h3>
      <div className="statcast__rows">
        {rows.map((m) => {
          const pct = savant[m.key]
          return (
            <div className="statcast__row" key={m.key}>
              <div className="statcast__label">{m.label}</div>
              <div className="statcast__track">
                <div
                  className={`statcast__fill${pct >= 90 ? ' is-standout' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="statcast__pct">{pct}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
