import { wallStroke } from '../../../../lib/ballpark/ballparkGeometry.js'
import { geometryOf } from '../../../../lib/ballpark/layout/parkWindow.js'
import { overlayLabels, overlayWindow } from '../../../../lib/postseason/worldseries/scouting/fenceOverlay.js'
import { InfieldBags, InfieldDirt } from '../../../ballpark/BallparkInfield.jsx'

const f = (n) => Math.round(n * 100) / 100

// THE FENCE OVERLAY (Park fit, 2026-10-21): the Series clubs' parks in one drawing. Every park shares
// home plate and one scale, so the infield is drawn once and each park adds only its own ground, foul
// lines, wall and signs. A park is "on" when it is the one shown or both are. An off park is not removed:
// its parts stay mounted and fade (styles/worldseries/fit.css), and its wall draws back, so a tap on the
// park control is a change the eye can follow. The map and the table below it are one state, held by ParkFit.
//
//   parks  [{ clubId, layout }] in table order (parkFit.js fitParks); layout is one resolved configuration
//   show   'both' or the clubId of the park to show alone
//   label  the drawing's name for a screen reader
//
// Pure drawing: static park geometry, no score, so it needs no gate (ADR-0034).
export function FenceOverlay({ parks, show, label, className = '' }) {
  const layouts = parks.map((p) => p.layout)
  const gs = layouts.map(geometryOf)
  const signs = overlayLabels(layouts)
  const both = show === 'both'
  const on = (i) => both || parks[i].clubId === show
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
        <g key={`ground-${p.clubId}`} className="ww-fence__ground" data-ink={p.ink} data-on={on(i)}>
          <path d={gs[i].foul} className="bpdiagram__foul" />
          <path d={gs[i].fair} className="bpdiagram__grass" />
          <path d={gs[i].track} className="bpdiagram__track ww-fence__track" />
        </g>
      ))}
      <InfieldDirt g={gs[0]} />
      {parks.map((p, i) => (
        <g key={`lines-${p.clubId}`} className="ww-fence__lines" data-ink={p.ink} data-on={on(i)}>
          <path d={gs[i].foulLineL} className="bpdiagram__line" />
          <path d={gs[i].foulLineR} className="bpdiagram__line" />
        </g>
      ))}
      <InfieldBags g={gs[0]} />
      {/* The wall: each segment is its own path at the weight of its wall height, normalised to a
          length of 1 so one dash rule can draw it in from the left-field pole. */}
      {parks.map((p, i) => (
        <g key={`wall-${p.clubId}`} className="ww-fence__wall" data-ink={p.ink} data-on={on(i)}>
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
        <g key={`signs-${p.clubId}`} className="ww-fence__signs" data-ink={p.ink} data-on={on(i)}>
          {signs[i].map((s) => (
            <text
              key={s.slot}
              className="bpdiagram__dist ww-fence__dist"
              x={f(s.x)}
              y={f(s.y)}
              data-moved={s.dx !== 0 || s.dy !== 0}
              style={{ '--dx': f(s.dx), '--dy': f(s.dy) }}
            >
              {s.t}′
            </text>
          ))}
          {gs[i].wallTags.map((w, j) => (
            <text key={j} className="bpdiagram__wallh ww-fence__wallh" x={f(w.x)} y={f(w.y)}>
              {w.h}′
            </text>
          ))}
        </g>
      ))}
    </svg>
  )
}
