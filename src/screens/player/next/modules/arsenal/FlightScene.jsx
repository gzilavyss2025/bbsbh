import { useMemo } from 'react'
import { PLATE_Z, makeCamera, project, sceneD, trailD } from './flightView.js'
import { GlyphPath } from './PitchGlyph.jsx'

const BALL = 0.121 // ft, the ball's radius

// The park seen from one camera, with each pitch type's path drawn up to `s` seconds into its flight.
// `items` are arsenal rows with a path. Under `solo` the other paths are drawn whole and faint; under
// `ghost` each drawn path gets its gravity-only path dashed beside it. Colour and shape are the
// pitchMark's (docs/pitch-types.md), passed in on each row.
export function FlightScene({ camera, w, h, items, s, solo = null, ghost = false, label }) {
  const cam = useMemo(() => makeCamera(camera, w, h), [camera, w, h])
  const park = useMemo(() => sceneD(cam), [cam])
  return (
    <svg className="arsenal__scene" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <path className="arsenal__ground" d={park.grid} />
      <path className="arsenal__ground arsenal__ground--mound" d={park.mound} />
      <path className="arsenal__rubber" d={park.rubber} />
      <path className="arsenal__plate" d={park.plate} />
      <path className="arsenal__zone" d={park.zone} />
      {items.map((it) => {
        const faint = solo != null && solo !== it.code
        const t = faint ? it.path.T : Math.min(s, it.path.T)
        const landed = !faint && s >= it.path.T
        const ball = !faint && !landed ? project(cam, it.path.at(t)) : null
        const dot = landed && it.landing ? project(cam, [it.landing.x, it.landing.h, PLATE_Z]) : null
        const d = trailD(cam, it.path.at, t)
        return (
          <g key={it.code} opacity={faint ? 0.25 : 1}>
            {ghost && !faint && <path className="arsenal__gravity" d={trailD(cam, it.path.grav, t)} />}
            <path className="arsenal__halo" d={d} pathLength="1" />
            <path className="arsenal__trail" d={d} pathLength="1" style={{ '--pitch': it.mark.color }} />
            {ball && (
              <circle
                className="arsenal__ball"
                cx={ball.x}
                cy={ball.y}
                r={Math.max(3.4, ball.k * BALL * 1.3)}
                style={{ '--pitch': it.mark.color }}
              />
            )}
            {dot && (
              <g transform={`translate(${dot.x.toFixed(1)} ${dot.y.toFixed(1)}) scale(${Math.max(0.5, (dot.k * BALL) / 2.4).toFixed(2)})`}>
                <GlyphPath mark={it.mark} r={5} />
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
