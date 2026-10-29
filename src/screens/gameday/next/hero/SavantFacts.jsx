import { CountUp } from '../../../../components/charts/CountUp.jsx'
import { useState } from 'react'
import { fetchAtBatTracking } from '../../../../api/savant/gameFeed.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { fetchSavantPercentiles } from '../../../../api/savantPercentiles.js'

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
  const [open, setOpen] = useState(false)
  if (facts.length === 0) return null
  return (
    <>
      <div className="bflight__facts">
        {facts.map(([label, value, unit]) => {
          const inner = (
            <>
              <p className="bflight__factlabel">{label}</p>
              <p className="bflight__factvalue"><CountUp value={value} />{unit && <span className="bflight__unit">{unit}</span>}</p>
            </>
          )
          // Bat speed opens where this swing sits among the league's hitters (Gary, 2026-10-29).
          return label === 'Bat speed'
            ? <button key={label} type="button" className={`bflight__fact bflight__fact--tap${open ? ' is-on' : ''}`} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>{inner}</button>
            : <div key={label} className="bflight__fact">{inner}</div>
        })}
      </div>
      {open && t?.batSpeed != null && <BatSpeedHistogram mph={t.batSpeed} />}
    </>
  )
}

// This swing's bat speed against every qualified hitter's AVERAGE bat speed this season (Savant's season
// board, public/data/savant-percentiles.json `rawBat`), in 1 mph bins, with the league median marked. A season
// stat on an open number: no seal (ADR-0034). Nothing drawn when the board carries no bat speeds.
function BatSpeedHistogram({ mph }) {
  const { data } = useAsync(() => fetchSavantPercentiles(), [])
  const speeds = Object.values(data?.rawBat ?? {}).map((r) => r?.batSpeed).filter((v) => typeof v === 'number')
  if (!speeds.length) return null
  const lo = Math.floor(Math.min(...speeds, mph))
  const hi = Math.ceil(Math.max(...speeds, mph))
  const bins = Array.from({ length: hi - lo + 1 }, (_, i) => speeds.filter((v) => Math.floor(v) === lo + i).length)
  const top = Math.max(...bins)
  const median = data?.midBat?.batSpeed ?? null
  const at = (v) => `${((v - lo) / (hi - lo + 1)) * 100}%`
  const faster = speeds.filter((v) => v < mph).length
  return (
    <div className="bshist" role="img" aria-label={`This swing, ${mph.toFixed(1)} mph, is faster than the average swing of ${faster} of ${speeds.length} qualified hitters`}>
      <p className="bshist__head">Faster than the average swing of <b>{faster} of {speeds.length}</b> hitters</p>
      <div className="bshist__plot">
        {bins.map((n, i) => <i key={i} className={`bshist__bar${lo + i === Math.floor(mph) ? ' is-here' : ''}`} style={{ height: `${(n / top) * 100}%` }} />)}
        {median != null && <span className="bshist__median" style={{ left: at(median) }}><small>Lg {median.toFixed(1)}</small></span>}
        <span className="bshist__mark" style={{ left: at(mph) }} />
      </div>
      <p className="bshist__axis"><span>{lo} mph</span><span>{hi} mph</span></p>
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
