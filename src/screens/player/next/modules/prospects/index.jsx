import { useEffect } from 'react'
import { fetchTopProspects } from '../../../../../api/prospects.js'
import { fetchProspectRankHistory } from '../../../../../api/player/prospectRankHistory.js'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { prospectsView } from './prospectsView.js'
import '../../../../../styles/player-next/both/prospects.css'

// Prospect rankings (#1927): a rank per list year, the change from the last list, a dark Debuted
// row. The list is per player, so a two-way player gets one card: the hitting instance draws it
// and the pitching one hides. No ranking on file hides the card. Open surface: no seal.
export default function ProspectsModule({ bio, role, season, onEmpty, onCount }) {
  const skip = role === 'pitching' && bio.twoWay
  const { data } = useAsync(() => (skip ? null : Promise.all([fetchProspectRankHistory(), fetchTopProspects()])), [skip])
  const view = data && prospectsView({
    history: data[0],
    snapshot: data[1],
    playerId: bio.id,
    debutYear: bio.debut ? Number(bio.debut.slice(0, 4)) : null,
    currentSeason: season,
  })
  const settled = skip || data
  useEffect(() => {
    if (!settled) return
    if (view) onCount(view.badge)
    else onEmpty()
  }, [settled, view?.badge]) // eslint-disable-line react-hooks/exhaustive-deps -- report once per answer

  // The height is reserved until the answer lands, so the page does not jump.
  if (!view) return <div className="prospects prospects--wait" />
  return (
    <div className="prospects">
      <ol className="prospects__list" aria-label="Prospect ranking by year">
        {view.rows.map((r, i) => (
          <li key={i} className={`prospects__row prospects__row--${r.tone}`}>
            <span className="prospects__year">{r.year}</span>
            <span className="prospects__label">{r.label}</span>
            <span className="prospects__delta">{r.delta}</span>
            <span className="prospects__rank">{r.rank}</span>
          </li>
        ))}
      </ol>
      {view.note && <p className="prospects__note">{view.note}</p>}
      {view.credits.map((line) => <p key={line} className="prospects__note">{line}</p>)}
    </div>
  )
}
