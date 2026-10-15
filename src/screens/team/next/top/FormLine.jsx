import { useId } from 'react'
import { formGeometry } from './topData.js'

// The form line (the player Form trend's chart, drawn for a club): games over .500 across the
// season, a fill above and below the zero line, the line, then today's dot. The geometry is
// topData.js's; the draw, the fade and the stamp are top.css. `series` is formSeries().
export function FormLine({ series }) {
  const id = useId().replaceAll(':', '')
  const g = formGeometry(series)
  const { left, right, top, bottom, zeroY } = g
  return (
    <svg className="tnext__formsvg" viewBox={`0 ${top - 14} 336 ${bottom + 26 - top + 14}`} role="img"
      aria-label={`Games over .500 across the season, from 0 at the start to ${series.now > 0 ? 'plus ' : series.now < 0 ? 'minus ' : ''}${Math.abs(series.now)} now`}>
      <defs>
        <clipPath id={`${id}up`}><rect x="0" y="0" width="336" height={zeroY} /></clipPath>
        <clipPath id={`${id}dn`}><rect x="0" y={zeroY} width="336" height="200" /></clipPath>
      </defs>
      {g.ticks.map((t) => (
        <g key={t.label}>
          <line className="tnext__formgrid" x1={left} x2={right} y1={t.y} y2={t.y} />
          <text className="tnext__formaxis" x="2" y={t.y + 3}>{t.label}</text>
        </g>
      ))}
      <text className="tnext__formaxis" x="8" y={zeroY + 3}>0</text>
      <path className="tnext__formfill" clipPath={`url(#${id}up)`} d={g.area} />
      <path className="tnext__formfill tnext__formfill--down" clipPath={`url(#${id}dn)`} d={g.area} />
      <line className="tnext__formzero" x1={left} x2={right} y1={zeroY} y2={zeroY} />
      <path className="tnext__formline" pathLength="1" d={g.line} />
      <circle className="tnext__formdot" cx={g.end.x} cy={g.end.y} r="5" />
      <text className="tnext__formval" x={right - 34} y={Math.max(top, g.end.y - 10)}>
        {series.now > 0 ? `+${series.now}` : series.now < 0 ? `−${-series.now}` : '0'}
      </text>
      {g.months.map((m) => (
        <text key={m.m} className="tnext__formaxis" x={m.x} y={bottom + 20}>{m.label}</text>
      ))}
    </svg>
  )
}
