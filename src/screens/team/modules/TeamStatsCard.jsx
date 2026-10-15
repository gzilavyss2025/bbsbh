import { SectionHead } from '../../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'
import { isoToday } from '../../../lib/dates.js'
import { DOW_LABELS } from '../data/shared.js'

// Sunday-first; the day-of-week record itself is pure, in data/shared.js (loadNumbers.js
// imports it, and a loader must not import a .jsx card).
export { DOW_LABELS }
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Same UTC-parse convention as dayOfWeekRecord's own apiDate → weekday
// mapping (and isoToday() itself), so "today" lines up with whichever row
// that same calendar date would have tallied into.
export function todayDowLabel() {
  return DOW_LABELS[new Date(`${isoToday()}T00:00:00Z`).getUTCDay()]
}

export function TeamStats({ title, stats, note = 'rank out of 30', highlightKey }) {
  return (
    <Card
      as="div"
      frame="ledger"
      body="flush"
      className="tstats"
      head={
        <SectionHead look="band" club note={note}>
          {title}
        </SectionHead>
      }
    >
      <div className="tstats__body">
        <div className="tstats__grid">
          {stats.map((s) => (
            <div
              key={s.k}
              className={`tstatrow${s.extreme ? ` tstatrow--${s.extreme}` : ''}${s.k === highlightKey ? ' tstatrow--today' : ''}`}
            >
              <span className="tstatrow__k">{s.k}</span>
              <span className="tstatrow__v">{s.v}</span>
              <span className={`tstatrow__r${s.tone ? ` tstatrow__r--${s.tone}` : ''}`}>{s.rank}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
