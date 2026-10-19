import { Headshot } from '../../../components/player/Headshot.jsx'
import { Rich } from '../Rich.jsx'

// THINGS TO WATCH (#2319): the edge's sentences, each under the player it is
// about (edge.js watchList). No new copy.
export function Watch({ items, players }) {
  if (!items.length) return null
  return (
    <section className="scout__watch" aria-labelledby="scout-watch">
      <h3 id="scout-watch" className="scout__watchhead">Things to watch</h3>
      <ol className="scout__watchlist">
        {items.map((w, i) => {
          const p = players[w.who]
          return (
            <li key={i} className="scout__watchitem">
              <span className="scout__watchn">{i + 1}</span>
              <Headshot personId={p.id ?? null} name={p.name} teamId={p.teamId ?? null} tint={false} className="scout__watchshot" />
              <div>
                <span className={`scout__tag scout__tag--${w.who}`}>{p.last}</span>
                <p className="scout__watchtext"><Rich parts={w.parts} /></p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
