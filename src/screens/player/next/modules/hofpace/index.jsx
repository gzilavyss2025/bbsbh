import { useEffect } from 'react'
import '../../../../../styles/player-next/career/hofpace.css'
import { PlayerLink } from '../../../../../components/player/PlayerLink.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { hofPaceFor } from './hofpaceData.js'

// Hall of Fame pace (#1857): his career totals against the nearest Hall of Famers at the
// same age. Open surface (ADR-0034): a game in progress today counts, as on every season line.
export default function HofPaceModule({ bio, role, asOf, season, onEmpty }) {
  const { data: view, loading } = useAsync(() => hofPaceFor(bio, role, season, asOf), [bio.id, role, season, asOf])
  const empty = !loading && !view
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  if (loading) return <div className="hofpace hofpace--loading" aria-busy="true" />
  if (empty) return null
  return (
    <div className="hofpace">
      <p className="t-label hofpace__note">Hall of Famers through age {view.age}</p>
      <ul className="hofpace__list">
        {view.rows.map((r) => (
          <li key={r.stat} className="hofpace__row">
            <p className="hofpace__his">
              <b className="mono">{r.value}</b> <abbr title={r.title}>{r.label}</abbr>
            </p>
            <ol className="hofpace__comps">
              {r.comps.map((c) => (
                <li key={c.id} className="hofpace__comp">
                  <PlayerLink id={c.id} name={c.name}>{c.name}</PlayerLink>
                  <span className="mono">{c.value}</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </div>
  )
}
