// Rounding straight to 1 decimal would show "100.0%" for anything from
// 99.95% up to a true 2000/2000 — indistinguishable from actual certainty.
// Near the 0%/100% extremes, fall back to 2 decimals so a near-miss still
// reads as a near-miss.
function pct(n) {
  if (n == null) return '—'
  if (n <= 0) return '0.0%'
  if (n >= 100) return '100.0%'
  const rounded = Math.round(n * 10) / 10
  if (rounded === 0 || rounded === 100) return `${n.toFixed(2)}%`
  return `${rounded.toFixed(1)}%`
}

export function PostseasonOddsCard({ snapshot }) {
  return (
    <section className="postseason-odds" aria-label={`Postseason odds through ${snapshot.asOf}`}>
      <div className="postseason-odds__head">
        <span>Postseason Odds</span>
        <em>through {snapshot.asOf}</em>
      </div>
      <div className="postseason-odds__values">
        <div className="postseason-odds__value">
          <span>Make Playoffs</span>
          <strong>{pct(snapshot.playoffPct)}</strong>
        </div>
        <div className="postseason-odds__value">
          <span>Win Division</span>
          <strong>{pct(snapshot.divisionPct)}</strong>
        </div>
        <div className="postseason-odds__value">
          <span>#1 Seed / Bye</span>
          <strong>{pct(snapshot.byePct)}</strong>
        </div>
      </div>
      <div className="postseason-odds__meta">
        Projected {snapshot.projectedWins} wins · {snapshot.sims.toLocaleString()} simulations
      </div>
    </section>
  )
}
