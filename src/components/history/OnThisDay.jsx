import { fetchOnThisDayShard } from '../../api/history/onThisDay.js'
import { useAsync } from '../../hooks/useAsync.js'
import { pickPeople } from '../../lib/history/pick.js'
import { Card } from '../ui/frame/Card.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { PeopleList } from './PeopleList.jsx'
import '../../styles/history/history.css'

// The "On this day" strip at the top of the slate: who was born, and who debuted, on
// this calendar day in past years. History about people (ADR-0100, ADR-0034): a
// separate block ABOVE the slate's cells, never inside one and never sharing a
// component with one, so no score cell can reach it. `dateStr` is the slate's own
// YYYY-MM-DD, not the clock. A failed or empty load renders nothing.
const ROWS = [['born', 'Born'], ['debuted', 'Debut']]

export function OnThisDay({ dateStr }) {
  const mmdd = dateStr.slice(5)
  const { data: shard } = useAsync(() => fetchOnThisDayShard(mmdd), [mmdd])
  const rows = ROWS.map(([key, label]) => [label, pickPeople(shard?.[key], 3)]).filter(([, p]) => p.length)
  if (!rows.length) return null
  return (
    <Card head={<SectionHead as="h2">On this day</SectionHead>} className="onthisday">
      <div className="onthisday__rows">
        {rows.map(([label, people]) => (
          <p key={label} className="onthisday__row">
            <span className="onthisday__label">{label}</span>
            <span><PeopleList people={people} /></span>
          </p>
        ))}
        {shard.credit?.length > 0 && <p className="onthisday__credit">{shard.credit.join(' ')}</p>}
      </div>
    </Card>
  )
}
