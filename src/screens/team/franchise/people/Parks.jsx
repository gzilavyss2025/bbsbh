import { Card } from '../../../../components/ui/frame/Card.jsx'
import { parksView } from './peopleView.js'

// Every home park the club has used, with its seasons (#2788; wireframe approved by Gary
// 2026-11-05). Built from the franchise-history spans, plus the temporary homes in the
// hand-curated file (#2959), each marked as such. MLB only: a club with no spans draws nothing.
export function Parks({ history, live, temporary }) {
  const parks = parksView(history, live, temporary)
  if (!parks.length) return null
  return (
    <Card frame="stamped" label="Parks" labelAs="h3" count={String(parks.length)} className="frpeople">
      <ul className="frpeople__list">
        {parks.map((p) => (
          <li key={p.id} className="frpeople__row">
            <span>
              <b className="frparks__name">{p.name}</b>
              <span className="frpeople__sub t-label">
                {[p.temporary ? `Temporary home${p.note ? `: ${p.note}` : ''}` : null, p.also.length ? `Formerly ${p.also.join(', ')}` : null, p.clubs.join(', '), p.mates.length ? `Shared with ${p.mates.join(', ')}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className="frpeople__fig">{p.years}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
