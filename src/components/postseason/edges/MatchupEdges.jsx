import '../../../styles/postseason/primer-main.css'
import { pillSolidStyle } from '../../../lib/design/pillClass.js'
import { faceoffRoles } from '../../../lib/postseason/primer/matchupEdges.js'
import { Headshot } from '../../player/Headshot.jsx'
import { PlayerLink } from '../../player/PlayerLink.jsx'
import { Pill } from '../../ui/control/Pill.jsx'
import { EdgeCard } from './EdgeCard.jsx'

// MATCHUP EDGES (one of "Today's edges"): the hitters with a big career line
// against today's starter, and the batter the starter has owned. The rows come
// from the lineup page's career-matchups file (spoiler-free: it is built before
// the game), picked by lib/postseason/primer/matchupEdges.js. Renders nothing
// when no row clears a threshold.
//
//   edges  matchupEdges(...): [{ kind: 'hitter' | 'pitcher', id, name, vs, line }]
// A hitter edge is the field's green, a pitcher edge the clay: a soft ground with
// a deep ink, and the word says which.
const KIND = {
  hitter: { word: 'Hitter', style: pillSolidStyle({ ground: 'var(--field-soft)', text: 'var(--accent-positive-deep)' }) },
  pitcher: { word: 'Pitcher', style: pillSolidStyle({ ground: 'var(--clay-soft)', text: 'var(--clay-deep)' }) },
}

// One face-off side: photo, name, role pill. `flip` mirrors it for side B. The
// whole side is one PlayerLink; with no id the Headshot draws its monogram. The
// role word is fixed (side A hitter, side B pitcher); the side that holds the
// edge wears the solid pill, the other an outline one.
function Side({ id, name, role, edge, flip }) {
  return (
    <PlayerLink id={id} name={name} className={`seriesedges__side${flip ? ' seriesedges__side--b' : ''}`}>
      <Headshot personId={id} name={name} className="seriesedges__shot" />
      <span className="seriesedges__who2">
        <span className="seriesedges__sidename">{name}</span>
        <Pill fill={edge ? 'solid' : 'outline'} style={edge ? KIND[role].style : undefined}>
          {KIND[role].word}
        </Pill>
      </span>
    </PlayerLink>
  )
}

// variant "faceoff": both players per row (photo, name, role), the career line
// under them. The default keeps the one-line row.
export function MatchupEdges({ edges, variant }) {
  if (!edges?.length) return null
  const faceoff = variant === 'faceoff'
  return (
    <EdgeCard title="Matchup edges" note="Career vs starters" className="seriesedges__matchups">
      <ul className="seriesedges__rows">
        {edges.map((e) => {
          const { a, b } = faceoff ? faceoffRoles(e) : {}
          return faceoff ? (
            <li key={e.id} className="seriesedges__row seriesedges__row--faceoff">
              <Side id={e.id} name={e.name} role={a.role} edge={a.edge} />
              <span className="seriesedges__vs">vs</span>
              <Side id={e.vsId} name={e.vs} role={b.role} edge={b.edge} flip />
              <span className="seriesedges__line">{e.line}</span>
            </li>
          ) : (
            <li key={e.id} className="seriesedges__row">
              <Pill fill="solid" style={KIND[e.kind].style}>
                {KIND[e.kind].word}
              </Pill>
              <span>
                <PlayerLink id={e.id} className="seriesedges__name">
                  {e.name}
                </PlayerLink>{' '}
                vs {e.vs}
                <span className="seriesedges__line">{e.line}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </EdgeCard>
  )
}
