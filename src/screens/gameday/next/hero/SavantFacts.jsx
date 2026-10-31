import { CountUp } from '../../../../components/charts/CountUp.jsx'
import { useState } from 'react'
import { fetchAtBatTracking } from '../../../../api/savant/gameFeed.js'
import { useAsync } from '../../../../hooks/useAsync.js'
import { fetchSavantPercentiles } from '../../../../api/savantPercentiles.js'
import { hrParks } from '../../../../lib/ballpark/layout/hrParks.js'
import { ZoneSheet } from '../../../../components/scoring/StrikeZone.jsx'

// The batted ball's Savant figures in the opened flight card (Gary, 2026-10-28): xBA, bat speed and
// how many parks it would have left. It mounts only with the card, so the read waits for that tap,
// and the card lives in the hero's reveal. MLB only; a figure Savant has not posted yet is left out.
export function SavantFacts({ gamePk, sportId, playId, ball = null }) {
  const { data } = useAsync(() => (playId ? fetchAtBatTracking(gamePk, sportId, [playId]).catch(() => new Map()) : Promise.resolve(new Map())), [gamePk, sportId, playId])
  const t = data?.get(playId)
  const facts = [
    t?.xba != null && ['xBA', t.xba.toFixed(3).replace(/^0/, ''), ''],
    t?.batSpeed != null && ['Bat speed', t.batSpeed.toFixed(1), ' mph'],
    t?.hrParks != null && ['HR in', String(t.hrParks), ' of 30 parks'],
  ].filter(Boolean)
  const [open, setOpen] = useState(false)
  const [parksOpen, setParksOpen] = useState(false)
  // Which parks (#2695): Savant gives only the count, so the list is our own wall check (hrParks.js).
  const parks = t?.hrParks >= 1 ? hrParks(ball) : null
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
          if (label === 'Bat speed') return <button key={label} type="button" className={`bflight__fact bflight__fact--tap${open ? ' is-on' : ''}`} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>{inner}</button>
          // The park count opens the list of parks it leaves (Gary, 2026-10-28).
          if (label === 'HR in' && parks) return <button key={label} type="button" className="bflight__fact bflight__fact--tap" aria-haspopup="dialog" onClick={(e) => { e.stopPropagation(); setParksOpen(true) }}>{inner}</button>
          return <div key={label} className="bflight__fact">{inner}</div>
        })}
      </div>
      {open && t?.batSpeed != null && <BatSpeedHistogram mph={t.batSpeed} />}
      {parksOpen && <HrParksSheet parks={parks} savant={t.hrParks} onClose={() => setParksOpen(false)} />}
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

// The parks list: the ones it leaves, then the ones it does not. Our own estimate from each park's wall
// distance and height on the ball's bearing (wind and air ignored), so it says so, and says when its
// count differs from Savant's.
function HrParksSheet({ parks, savant, onClose }) {
  const n = parks.leaves.length + parks.stays.length
  return (
    <ZoneSheet note="Home run parks" head={false} title={[`Gone in ${parks.leaves.length} of ${n} parks`, 'Our estimate']} onClose={onClose}>
      <div className="hrparks" onClick={(e) => e.stopPropagation()}>
        <p className="hrparks__note">
          From each park&rsquo;s wall distance and height on this ball&rsquo;s line. Wind and air are not counted.
          {parks.leaves.length !== savant && ` Savant counts ${savant} of 30.`}
        </p>
        <h3 className="hrparks__head">Gone in</h3>
        {parks.leaves.length ? <ul className="hrparks__list">{parks.leaves.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="hrparks__none">None</p>}
        <h3 className="hrparks__head">In the park at</h3>
        {parks.stays.length ? <ul className="hrparks__list">{parks.stays.map((p) => <li key={p}>{p}</li>)}</ul> : <p className="hrparks__none">None</p>}
      </div>
    </ZoneSheet>
  )
}
