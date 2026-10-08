import { pillSolidStyle } from '../../../lib/design/pillClass.js'
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
  hitter: { word: 'Hitter', style: pillSolidStyle({ ground: 'var(--field-soft)', text: 'var(--field-deep)' }) },
  pitcher: { word: 'Pitcher', style: pillSolidStyle({ ground: 'var(--clay-soft)', text: 'var(--clay-deep)' }) },
}

export function MatchupEdges({ edges }) {
  if (!edges?.length) return null
  return (
    <EdgeCard title="Matchup edges" note="Career vs today's starters" className="seriesedges__matchups">
      <ul className="seriesedges__rows">
        {edges.map((e) => (
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
        ))}
      </ul>
    </EdgeCard>
  )
}
