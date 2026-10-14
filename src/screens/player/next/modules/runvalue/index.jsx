import { useEffect, useMemo, useState } from 'react'
import '../../../../../styles/player-next/season/runvalue.css'
import { fetchRunValue } from '../../../../../api/around-the-game/runValue.js'
import { Door } from '../../../../../components/ui/control/Door.jsx'
import { StatTile } from '../../../../../components/ui/frame/StatTile.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { useRouteLink } from '../../../../../lib/nav.js'
import { runValuePath } from '../../../../../lib/route.js'
import { runValueView } from './runValueView.js'

// Run value (#2013): the season in runs above an average player, then its parts as bars from a zero line.
// Open surface (ADR-0034): a nightly Savant season file, no seal and no gate. A two-way player gets one card (slot `once`).
export default function RunvalueModule({ bio, season, onEmpty, onCount }) {
  const { data, loading } = useAsync(fetchRunValue, [])
  const link = useRouteLink()
  const [picked, setPicked] = useState(null)
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
  const part = view.parts.find((p) => p.key === picked)
  return (
    <div className="runvalue">
      <div className={`runvalue__tiles${view.rank ? '' : ' runvalue__tiles--solo'}`}>
        <StatTile tone="ink" label="Runs above avg" value={view.total} caption="runs vs an average player" />
        {view.rank && <StatTile label="Rank" value={view.rank.place} caption={view.rank.caption} />}
      </div>
      <ul className="runvalue__parts">
        {view.parts.map((p) => (
          <li key={p.key}>
            <button type="button" className="runvalue__row" aria-pressed={p.key === picked} onClick={() => setPicked(p.key === picked ? null : p.key)}>
              <span className="runvalue__label">{p.label}</span>
              <span className="runvalue__track" aria-hidden="true">
                <span className={`runvalue__bar runvalue__bar--${p.side}`} style={{ width: `${p.width / 2}%` }} />
              </span>
              <span className={`runvalue__num mono runvalue__num--${p.tone}`}>{p.value}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="runvalue__axis mono" aria-hidden="true">
        <span>−{view.scale}</span>
        <span>0</span>
        <span>+{view.scale}</span>
      </p>
      {part && <p className="runvalue__line">{part.line}</p>}
      <p className="runvalue__sentence">{view.sentence}</p>
      <Door {...link(runValuePath())}>{view.door}</Door>
      <p className="runvalue__foot">{view.foot}</p>
    </div>
  )
}
