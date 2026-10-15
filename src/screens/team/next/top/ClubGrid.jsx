import { ordinal } from '../../../../lib/format.js'

// The win-percentage grid (the Plate approach's zone map, five wide): every club in the pool,
// best record first. The cells ink in on a diagonal, then the club's own cell stamps. `cells` is
// gridCells(); `title` names the pool ("All 30 clubs"); `name` is the viewed club's nickname.
export function ClubGrid({ cells, title, name }) {
  const place = cells.findIndex((c) => c.tier === 'me') + 1
  return (
    <div className="tnext__panel tnext__clubs">
      <p className="tnext__label"><span>{title} · win pct</span><span>{place ? `${ordinal(place)} of ${cells.length}` : ''}</span></p>
      <div className="tnext__map" role="img" aria-label={`${title} by win percentage.${place ? ` The ${name} are ${ordinal(place)}.` : ''}`}>
        {cells.map((c) => (
          <span key={c.id} className={`tnext__cell tnext__cell--${c.tier}`} style={{ '--i': c.i }}>{c.g}</span>
        ))}
      </div>
      <p className="tnext__mapkey"><span>1st</span><span>{ordinal(cells.length)}</span></p>
    </div>
  )
}
