import { useEffect, useState } from 'react'
import { fetchTopProspects } from '../../../../../api/prospects/top100.js'
import { fetchProspectRankHistory } from '../../../../../api/player/prospectRankHistory.js'
import { fetchTop100History } from '../../../../../api/prospects/top100History.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { prospectsView } from './prospectsView.js'
import '../../../../../styles/player-next/both/prospects.css'

// Prospect rankings (#1927): a rank per list year, the change from the last list, a dark Debuted
// row. The list is per player, so a two-way player gets one card: the hitting instance draws it
// and the pitching one hides. No ranking on file hides the card. Open surface: no seal.
export default function ProspectsModule({ bio, role, season, onEmpty, onCount }) {
  const skip = role === 'pitching' && bio.twoWay
  const { data } = useAsync(() => (skip ? null : Promise.all([fetchProspectRankHistory(), fetchTopProspects(), fetchTop100History()])), [skip])
  const view = data && prospectsView({
    history: data[0],
    snapshot: data[1],
    playerId: bio.id,
    debutYear: bio.debut ? Number(bio.debut.slice(0, 4)) : null,
    currentSeason: season,
    weekly: data[2],
  })
  const [allWeeks, setAllWeeks] = useState(false)
  const settled = skip || data
  useEffect(() => {
    if (!settled) return
    if (view) onCount(view.badge)
    else onEmpty()
  }, [settled, view?.badge]) // eslint-disable-line react-hooks/exhaustive-deps -- report once per answer

  // The height is reserved until the answer lands, so the page does not jump.
  if (!view) return <div className="prospects prospects--wait" aria-busy={!settled} />
  return (
    <div className="prospects">
      <ol className="prospects__list" aria-label="Prospect ranking by year">
        {view.rows.map((r, i) => [
          <li key={i} className={`prospects__row prospects__row--${r.tone}`}>
            <span className="prospects__year">{r.year}</span>
            <span className="prospects__label">{r.label}</span>
            <span className="prospects__delta">{r.delta}</span>
            <span className="prospects__rank">{r.rank}</span>
          </li>,
          // The weekly Top-100 ranks (#2970) sit under the first "Today" row, the current list.
          i === view.weeksAfter && view.weeks.length > 0 && (
            <li key="weeks" className="prospects__weeks">
              <ol className="prospects__weeklist" aria-label="Top 100 rank by week">
                {(allWeeks ? view.weeks : view.weeks.slice(0, 3)).map((w) => (
                  <li key={w.key} className="prospects__week">
                    <span>{w.date}</span>
                    <span className="prospects__weekrank">{w.rank}</span>
                  </li>
                ))}
              </ol>
              {view.weeks.length > 3 && !allWeeks && (
                <button type="button" className="prospects__more" onClick={() => setAllWeeks(true)}>
                  All {view.weeks.length} weeks
                </button>
              )}
            </li>
          ),
        ])}
      </ol>
      {view.note && <p className="prospects__note">{view.note}</p>}
      {view.credits.map((line) => <p key={line} className="prospects__note">{line}</p>)}
    </div>
  )
}
