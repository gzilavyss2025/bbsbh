import { wallStroke } from '../../lib/ballpark/ballparkGeometry.js'
import { geometryOf, parkWindow } from '../../lib/ballpark/layout/parkWindow.js'
import { round2 } from '../../lib/math/number.js'
import { InfieldBags, InfieldDirt } from './BallparkInfield.jsx'

// The scorebook's ballpark drawing: an ink-on-manila sketch of the full field —
// infield diamond, outfield grass, the warning track hugging the fence, and the
// surrounding foul ground. The fence is the park's REAL wall (straight segments,
// true corners — Fenway's Monster, PNC's angular RF) when we have the digitized
// polygon, else a straight five-point outline; either way it's drawn thicker where
// the wall is taller. Geometry (and the fixed-scale reasoning) lives in
// lib/ballpark/ballparkGeometry.js; this file just paints it. Pure and spoiler-free.

// `viewBox` and `label` exist for the hit chart, which reuses this drawing as a
// plot ground rather than as a dimensions diagram: it crops the shared plot
// window, and it is not "a ballpark diagram" to a screen reader — it is a spray
// chart. Left out, the window is this park's own (layout/parkWindow.js): the
// frame with the empty sky above its highest mark cut off, never a rescale.
// `layout` is one resolved configuration (lib/ballpark/layout/resolveLayout.js):
// every card that draws a park passes the same object for the same game, so
// the same date draws the same wall everywhere (#1859).
export function BallparkDiagram({
  layout,
  className = '',
  viewBox,
  label = 'Ballpark field dimensions diagram',
  children = null,
}) {
  const g = geometryOf(layout)
  return (
    <svg
      className={`bpdiagram ${className}`}
      viewBox={viewBox ?? parkWindow(layout).viewBox}
      role="img"
      aria-label={label}
    >
      <path d={g.foul} className="bpdiagram__foul" />
      <path d={g.fair} className="bpdiagram__grass" />
      {/* Warning track: a band of constant width running the whole fence, inset
          in from the wall — the fence is drawn over its outer edge. */}
      <path d={g.track} className="bpdiagram__track" />
      {/* The skinned infield, the same in every park (BallparkInfield.jsx), then the
          foul lines, then the bases and plate on top of them. */}
      <InfieldDirt g={g} />
      <path d={g.foulLineL} className="bpdiagram__line" />
      <path d={g.foulLineR} className="bpdiagram__line" />
      <InfieldBags g={g} />

      {/* Fence — each segment stroked to its local wall height */}
      {g.fenceSegs.map((s, i) => (
        <path key={i} d={s.d} className="bpdiagram__wall" style={{ strokeWidth: wallStroke(s.h) }} />
      ))}

      {/* Distance labels outside the fence */}
      {g.labels.map((l, i) => (
        <text key={i} className="bpdiagram__dist" x={round2(l.x)} y={round2(l.y)}>
          {l.t}′
        </text>
      ))}

      {/* Wall-height tags inside the fence */}
      {g.wallTags.map((w, i) => (
        <text key={i} className="bpdiagram__wallh" x={round2(w.x)} y={round2(w.y)}>
          {w.h}′
        </text>
      ))}
      {/* An overlay drawn LAST, so a caller's own marks sit on top of the park
          rather than under the fence. Plain children, not a render function:
          a render function in this codebase means a spoiler gate (SealBox),
          and this is only composition. The caller works in the same fixed
          620x560 space the geometry above uses — feet map 1:1 to SVG units
          off HOME (ballparkGeometry.js's header) — so it needs no scale of
          its own. The hit chart's batted-ball dots are the first user. */}
      {children}
    </svg>
  )
}
