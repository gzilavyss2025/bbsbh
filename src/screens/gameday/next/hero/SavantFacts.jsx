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
      {/* A drawer out of the facts box (Gary, 2026-10-30): no headline (the count rides in the aria-label), this
          swing's speed over its bin, the league's average on the axis under the plot, so the labels never collide. */}
      <div className="bshist__plot">
        {bins.map((n, i) => <i key={i} className={`bshist__bar${lo + i === Math.floor(mph) ? ' is-here' : ''}`} style={{ height: `${(n / top) * 100}%` }} />)}
        {median != null && <span className="bshist__median" style={{ left: at(median) }} />}
        <span className="bshist__mark" style={{ left: at(mph) }}><small>{mph.toFixed(1)} mph</small></span>
      </div>
      <p className="bshist__axis">
        <span>{lo} mph</span>
        {median != null && <span className="bshist__lg" style={{ left: at(median) }}>Lg avg {median.toFixed(1)} mph</span>}
        <span>{hi} mph</span>
      </p>
    </div>
  )
}
