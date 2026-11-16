import { glyphD } from '../../lib/pitch/pitchGlyph.js'
import { pitchMark } from '../../lib/pitch/pitchTypes.js'
import { locationScale, BALL_R } from '../../lib/pitch/cardPlots.js'
import { BallparkDiagram } from '../../components/ballpark/BallparkDiagram.jsx'

// The pitcher game card's two plots (#2969): where every pitch crossed the
// plate, and where the balls put in play off him landed on this park's field.
// Pitches are their pitchMark (docs/pitch-types.md); the location geometry is
// lib/pitch/cardPlots.js and the field is the box score hit chart's own drawing
// (components/ballpark/), both of which the saved PNG paints too. Rendered only
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

export function GameCardPlots({ pitches, park }) {
  const loc = locationScale(W, H)
  const placed = pitches.filter((p) => p.loc)
  const balls = pitches.filter((p) => p.ball)
  if (!placed.length && !balls.length) return null
  const hits = balls.filter((p) => p.hit).length
  return (
    <div className="pgc__plots">
      <figure className="pgc__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Where his ${placed.length} pitches crossed the plate, catcher's view`}>
          <rect className="pgc__zone" x={loc.zone.x} y={loc.zone.y} width={loc.zone.w} height={loc.zone.h} />
          {placed.map((p, i) => <Mark key={i} code={p.type} x={loc.x(p.loc.xn)} y={loc.y(p.loc.zn)} />)}
        </svg>
        <figcaption>{"Where · catcher's view"}</figcaption>
      </figure>
      {park && balls.length > 0 && (
        <figure className="pgc__plot pgc__spray">
          <BallparkDiagram layout={park} label={`Where the ${balls.length} balls in play off him landed: ${hits} ${hits === 1 ? 'hit' : 'hits'}`}>
            {balls.map((p, i) =>
              p.hit ? (
                <circle key={i} className="pgc__ball pgc__ball--hit" cx={p.ball.x} cy={p.ball.y} r={BALL_R.hit} />
              ) : (
                <circle key={i} className="pgc__ball" cx={p.ball.x} cy={p.ball.y} r={BALL_R.out} />
              ),
            )}
          </BallparkDiagram>
          <figcaption>In play · ● hit ○ out</figcaption>
        </figure>
      )}
    </div>
  )
}
