import { fetchWorkload, workloadFor, workloadVsBaseline } from '../api/workload.js'
import { useAsync } from '../hooks/useAsync.js'

// The player page's recent-workload card for pitchers: pitches over his last
// 1 / 3 / 10 appearances (with the days they span), how that load sits
// against his own norm and his role's league baseline, and the rest pattern.
// Data is the nightly gen-workload.mjs precompute — completed appearances
// only, spoiler-free. Current-day only (hidden under a spoiler `asOf`
// cutoff), same rule as FoulCard/Milestone Watch. MiLB / unknown → no card.
export function PitcherWorkloadCard({ playerId, asOf }) {
  const skip = !!asOf
  const { data } = useAsync(
    () => (skip ? Promise.resolve(null) : fetchWorkload()),
    [skip],
  )
  if (skip || !data) return null

  // Relative to the day after the file's cutoff, so the newest completed
  // appearance counts (workloadFor excludes asOfDate itself).
  const asOfDate = dayAfter(data.asOf)
  const load = workloadFor(data, playerId, asOfDate)
  if (!load || (load.season?.g ?? 0) === 0) return null
  const vs = workloadVsBaseline(data, playerId, asOfDate)

  const spans = (b) =>
    b?.pitches != null && b.apps > 0 ? `${b.pitches} in ${b.days}d` : '—'

  return (
    <div className="loadcard">
      <h3 className="section__title">
        <span>Recent workload</span>
        <em>{load.role === 'SP' ? 'starter' : 'reliever'}</em>
      </h3>
      <dl className="factgrid">
        <div className="fact">
          <dt className="fact__label">Last outing</dt>
          <dd className="fact__value">
            {load.last1?.pitches != null ? `${load.last1.pitches} pitches` : '—'}
          </dd>
        </div>
        <div className="fact">
          <dt className="fact__label">Last 3</dt>
          <dd className="fact__value">{spans(load.last3)}</dd>
        </div>
        <div className="fact">
          <dt className="fact__label">Last 10</dt>
          <dd className="fact__value">{spans(load.last10)}</dd>
        </div>
        <div className="fact">
          <dt className="fact__label">Rest pattern</dt>
          <dd className="fact__value">
            {load.pitchedYesterday
              ? load.consecDays >= 2
                ? `${load.consecDays} straight days`
                : 'pitched yesterday'
              : `${load.last7dayApps} of last 7 days`}
          </dd>
        </div>
        {vs?.vsOwnPct != null && (
          <div className="fact">
            <dt className="fact__label">Vs. his norm</dt>
            <dd className="fact__value">{signedPct(vs.vsOwnPct)}</dd>
          </div>
        )}
        {vs?.vsRolePct != null && (
          <div className="fact">
            <dt className="fact__label">Vs. league {load.role === 'SP' ? 'starters' : 'relievers'}</dt>
            <dd className="fact__value">{signedPct(vs.vsRolePct)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}

function dayAfter(ymd) {
  const t = Date.parse(`${ymd}T00:00:00Z`)
  if (!Number.isFinite(t)) return ymd
  return new Date(t + 86400000).toISOString().slice(0, 10)
}

const signedPct = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))}%`
