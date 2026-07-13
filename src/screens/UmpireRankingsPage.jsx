import { loadUmpireRankings } from '../api/umpires.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { UmpireLink } from '../components/UmpireLink.jsx'
import { UmpireTierPill } from '../components/UmpireTierPill.jsx'

const pct1 = (x) => `${(x * 100).toFixed(1)}%`

// Every qualifying MLB plate umpire this season, ranked by called-pitch
// accuracy, with the statistical tier (api/umpires.js's tierForZ — SD buckets
// over the whole qualifying pool, not equal thirds) his accuracy falls into.
// Ball/strike judgment counts carry no score, so — like the per-umpire page —
// this needs no SealBox.
export function UmpireRankingsPage() {
  useDocumentTitle('Home Plate Umpire Rankings')
  const { loading, error, data } = useAsync(() => loadUmpireRankings(), [])
  const ranked = data?.ranked ?? []
  const spread = ranked.length > 1 ? ranked[0].accuracy - ranked[ranked.length - 1].accuracy : null

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Home Plate Umpire Rankings</h1>
      </header>

      <p className="hint">
        {data?.season ? `${data.season} season ` : 'Season '}
        called-pitch accuracy for every plate umpire with at least a handful of starts behind
        the plate. Tiers are set by standard deviation from the league mean, not an even split —
        {spread != null
          ? ` the whole field spans under ${(spread * 100).toFixed(1)} points.`
          : ' the gap between the best and worst plate umpires is small.'}
      </p>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={ranked.length > 0}
        errorMessage="Couldn’t load umpire rankings. Try again."
        emptyMessage="No umpire accuracy data available yet."
        emptyProse
      />

      {ranked.length > 0 && (
        <div className="ledger-wrap">
          <table className="standings umprank">
            <thead>
              <tr>
                <th className="team">Umpire</th>
                <th>Tier</th>
                <th>Accuracy</th>
                <th>Games</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((u) => (
                <tr key={u.id}>
                  <td className="team">
                    <span className="umprank__rank">{u.rank}</span>
                    <UmpireLink id={u.id}>{u.name}</UmpireLink>
                  </td>
                  <td>
                    <UmpireTierPill tier={u.tier} />
                  </td>
                  <td>{pct1(u.accuracy)}</td>
                  <td>{u.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
