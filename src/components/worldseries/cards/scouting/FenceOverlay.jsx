import { wallStroke } from '../../../../lib/ballpark/ballparkGeometry.js'
import { geometryOf } from '../../../../lib/ballpark/layout/parkWindow.js'
import { round2 } from '../../../../lib/math/number.js'
import { overlayLabels, overlayWindow } from '../../../../lib/postseason/worldseries/scouting/fenceOverlay.js'
import { InfieldBags, InfieldDirt } from '../../../ballpark/BallparkInfield.jsx'

// THE FENCE OVERLAY (Park fit, 2026-10-21): the Series clubs' parks in one drawing. Every park shares
// home plate and one scale, so the infield is drawn once and each park adds only its own ground, foul
// lines, wall and signs. A park is "on" when it is the one shown or both are. An off park is not removed:
// its parts stay mounted and fade (styles/worldseries/fit.css), and its wall draws back, so a tap on the
// park control is a change the eye can follow. The map and the table below it are one state, held by ParkFit.
//
//   parks  [{ clubId, layout, ink, on }] in table order (parkFit.js parkView's `lit`); layout is one resolved
//          configuration, and `on` says whether the park is drawn now
//   both   true when both parks are shown: the view that moves signs apart and keeps the wall heights off
//   label  the drawing's name for a screen reader
//
// Pure drawing: static park geometry, no score, so it needs no gate (ADR-0034).
export function FenceOverlay({ parks, both, label, className = '' }) {
  const layouts = parks.map((p) => p.layout)
  const gs = layouts.map(geometryOf)
  const signs = overlayLabels(layouts)
  return (
    <svg
      className={`bpdiagram ww-fence ${className}`.trim()}
      viewBox={overlayWindow(layouts).viewBox}
      role="img"
      aria-label={label}
      data-view={both ? 'both' : 'one'}
    >
      {/* Ground, the infield, the foul lines, the bags: the order BallparkDiagram draws them in. */}
      {parks.map((p, i) => (
        <g key={`ground-${p.clubId}`} className="ww-fence__ground" data-on={p.on}>
          <path d={gs[i].foul} className="bpdiagram__foul" />
          <path d={gs[i].fair} className="bpdiagram__grass" />
          <path d={gs[i].track} className="bpdiagram__track ww-fence__track" />
        </g>
      ))}
      <InfieldDirt g={gs[0]} />
      {parks.map((p, i) => (
        <g key={`lines-${p.clubId}`} className="ww-fence__lines" data-on={p.on}>
          <path d={gs[i].foulLineL} className="bpdiagram__line" />
          <path d={gs[i].foulLineR} className="bpdiagram__line" />
        </g>
      ))}
      <InfieldBags g={gs[0]} />
      {/* The wall: each segment is its own path at the weight of its wall height, normalised to a
          length of 1 so one dash rule can draw it in from the left-field pole. */}
      {parks.map((p, i) => (
        <g key={`wall-${p.clubId}`} className="ww-fence__wall" data-ink={p.ink} data-on={p.on}>
          {gs[i].fenceSegs.map((s, j) => (
            <path
              key={j}
              d={s.d}
              pathLength="1"
              className="bpdiagram__wall ww-fence__seg"
              style={{ strokeWidth: wallStroke(s.h), '--i': j }}
            />
          ))}
        </g>
      ))}
      {parks.map((p, i) => (
        <g key={`signs-${p.clubId}`} className="ww-fence__signs" data-ink={p.ink} data-on={p.on}>
          {signs[i].map((s) => (
            <text
              key={s.slot}
              className="bpdiagram__dist ww-fence__dist"
              x={round2(s.x)}
              y={round2(s.y)}
              style={{ '--dx': round2(s.dx), '--dy': round2(s.dy) }}
            >
              {s.t}′
            </text>
          ))}
          {gs[i].wallTags.map((w, j) => (
            <text key={j} className="bpdiagram__wallh ww-fence__wallh" x={round2(w.x)} y={round2(w.y)}>
              {w.h}′
            </text>
          ))}
        </g>
      ))}
    </svg>
  )
}
