import { useEffect, useMemo } from 'react'
import '../../../../../styles/player-next/season/runvalue.css'
import { fetchRunValue } from '../../../../../api/around-the-game/runValue.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { runValueView } from './runValueView.js'

// Run value (#2013): the season in runs above an average player, where that ranks, and the parts that made it.
// Open surface (ADR-0034): a nightly Savant season file, no seal and no gate. A two-way player gets one card (slot `once`).
export default function RunvalueModule({ bio, season, onEmpty, onCount }) {
  const { data, loading } = useAsync(fetchRunValue, [])
  const view = useMemo(() => runValueView(data, bio.id, season), [data, bio.id, season])
  // A missing file resolves to its fallback, not a rejection: a settled load with no view is empty.
  const empty = !loading && !view
  useEffect(() => {
    if (empty) onEmpty()
  }, [empty, onEmpty])
  const count = view?.count
  useEffect(() => {
    onCount(count)
  }, [count, onCount])
  if (loading) return <div className="runvalue runvalue--loading" aria-busy="true" />
  if (empty) return null
  // One part (a pitcher) is the total again, so it gets no tile.
  const tiles = view.parts.length > 1
  return (
    <div className="runvalue">
      <div className="runvalue__head">
        <div className="runvalue__lead">
          <p className="runvalue__label">Runs above average</p>
          <p className="runvalue__total">{view.total}</p>
        </div>
        {view.rank && (
          <div className="runvalue__rank">
            <p className="runvalue__place">{view.rank.place}</p>
            <p className="runvalue__among">{view.rank.caption}</p>
          </div>
        )}
      </div>
      {view.strip != null && (
        <div className="runvalue__strip" aria-hidden="true">
          <span className="runvalue__rail">
            <span className="runvalue__mark" style={{ left: `${view.strip}%` }} />
          </span>
          <span className="runvalue__ends">
            <span>last</span>
            <span>best</span>
          </span>
        </div>
      )}
      {tiles && (
        <ul className={`runvalue__parts runvalue__parts--${view.parts.length}`}>
          {view.parts.map((p) => (
            <li key={p.key} className="runvalue__part">
              <p className="runvalue__name">{p.label}</p>
              <p className={`runvalue__num runvalue__num--${p.tone}`}>{p.value}</p>
              <span className="runvalue__track" aria-hidden="true">
                {p.width > 0 && <span className={`runvalue__bar runvalue__bar--${p.side}`} style={{ width: `${p.width}%` }} />}
              </span>
              {p.place && <p className="runvalue__place-note">{p.place}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
