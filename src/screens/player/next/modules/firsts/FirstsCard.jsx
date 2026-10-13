import { useEffect } from 'react'
import { loadPlayerHistory } from '../../../../../api/player/history.js'
import { GameLink } from '../../../../../components/player/GameLink.jsx'
import { useAsync } from '../../../../../hooks/useAsync.js'
import { teamLogoUrl } from '../../../../../lib/teams.js'
import { firstsView } from './firstsView.js'
import '../../../../../styles/player-next/both/firsts.css'

// The Firsts rows (#1895). loadPlayerHistory is the only loader that dates the firsts; it
// builds them for his primary role only (bio.isPitcher), so the other role of a two-way
// player has none and its card hides.
export function FirstsCard({ bio, role, asOf, onEmpty, onCount }) {
  const { data, loading: busy } = useAsync(() => loadPlayerHistory(bio.id, asOf), [bio.id, asOf])
  // useAsync keeps the last player's data for one render after the id changes.
  const mine = data?.bio?.id === bio.id
  const loading = busy || Boolean(data && !mine)
  const view = mine && (role === 'pitching') === Boolean(bio.isPitcher) ? firstsView({ firsts: data.firsts, role }) : null
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
