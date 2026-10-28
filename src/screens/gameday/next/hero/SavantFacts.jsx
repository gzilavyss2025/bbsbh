import { useState } from 'react'
import { fetchAtBatTracking } from '../../../../api/savant/gameFeed.js'
import { useAsync } from '../../../../hooks/useAsync.js'

// The batted ball's Savant figures in the opened flight card (Gary, 2026-10-28): xBA, bat speed and
// how many parks it would have left. It mounts only with the card, so the read waits for that tap,
// and the card lives in the hero's reveal. MLB only; a figure Savant has not posted yet is left out.
export function SavantFacts({ gamePk, sportId, playId }) {
  const { data } = useAsync(() => (playId ? fetchAtBatTracking(gamePk, sportId, [playId]).catch(() => new Map()) : Promise.resolve(new Map())), [gamePk, sportId, playId])
  const t = data?.get(playId)
  const facts = [
    t?.xba != null && ['xBA', t.xba.toFixed(3).replace(/^0/, ''), ''],
    t?.batSpeed != null && ['Bat speed', t.batSpeed.toFixed(1), ' mph'],
    t?.hrParks != null && ['HR in', String(t.hrParks), ' of 30 parks'],
  ].filter(Boolean)
  if (facts.length === 0) return null
  return (
    <div className="bflight__facts">
      {facts.map(([label, value, unit]) => (
        <div key={label} className="bflight__fact">
          <p className="bflight__factlabel">{label}</p>
          <p className="bflight__factvalue">{value}{unit && <span className="bflight__unit">{unit}</span>}</p>
        </div>
      ))}
    </div>
  )
}

// The hero's Distance cell as a toggle (Gary, 2026-10-28): a tap turns it to how many of the 30 parks
// the ball would have left (Savant), and back. The read waits for the first tap. `children` is the
// cell's own label and value.
export function ParksCell({ gamePk, sportId, playId, children }) {
  const [on, setOn] = useState(false)
  const { data } = useAsync(() => (on && playId ? fetchAtBatTracking(gamePk, sportId, [playId]).catch(() => new Map()) : Promise.resolve(null)), [on, gamePk, sportId, playId])
  const parks = data?.get(playId)?.hrParks
  return (
    <button type="button" className="gdhero__parks" aria-pressed={on} onClick={() => setOn(!on)}>
      {!on ? children : (
        <>
          <dt>HR in</dt>
          <dd>{parks == null ? (data ? '—' : '…') : parks}<small>{parks == null ? '' : ' of 30 parks'}</small></dd>
        </>
      )}
    </button>
  )
}
