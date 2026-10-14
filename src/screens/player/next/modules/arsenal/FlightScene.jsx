import { useMemo } from 'react'
import { PLATE_Z, makeCamera, project, sceneD, trailD } from './flightView.js'
import { GlyphPath } from './PitchGlyph.jsx'

const BALL = 0.121 // ft, the ball's radius
const SEAM_R = 4.6 // the board's ball radius, which SEAM is drawn for
const SEAM = 'M-3.2 -.9Q0 -3.5 3.2 -.9M-3.2 .9Q0 3.5 3.2 .9'

// The park seen from one camera, with each pitch type's path drawn up to `s` seconds into its flight.
// `items` are arsenal rows with a path. Under `solo` the other paths are drawn whole as faint ghosts (0.22); under
// `ghost` each drawn path gets its gravity-only path dashed beside it. Colour and shape are the
// pitchMark's (docs/pitch-types.md), passed in on each row. `beats` (the Arsenal card's timeline,
// timeline.js) sets, per code, how far each path is drawn, its opacity, the ball's scale, spin and fade
// and the landing ripple; `ring` is the release ring and `ticks` the flat camera's distance scale.
export function FlightScene({ camera, w, h, items, s, solo = null, ghost = false, label, beats = null, ring = null, ticks = null }) {
  const cam = useMemo(() => makeCamera(camera, w, h), [camera, w, h])
  const park = useMemo(() => sceneD(cam), [cam])
  // The release point the ring grows from: the middle of the paths' first points.
  const release = useMemo(() => {
    const ps = items.map((it) => project(cam, it.path.at(0))).filter(Boolean)
    return ps.length ? { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length } : null
  }, [cam, items])
  return (
    <svg className="arsenal__scene" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <path className="arsenal__ground" d={park.grid} />
      <path className="arsenal__ground arsenal__ground--mound" d={park.mound} />
      <path className="arsenal__rubber" d={park.rubber} />
      <path className="arsenal__plate" d={park.plate} />
      <path className="arsenal__zone" d={park.zone} />
      {ticks && cam.flat && ticks.map((k, i) => {
        const x = (cam.ox - cam.sx * 10 * i).toFixed(1)
        return (
          <g key={i}>
            <path className="arsenal__tick" d={`M${x} ${cam.oy.toFixed(1)}v5`} pathLength="1" style={{ strokeDashoffset: (1 - k.draw).toFixed(4) }} />
            <text className="arsenal__ticklabel" x={x} y={(cam.oy + 12).toFixed(1)} textAnchor="middle" fontSize="6.5" opacity={k.label.toFixed(3)}>
              {i ? `${i * 10}${i === 5 ? ' ft' : ''}` : '0'}
            </text>
          </g>
        )
      })}
      {items.map((it) => {
        const b = beats?.get(it.code)
        const faint = b ? b.ghost : solo != null && solo !== it.code
        const t = b ? it.path.T * b.u : faint ? it.path.T : Math.min(s, it.path.T)
        const landed = b ? b.landed : !faint && s >= it.path.T
        const ball = (b ? b.ball.o > 0 : !faint && !landed) ? project(cam, it.path.at(t)) : null
        const dot = landed && it.landing ? project(cam, [it.landing.x, it.landing.h, PLATE_Z]) : null
        const d = trailD(cam, it.path.at, t)
        const r = ball ? Math.max(3.4, ball.k * BALL * 1.3) : 0
        const paint = { '--pitch': it.mark.color }
        return (
          <g key={it.code} className="arsenal__path">
            <g opacity={(b ? b.trail : faint ? 0.22 : 1).toFixed(3)}>
              {ghost && !faint && <path className="arsenal__gravity" d={trailD(cam, it.path.grav, t)} />}
              <path className="arsenal__halo" d={d} pathLength="1" />
              <path className="arsenal__trail" d={d} pathLength="1" style={paint} />
            </g>
            {ball && (
              <g
                transform={`translate(${ball.x.toFixed(2)} ${ball.y.toFixed(2)})${b ? ` scale(${b.ball.k.toFixed(3)}) rotate(${b.ball.spin.toFixed(1)})` : ''}`}
                opacity={b ? b.ball.o.toFixed(3) : undefined}
                style={paint}
              >
                <circle className="arsenal__ball" r={r} />
                {b && <path className="arsenal__seam" d={SEAM} transform={`scale(${(r / SEAM_R).toFixed(3)})`} />}
              </g>
            )}
            {dot && (
              <g transform={`translate(${dot.x.toFixed(1)} ${dot.y.toFixed(1)}) scale(${Math.max(0.5, (dot.k * BALL) / 2.4).toFixed(2)})`}>
                <GlyphPath mark={it.mark} r={5} />
              </g>
            )}
            {dot && b && b.ripple.o > 0 && (
              <circle className="arsenal__ripple" cx={dot.x.toFixed(1)} cy={dot.y.toFixed(1)} r={b.ripple.r.toFixed(2)} opacity={b.ripple.o.toFixed(3)} style={paint} />
            )}
          </g>
        )
      })}
      {ring && release && ring.o > 0 && (
        <circle className="arsenal__ring" cx={release.x.toFixed(1)} cy={release.y.toFixed(1)} r={ring.r.toFixed(2)} opacity={ring.o.toFixed(3)} />
      )}
    </svg>
  )
}
