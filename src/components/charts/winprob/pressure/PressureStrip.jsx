import { W, H } from '../plot.js'

// The pressure strip (strip.js has the rule), drawn as the bottom band of the
// chart's own SVG so it shares the plot's x-scale, its scrub surface and its
// cursor. `segs` is pressureStrip's output. Decorative: the rows below and the
// slider say each play's pressure in words.
export const STRIP_H = 14
const RISE = { low: 4, mid: 7, high: 10 }

// `show` holds the dark panel even before any segment can draw (no cutoffs yet).
export function PressureStrip({ segs, show }) {
  if (!show) return null
  return (
    <g className="winprob__strip" transform={`translate(0 ${H})`} aria-hidden="true">
      <rect className="winprob__strip-panel" x={0} y={0} width={W} height={STRIP_H} />
      {segs.map((s) => (
        <rect
          key={s.idx}
          className={`winprob__strip-seg is-${s.level}`}
          style={s.level === 'low' ? undefined : { fill: `var(--led-${s.bars})` }}
          x={s.x0 + 0.25}
          y={STRIP_H - 2 - RISE[s.level]}
          width={Math.max(s.x1 - s.x0 - 0.5, 0.5)}
          height={RISE[s.level]}
        />
      ))}
    </g>
  )
}
