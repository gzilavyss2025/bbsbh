import { W, PLOT_L, PLOT_W } from './plot.js'
import { pressureStrip } from './strip.js'

// The pressure strip under the plot (strip.js has the rule). Decorative: the
// rows below and the slider already say each play's pressure in words.
const SH = 14
const RISE = { low: 4, mid: 7, high: 10 }

export function PressureStrip({ points, cutoffs }) {
  const segs = pressureStrip(points, cutoffs, { left: PLOT_L, width: PLOT_W })
  if (segs.length === 0) return null
  return (
    <svg className="winprob__strip" viewBox={`0 0 ${W} ${SH}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect className="winprob__strip-panel" x={0} y={0} width={W} height={SH} />
      {segs.map((s) => (
        <rect
          key={s.idx}
          className={`winprob__strip-seg is-${s.level}`}
          style={s.level === 'low' ? undefined : { fill: `var(--led-${s.bars})` }}
          x={s.x0 + 0.25}
          y={SH - 2 - RISE[s.level]}
          width={Math.max(s.x1 - s.x0 - 0.5, 0.5)}
          height={RISE[s.level]}
        />
      ))}
    </svg>
  )
}
