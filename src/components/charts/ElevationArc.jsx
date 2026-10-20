import { useMemo } from 'react'
import { elevationArc } from '../../lib/ballpark/ballFlight.js'
import { round1 as r1 } from '../../lib/math/number.js'

// THE SIDE VIEW OF ONE BALL (#1875): its height against its distance from the
// plate, with the park's wall standing on the ball's own line. The ball-flight
// card's second view, behind its "Field Spray / Elevation Arc" toggle.
//
// Same contract as BallFlight.jsx: it fetches nothing and imports no
// reveal-only module, and `ball` arrives on an at-bat card that only exists
// inside its own half's SealBox reveal. lib/ballpark/ballFlight.js says what the
// arc does and does not claim.
//
// ONE SCALE FOR EVERY BALL. The frame is fixed (0 to 510 ft out, past any home
// run on record, and 0 to 200 ft up, over a high popup; the same feet per unit
// both ways), so a popup towers and a line drive
// skims at their true proportions, and two balls in one half-inning compare at a
// glance. Nothing rescales to fit the ball. The frame is in px at the sheet's
// width, so the type tokens read at their own size.

const X_MAX_FT = 510
const Z_MAX_FT = 200
const PAD = { left: 30, right: 8, top: 16, bottom: 24 }
const S = 0.545 // units per foot: (316 − 38) / 510
const W = PAD.left + PAD.right + X_MAX_FT * S
const H = PAD.top + PAD.bottom + Z_MAX_FT * S
const BASE = PAD.top + Z_MAX_FT * S

const X_TICKS = [100, 200, 300, 400]
const Z_TICKS = [50, 100, 150]

const px = (ft) => PAD.left + Math.min(ft, X_MAX_FT) * S
const py = (ft) => BASE - Math.min(ft, Z_MAX_FT) * S

// What a screen reader hears. A ground ball's distance is the few feet before a
// fielder got to it, which the facts strip drops too (BallFlight.jsx, carried).
function arcLabel(arc, ball) {
  if (arc.grounded) return 'Side view: on the ground'
  const peak = `Side view: peak about ${Math.round(arc.peak.z)} feet`
  return arc.atWall ? `${peak}, off the wall at ${Math.round(arc.wall.ft)} feet` : `${peak}, ${ball.distance} feet out`
}

export function ElevationPlot({ ball, park }) {
  // About 25 drag sims to fit the lift: once per ball, not once per render.
  const arc = useMemo(() => elevationArc(ball, park), [ball, park])
  if (!arc) return null
  const { pts, peak, wall, grounded } = arc
  const d = pts.map(([x, z], i) => `${i ? 'L' : 'M'} ${r1(px(x))} ${r1(py(z))}`).join(' ')
  const [endX, endZ] = pts[pts.length - 1]
  const ex = r1(px(endX))
  const ez = r1(py(endZ))
  return (
    <figure className="bflight__arc">
      <svg
        className="bflight__arcsvg"
        viewBox={`0 0 ${r1(W)} ${r1(H)}`}
        role="img"
        aria-label={arcLabel(arc, ball)}
      >
        {Z_TICKS.map((z) => (
          <g key={z}>
            <line className="bflight__arcgrid" x1={PAD.left} x2={r1(W - PAD.right)} y1={r1(py(z))} y2={r1(py(z))} />
            <text className="bflight__arctick" x={PAD.left - 4} y={r1(py(z))} textAnchor="end" dominantBaseline="middle">
              {z}
            </text>
          </g>
        ))}
        <line className="bflight__arcground" x1={PAD.left} x2={r1(W - PAD.right)} y1={r1(BASE)} y2={r1(BASE)} />
        {X_TICKS.map((x) => (
          <text key={x} className="bflight__arctick" x={r1(px(x))} y={r1(BASE + 18)} textAnchor="middle">
            {x === X_TICKS[X_TICKS.length - 1] ? `${x} ft` : x}
          </text>
        ))}
        {/* The wall on the ball's line, at the outline the plan view draws.
            Its height prints only at a measured or posted point. */}
        {wall && (
          <g>
            <line className="bflight__arcwall" x1={r1(px(wall.ft))} x2={r1(px(wall.ft))} y1={r1(BASE)} y2={r1(py(wall.height))} />
            {wall.label != null && (
              <text className="bflight__arctick" x={r1(px(wall.ft))} y={r1(py(wall.height) - 5)} textAnchor="middle">
                {`${Math.round(wall.label)} ft`}
              </text>
            )}
          </g>
        )}
        <path className={`bflight__path bflight__arcpath${grounded ? ' bflight__path--ground' : ''}`} d={d} />
        {peak && (
          <g>
            <circle className="bflight__arcpeak" cx={r1(px(peak.x))} cy={r1(py(peak.z))} r="3" />
            <text className="bflight__arcpeaklabel" x={r1(Math.max(px(peak.x), PAD.left + 44))} y={r1(py(peak.z) - 7)} textAnchor="middle">
              {`Peak ≈${Math.round(peak.z)} ft`}
            </text>
          </g>
        )}
        {ball.homeRun ? (
          <rect className="bflight__hr" x={ex - 5} y={ez - 5} width="10" height="10" transform={`rotate(45 ${ex} ${ez})`} />
        ) : (
          <circle className={ball.hit ? 'bflight__hit' : 'bflight__out'} cx={ex} cy={ez} r="5" />
        )}
      </svg>
      <figcaption className="bflight__arcnote t-label">
        {arc.modelled ? 'Arc modelled from speed, angle and distance' : 'Arc drawn from angle and distance'}
      </figcaption>
    </figure>
  )
}
