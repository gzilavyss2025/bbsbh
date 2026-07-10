import { buildFieldGeometry, wallStroke, VIEWBOX, HOME } from '../lib/ballparkGeometry.js'

// The scorebook's ballpark drawing: an ink-on-manila sketch of the full field —
// infield diamond, outfield grass, the warning track hugging the fence, and the
// surrounding foul ground — with the outfield wall shaped TO SCALE from the park's
// five posted distances and the fence drawn thicker where the wall is taller (so
// Fenway's 37' Monster reads as a wall, not a line). Geometry (and the reasoning
// behind the fixed scale) lives in lib/ballparkGeometry.js; this file just paints
// it. Pure and spoiler-free — field geometry carries no score.

const f = (n) => Math.round(n * 100) / 100

export function BallparkDiagram({ dist, wall, className = '' }) {
  const g = buildFieldGeometry(dist, wall)
  return (
    <svg
      className={`bpdiagram ${className}`}
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      role="img"
      aria-label="Ballpark field dimensions diagram"
    >
      <path d={g.foul} className="bpdiagram__foul" />
      <path d={g.fair} className="bpdiagram__grass" />
      <path d={g.track} className="bpdiagram__track" />
      <path d={g.infield} className="bpdiagram__dirt" />
      <path d={g.foulLineL} className="bpdiagram__line" />
      <path d={g.foulLineR} className="bpdiagram__line" />

      {/* Bases + mound */}
      {g.bases.map((b, i) => (
        <rect
          key={i}
          className="bpdiagram__base"
          x={f(b.x - 4)}
          y={f(b.y - 4)}
          width="8"
          height="8"
          transform={`rotate(45 ${f(b.x)} ${f(b.y)})`}
        />
      ))}
      <circle className="bpdiagram__mound" cx={f(g.mound.x)} cy={f(g.mound.y)} r="6" />
      <polygon
        className="bpdiagram__base"
        points={`${HOME.x - 5},${HOME.y - 2} ${HOME.x + 5},${HOME.y - 2} ${HOME.x + 5},${HOME.y + 3} ${HOME.x},${HOME.y + 7} ${HOME.x - 5},${HOME.y + 3}`}
      />

      {/* Fence — stroke width scales with wall height */}
      {g.wallSegs.map((s, i) => (
        <path
          key={i}
          d={s.d}
          className="bpdiagram__wall"
          style={{ strokeWidth: wallStroke(s.h) }}
        />
      ))}

      {/* Distance labels outside the fence */}
      {g.labels.map((l, i) => (
        <text key={i} className="bpdiagram__dist" x={f(l.x)} y={f(l.y)}>
          {l.t}′
        </text>
      ))}

      {/* Wall-height tags inside the fence */}
      {g.wallTags.map((w, i) => (
        <text key={i} className="bpdiagram__wallh" x={f(w.x)} y={f(w.y)}>
          {w.h}′
        </text>
      ))}
    </svg>
  )
}
