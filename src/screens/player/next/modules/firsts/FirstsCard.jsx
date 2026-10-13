import { useEffect } from 'react'
import { loadFirsts } from '../../../../../api/player/history.js'
import { GameLink } from '../../../../../components/player/GameLink.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { teamLogoUrl } from '../../../../../lib/teams.js'
import { firstsView } from './firstsView.js'
import '../../../../../styles/player-next/both/firsts.css'

// The Firsts rows (#1895). loadFirsts reads only what the firsts need, for this card's role,
// so a two-way player has one card for each role.
export function FirstsCard({ bio, role, asOf, onEmpty, onCount }) {
  const { data, loading: busy } = useAsync(() => loadFirsts(bio.id, asOf, role === 'pitching' ? 'pitching' : 'hitting'), [bio.id, asOf, role])
  // useAsync keeps the last player's data for one render after the id changes.
  const mine = data?.bio?.id === bio.id
  const loading = busy || Boolean(data && !mine)
  const view = mine ? firstsView({ firsts: data.firsts, role }) : null
  useEffect(() => {
    if (!loading && !view) onEmpty()
    onCount(view?.count)
  }, [loading, view, onEmpty, onCount])

  if (!view) return loading ? <div className="firsts firsts--wait" aria-busy="true" /> : null
  return (
    <div className="firsts">
      {view.rows.map((r) => (
        <GameLink key={r.key} path={r.path} className={`firsts__row${r.key === 'debut' ? ' firsts__row--debut' : ''}`}>
          <span className="firsts__label">{r.label}</span>
          <span className="firsts__when">
            <span className="firsts__date">{r.date}</span>
            {r.oppId && <img className="firsts__logo" src={teamLogoUrl(r.oppId)} alt={r.where} width="28" height="28" />}
          </span>
        </GameLink>
      ))}
    </div>
  )
}
