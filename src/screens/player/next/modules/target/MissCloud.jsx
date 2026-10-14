import { RIM_IN } from '../../../../../api/gloveTarget.js'
import { glyphD } from '../arsenal/PitchGlyph.jsx'

// One plot, 320 units wide and capped at 320px, so a unit is a CSS pixel and the ring labels keep their token size.
const VB = 320
const C = VB / 2
const PAD = 22
const px = (inches) => (inches * (C - PAD)) / RIM_IN

// The pitch's mark as a path: its shape and colour come from pitchMark (the colour rides a custom property).
export function MarkPath({ mark, r }) {
  return <path className={`target__glyph${mark.ring ? ' target__glyph--ring' : ''}`} d={glyphD(mark.shape, r)} style={{ '--pitch': mark.color }} />
}

// The miss cloud: the glove is the centre for every dot. A ring past the rim is drawn on the rim (the reader clamps it).
export function MissCloud({ cloud }) {
  return (
    <svg className="target__plot" viewBox={`0 0 ${VB} ${VB}`} role="img" aria-label={cloud.aria}>
      {cloud.rings.map((r) => (
        <g key={r}>
          <circle className="target__ring" cx={C} cy={C} r={px(r)} />
          <text className="target__ringlabel" x={C + 3} y={C - px(r) - 3}>
            {r}&#8243;
          </text>
        </g>
      ))}
      {cloud.league != null && <circle className="target__league" cx={C} cy={C} r={px(cloud.league)} />}
      {cloud.dots.map((d, i) => {
        const x = C + px(d.x)
        const y = C + px(d.y)
        return cloud.mark ? (
          <g key={i} transform={`translate(${x} ${y})`} opacity={d.clamped ? 0.5 : 0.8}>
            <MarkPath mark={cloud.mark} r={3.6} />
          </g>
        ) : (
          <circle key={i} className={`target__dot${d.clamped ? ' target__dot--rim' : ''}`} cx={x} cy={y} r="3.4" />
        )
      })}
      <circle className="target__median" cx={C} cy={C} r={px(cloud.median)} />
      <rect className="target__glove" x={C - 5} y={C - 5} width="10" height="10" />
    </svg>
  )
}
