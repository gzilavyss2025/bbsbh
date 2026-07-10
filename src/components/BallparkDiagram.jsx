import { buildFieldGeometry, wallStroke, VIEWBOX, HOME } from '../lib/ballparkGeometry.js'

// The scorebook's ballpark drawing: an ink-on-manila sketch of the full field —
// infield diamond, outfield grass, the warning track hugging the fence, and the
// surrounding foul ground. The fence is the park's REAL wall (straight segments,
// true corners — Fenway's Monster, PNC's angular RF) when we have the digitized
// polygon, else a straight five-point outline; either way it's drawn thicker where
// the wall is taller. Geometry (and the fixed-scale reasoning) lives in
// lib/ballparkGeometry.js; this file just paints it. Pure and spoiler-free.

const f = (n) => Math.round(n * 100) / 100

export function BallparkDiagram({ dist, wall, arc, className = '' }) {
  const g = buildFieldGeometry(dist, wall, arc)
  return (
    <svg
      className={`bpdiagram ${className}`}
      viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
      role="img"
      aria-label="Ballpark field dimensions diagram"
    >
      <path d={g.foul} className="bpdiagram__foul" />
      <path d={g.fair} className="bpdiagram__grass" />
      {/* Warning track: a band of constant width running the whole fence, inset
          in from the wall — the fence is drawn over its outer edge. */}
      <path d={g.track} className="bpdiagram__track" />
      {/* Infield: a dirt "skin" fanning out from home past the bases (capped by
          the 95'-off-the-mound arc), grass cut into the middle of it, dirt
          circles at the mound/home plate, and dirt running lanes on the
          baselines — the classic skinned-infield look, not a plain dirt diamond. */}
      <path d={g.skin} className="bpdiagram__dirt" />
      <path d={g.grassDiamond} className="bpdiagram__grass" />
      <path
        d={g.baselineDirtL}
        className="bpdiagram__dirt bpdiagram__baseline"
        style={{ strokeWidth: g.baselineDirtW }}
      />
      <path
        d={g.baselineDirtR}
        className="bpdiagram__dirt bpdiagram__baseline"
        style={{ strokeWidth: g.baselineDirtW }}
      />
      <circle className="bpdiagram__dirt" cx={f(g.mound.x)} cy={f(g.mound.y)} r={g.moundDirtR} />
      <circle className="bpdiagram__dirt" cx={f(HOME.x)} cy={f(HOME.y)} r={g.homeDirtR} />
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
      <rect
        className="bpdiagram__base"
        x={f(g.mound.x - 4)}
        y={f(g.mound.y - 1.5)}
        width="8"
        height="3"
      />
      <polygon
        className="bpdiagram__base"
        points={`${HOME.x - 5},${HOME.y - 2} ${HOME.x + 5},${HOME.y - 2} ${HOME.x + 5},${HOME.y + 3} ${HOME.x},${HOME.y + 7} ${HOME.x - 5},${HOME.y + 3}`}
      />

      {/* Fence — each segment stroked to its local wall height */}
      {g.fenceSegs.map((s, i) => (
        <path key={i} d={s.d} className="bpdiagram__wall" style={{ strokeWidth: wallStroke(s.h) }} />
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
