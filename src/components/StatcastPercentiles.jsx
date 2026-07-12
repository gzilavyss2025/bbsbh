import { useState } from 'react'
import { BATTER_METRICS, PITCHER_METRICS } from '../api/savantPercentiles.js'
import { FlipCard } from './FlipCard.jsx'
import { StatcastCard } from './StatcastCard.jsx'

// STATCAST — season percentile ranks (Baseball Savant), one small card per
// metric rather than a bar chart mimicking Savant's own — reuses the exact
// StatcastCard tile the innings view and box score already use for per-half
// superlatives, so "Statcast" reads as one visual family across the app.
// Savant computes the percentiles AND their own qualification floor (see
// api/savantPercentiles.js) — this is a pure presentational read of whatever
// it hands back. Season aggregates are spoiler-free and, unlike
// SplitsVsTeam's last-game row, carry no single-game granularity to gate
// against the page's asOf cutoff — see .scratch/savant-percentiles/plan.md §4
// for the full spoiler audit.
//
// Renders nothing when there's no data at all (MiLB player, or under
// Savant's sample floor for every metric this app keeps) — no empty state,
// same as SplitsVsTeam/conversionNote.
//
// Each card is tappable: the acronym alone (xwOBA, Chase %, …) doesn't mean
// anything to a casual reader, so tapping it turns the card over — the same
// blackjack-style FlipCard the slate uses to reveal a past game's Final line
// — to a plain-language definition (`m.def`) on the back. Unlike the slate's
// flip, there's no score to guard here, so each card is free to flip back and
// forth on its own; MetricFlipCard just owns a local open/closed boolean.
export function StatcastPercentiles({ savant, group }) {
  if (!savant) return null
  const metrics = group === 'pitching' ? PITCHER_METRICS : BATTER_METRICS
  const rows = metrics.filter((m) => savant[m.key] != null)
  if (!rows.length) return null

  return (
    <section className="statcast-section">
      <h3 className="section__title"><span>Statcast</span></h3>
      <div className="statcast">
        {rows.map((m) => (
          <MetricFlipCard key={m.key} metric={m} pct={savant[m.key]} />
        ))}
      </div>
    </section>
  )
}

function MetricFlipCard({ metric, pct }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      className="statcast__flipbtn"
      aria-expanded={open}
      aria-label={open ? `${metric.label}: ${metric.def}` : `${metric.label}, ${pct}th percentile — tap for definition`}
      onClick={() => setOpen((o) => !o)}
    >
      <FlipCard
        flipped={open}
        renderFront={() => <StatcastCard label={metric.label} value={pct} unit="%ILE" />}
        renderBack={() => (
          <div className="statcast__card statcast__card--back">
            <span className="statcast__label">{metric.label}</span>
            <p className="statcast__def">{metric.def}</p>
          </div>
        )}
      />
    </button>
  )
}
