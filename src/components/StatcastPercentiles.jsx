import { useState } from 'react'
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
//
// Each row is tappable: the acronym alone (xwOBA, Chase %, …) doesn't mean
// anything to a casual reader, so tapping opens a one-line plain-language
// gloss (`m.def`) in place, rather than crowding a permanent subtitle into
// the label column or sending the reader to an external glossary. Only one
// row open at a time — reading two at once isn't the point, a quick "what
// is this" is.
export function StatcastPercentiles({ savant, group }) {
  const [openKey, setOpenKey] = useState(null)
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
          const open = openKey === m.key
          return (
            <div className="statcast__rowgroup" key={m.key}>
              <button
                type="button"
                className="statcast__row"
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : m.key)}
              >
                <span className="statcast__label">{m.label}</span>
                <span className="statcast__track">
                  <span
                    className={`statcast__fill${pct >= 90 ? ' is-standout' : ''}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="statcast__pct">{pct}</span>
              </button>
              {open && <p className="statcast__def">{m.def}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
