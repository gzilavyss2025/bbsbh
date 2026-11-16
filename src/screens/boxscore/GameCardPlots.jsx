import { glyphD } from '../../lib/pitch/pitchGlyph.js'
import { pitchMark } from '../../lib/pitch/pitchTypes.js'
import { locationScale, movementScale } from '../../lib/pitch/cardPlots.js'

// The pitcher game card's location and movement plots (#2969 slice 4). Every
// pitch is its pitchMark (docs/pitch-types.md); the geometry is
// lib/pitch/cardPlots.js, which the saved PNG paints from too. Rendered only
// inside the game card sheet, which mounts only after the box score's reveal.

const W = 120
const H = 140

function Mark({ code, x, y, r = 3.6 }) {
  const m = pitchMark(code)
  return (
    <path
      d={glyphD(m.shape, r)}
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      className={m.ring ? 'pgc__dot pgc__dot--ring' : 'pgc__dot'}
      style={{ '--pitch': m.color }}
    />
  )
}

export function GameCardPlots({ pitches, mix, season }) {
  const loc = locationScale(W, H)
  const mv = movementScale(W, H)
  const placed = pitches.filter((p) => p.loc)
  const moved = pitches.filter((p) => p.pfxX != null && p.pfxZ != null)
  if (!placed.length && !moved.length) return null
  return (
    <div className="pgc__plots">
      <figure className="pgc__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Where his ${placed.length} pitches crossed the plate, catcher's view`}>
          <rect className="pgc__zone" x={loc.zone.x} y={loc.zone.y} width={loc.zone.w} height={loc.zone.h} />
          {placed.map((p, i) => <Mark key={i} code={p.type} x={loc.x(p.loc.xn)} y={loc.y(p.loc.zn)} />)}
        </svg>
        <figcaption>{"Where · catcher's view"}</figcaption>
      </figure>
      <figure className="pgc__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="How each pitch moved, with his season average ringed">
          <line className="pgc__axis" x1={W / 2} y1="0" x2={W / 2} y2={H} />
          <line className="pgc__axis" x1="0" y1={H / 2} x2={W} y2={H / 2} />
          {moved.map((p, i) => <Mark key={i} code={p.type} x={mv.x(p.pfxX)} y={mv.y(p.pfxZ)} r={3.2} />)}
          {mix.map((m) => {
            const s = season?.get(m.type)
            if (s?.pfxX == null || s?.pfxZ == null) return null
            return <circle key={m.type} className="pgc__ring" cx={mv.x(s.pfxX)} cy={mv.y(s.pfxZ)} r="7" style={{ '--pitch': pitchMark(m.type).color }} />
          })}
        </svg>
        <figcaption>{season?.size ? 'Movement · ring = his season' : 'Movement'}</figcaption>
      </figure>
    </div>
  )
}
