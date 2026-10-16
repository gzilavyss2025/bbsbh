import { useId } from 'react'
import '../../../../../styles/player-next/both/formchart.css'
import { monthDayName } from '../../../../../lib/dates.js'

// The Form trend's line chart, shared by the batter (#1889) and the pitcher (#1930) module.
// It draws a rolling series against a season line and knows nothing of OPS or ERA: the
// caller passes the numbers and how to print them.
//
//   points   [{ date, v, mark? }], oldest first. A `mark` draws a tick on the rug (a game with
//            a home run); a series with none draws no rug.
//   season   the season value, the dashed line the fill grows from; null draws no line or fill.
//   better   'up' (OPS) or 'down' (ERA): the fill on the better side of the season line is green.
//   step     the gridline spacing in the value's unit (.1 of OPS, 1 of ERA).
//   best, worst  the point indexes to circle.
//   cursor, onCursor  the point indexed now, and what the scrubber calls with a new one.
//   format   v to text.     label  the chart's name for a screen reader.
const W = 640
const H = 250
const TOP = 14
const PLOT = 196
const pct = (x) => `${((100 * x) / H).toFixed(2)}%`

export function FormChart({ points, season, better, step: base, best, worst, cursor, onCursor, format, label }) {
  const id = useId().replaceAll(':', '')
  const N = points.length
  const vals = points.map((p) => p.v).concat(season ?? [])
  // A wide range (a season-to-date ERA from 0 to 12) doubles the gap, so the labels never crowd.
  let step = base
  while ((Math.max(...vals) - Math.min(...vals)) / step > 6) step *= 2
  const lo = Math.floor(Math.min(...vals) / step) * step - step / 2
  const hi = Math.ceil(Math.max(...vals) / step) * step + step / 2
  const x = (i) => (N > 1 ? 8 + (i * (W - 16)) / (N - 1) : W / 2)
  const y = (v) => TOP + ((hi - v) / (hi - lo)) * PLOT
  const pt = (i) => `${x(i).toFixed(1)},${y(points[i].v).toFixed(1)}`
  const line = `M${points.map((_, i) => pt(i)).join('L')}`
  const ref = season == null ? null : y(season).toFixed(1)
  const area = ref && `${line}L${x(N - 1).toFixed(1)},${ref}L${x(0).toFixed(1)},${ref}Z`
  const grid = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) grid.push(v)
  const rug = points.map((p, i) => (p.mark ? `M${x(i).toFixed(1)},236V248` : '')).join('')
  // A month label sits at the first point of its month, unless the last label is too near.
  const months = []
  points.forEach((p, i) => {
    const m = p.date.slice(0, 7)
    const left = (100 * x(i)) / W
    if (m !== months.at(-1)?.m && (!months.length || left - months.at(-1).left >= 7)) months.push({ m, left, t: monthDayName(p.date).split(' ')[0] })
  })
  const up = better === 'up'
  const cur = points[cursor]
  return (
    <div className="fchart">
      <div className="fchart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="fchart__svg">
          {ref && (
            <>
              <defs>
                <clipPath id={`${id}up`}><rect x="0" y="0" width={W} height={ref} /></clipPath>
                <clipPath id={`${id}dn`}><rect x="0" y={ref} width={W} height={H} /></clipPath>
              </defs>
              <path d={area} clipPath={`url(#${id}up)`} className={`fchart__fill fchart__fill--${up ? 'good' : 'bad'}`} />
              <path d={area} clipPath={`url(#${id}dn)`} className={`fchart__fill fchart__fill--${up ? 'bad' : 'good'}`} />
            </>
          )}
          <path d={grid.map((v) => `M0,${y(v).toFixed(1)}H${W}`).join('')} className="fchart__grid" />
          {ref && <path d={`M0,${ref}H${W}`} className="fchart__season" />}
          <path d={line} className="fchart__line" />
          <path d={rug} className="fchart__rug" />
          <circle cx={x(best)} cy={y(points[best].v)} r="7" className="fchart__dot fchart__dot--best" />
          <circle cx={x(worst)} cy={y(points[worst].v)} r="7" className="fchart__dot fchart__dot--worst" />
          <path d={`M${x(cursor).toFixed(1)},${TOP}V${TOP + PLOT}`} className="fchart__cursor" />
          <circle cx={x(cursor)} cy={y(cur.v)} r="6" className="fchart__dot fchart__dot--cursor" />
        </svg>
        <div className="fchart__scale" aria-hidden="true">
          {grid.map((v) => (
            <span key={v} className="fchart__tick" style={{ top: pct(y(v)) }}>{format(v)}</span>
          ))}
        </div>
        <input
          className="fchart__scrub"
          type="range"
          min="0"
          max={N - 1}
          step="1"
          value={cursor}
          aria-label="Scrub through the season"
          aria-valuetext={`${monthDayName(cur.date)}: ${format(cur.v)}`}
          onChange={(e) => onCursor(Number(e.target.value))}
        />
      </div>
      <div className="fchart__months" aria-hidden="true">
        {months.map((m) => (
          <span key={m.m} className="fchart__month" style={{ left: `${m.left.toFixed(1)}%` }}>{m.t}</span>
        ))}
      </div>
    </div>
  )
}
