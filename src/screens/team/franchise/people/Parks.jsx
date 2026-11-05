import { Card } from '../../../../components/ui/frame/Card.jsx'
import { parksView } from './peopleView.js'

// Every home park the club has used, with its seasons (#2788; wireframe approved by Gary
// 2026-11-05). Built from the franchise-history spans, so a one-off neutral site is not listed,
// and the card says so in one line. MLB only: a club with no spans draws nothing.
export function Parks({ history, live }) {
  const parks = parksView(history, live)
  if (!parks.length) return null
  return (
    <Card frame="stamped" label="Parks" labelAs="h3" count={String(parks.length)} className="frpeople">
      <ul className="frpeople__list">
        {parks.map((p) => (
          <li key={p.id} className="frpeople__row">
            <span>
              <b className="frparks__name">{p.name}</b>
              <span className="frpeople__sub t-label">
                {[p.also.length ? `Also named ${p.also.join(', ')}` : null, p.clubs.join(', '), p.mates.length ? `Shared with ${p.mates.join(', ')}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className="frpeople__fig">{p.years}</span>
          </li>
        ))}
      </ul>
      <p className="hint frparks__foot">Home parks by season. A one-off neutral site is not listed.</p>
    </Card>
  )
}
