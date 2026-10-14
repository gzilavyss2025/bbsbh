import { pitchMark } from '../../../../../lib/pitch/pitchTypes.js'
import { glyphD } from '../arsenal/PitchGlyph.jsx'

// A pitch's mark from pitchMark(code): the family is the shape, the pitch the colour (--pitch), a ring hollow.
export function Mark({ code, r }) {
  const mark = pitchMark(code)
  return <path className={`command__mark${mark.ring ? ' command__mark--ring' : ''}`} d={glyphD(mark.shape, r)} style={{ '--pitch': mark.color }} />
}

// The 5×5 map, camera view from behind him: 25 cell buttons in a square, ink heat per cell, then one
// SVG over them for the zone frame (the middle nine), the dashed heart and each pitch's centroid mark.
// The cells arrive in screen order from commandModView; `cell` is the picked stored index.
export function CommandMapSvg({ view, cell, onCell }) {
  return (
    <div className="command__zone">
      <span className="command__side-word">High</span>
      <div className="command__map" role="group" aria-label={`Command map, ${view.label}`}>
        {view.cells.map((c) => (
          <button
            key={c.i}
            type="button"
            className={`command__cell command__cell--h${c.step}`}
            aria-pressed={c.i === cell}
            aria-label={c.label}
            onClick={() => onCell(c.i)}
          >
            {c.n || ''}
          </button>
        ))}
        <svg className="command__overlay" viewBox="0 0 50 50" aria-hidden="true">
          <rect className="command__frame" x="10" y="10" width="30" height="30" />
          <rect className="command__heart" x="20" y="20" width="10" height="10" />
          {view.marks.map((m) => (
            <g key={m.code} transform={`translate(${m.x / 2} ${m.y / 2})`}>
              <Mark code={m.code} r={1.6} />
              <text className="command__markcode" x="2.4" y="0.8" fontSize="2.2">
                {m.code}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="command__foot">
        <span>
          <span className={`command__box${view.stand === 'L' ? ' command__box--on' : ''}`}>LHB</span>
          <span className="command__side-word">1B side</span>
        </span>
        <span className="command__side-word">Low</span>
        <span>
          <span className="command__side-word">3B side</span>
          <span className={`command__box${view.stand === 'R' ? ' command__box--on' : ''}`}>RHB</span>
        </span>
      </div>
    </div>
  )
}
