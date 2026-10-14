import { useMemo } from 'react'
import { staffGridFor } from '../../../../api/workload.js'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { splitDisplayName } from '../../../../api/person.js'
import { FoldCard } from './FoldCard.jsx'

const DAY = 'SMTWTFS'
const dayLetter = (iso) => DAY[new Date(`${iso}T00:00:00Z`).getUTCDay()]

// The other club's bullpen over the last week, one colour: a filled cell is a day he
// pitched (with the count), an empty one a day of rest, and today is dashed. It describes
// "now" and shows only within three days of the workload file's date (`boardGameDate`):
// completed appearances only, so nothing here is this game's. Folded shut by default.
export function BullpenCard({ data, workloadData }) {
  const { oppMeta, boardGameDate } = data
  const rows = useMemo(
    () => (workloadData && boardGameDate ? staffGridFor(workloadData, Number(oppMeta.id), boardGameDate) : null),
    [workloadData, boardGameDate, oppMeta.id],
  )
  if (!rows?.length) return null
  const yesterday = rows[0].cells.length - 2
  const pitched = rows.filter((r) => r.cells[yesterday]?.pitches).length
  return (
    <FoldCard title="Bullpen" count={`${rows.length} relievers · ${pitched} pitched yesterday`} className="lpen">
      <div className="lpen__board">
        <div className="lpen__row lpen__row--head" aria-hidden="true">
          <span />
          {rows[0].cells.map((c) => (
            <span key={c.date} className={c.today ? 'is-today' : ''}>{c.today ? 'Now' : dayLetter(c.date)}</span>
          ))}
          <span className="lpen__total">7d</span>
        </div>
        {rows.map((r) => (
          <div key={r.personId} className="lpen__item">
            <div className="lpen__row">
              <PlayerLink id={r.personId} name={r.name} className="lpen__name">
                {splitDisplayName(r.name).last}
              </PlayerLink>
              {r.cells.map((c) => (
                <span key={c.date} className={`lpen__cell${c.pitches ? ' is-on' : ''}${c.today ? ' is-today' : ''}`}>
                  {c.pitches || ''}
                </span>
              ))}
              <span className="lpen__total">{r.last7dayPitches}</span>
            </div>
            {r.reasons?.[0] && <small className="lpen__why">{r.reasons[0]}</small>}
          </div>
        ))}
        <p className="lpen__key">
          <span><i className="lpen__cell is-on" /> pitched</span>
          <span><i className="lpen__cell" /> rested</span>
          <span><i className="lpen__cell is-today" /> today</span>
        </p>
      </div>
    </FoldCard>
  )
}
