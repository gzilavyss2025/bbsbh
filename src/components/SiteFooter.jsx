import { useState } from 'react'
import { fetchTeams } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { GameFinderModal } from './GameFinderModal.jsx'
import { FavoriteTeamModal } from './FavoriteTeamModal.jsx'
import { ScorebookMark } from './ScorebookMark.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { SPORT_IDS } from '../lib/teams.js'
import { useNav } from '../lib/nav.js'

const YEAR = new Date().getFullYear()

// The slate's footer: the past-matchup finder (tucked behind a modal so its
// two team pickers + results don't have to live inline), the favorite-team
// picker, the printable logo sheet, and the standard small print. Site-wide
// player/team search used to live here as two boxes; it's now the single
// header search button (see SiteSearch.jsx), reachable from every screen
// rather than just the slate. Nothing here is score-revealing — the
// favorite-team pick surfaces identity and schedule only, same as every
// other spoiler-free selector.
export function SiteFooter({ onShowLogos, favoriteTeamId, onSetFavoriteTeam }) {
  const [showFinder, setShowFinder] = useState(false)
  const [showFavoriteTeam, setShowFavoriteTeam] = useState(false)
  const navigate = useNav()
  const mlbTeams = useAsync(() => fetchTeams(SPORT_IDS.MLB), [])
  const favoriteTeam = mlbTeams.data?.find((t) => t.id === favoriteTeamId) ?? null

  return (
    <footer className="sitefooter">
      <div className="sitefooter__actions">
        <button
          type="button"
          className="sitefooter__action sitefooter__favteam"
          onClick={() => setShowFavoriteTeam(true)}
        >
          <TeamLogo
            teamId={favoriteTeamId}
            name={favoriteTeam?.name ?? ''}
            size={16}
            className="sitefooter__favteam-logo"
          />
          {favoriteTeam ? favoriteTeam.name : 'Favorite team'}
        </button>
        <button
          type="button"
          className="sitefooter__action"
          onClick={() => setShowFinder(true)}
        >
          Find a past matchup
        </button>
        <button type="button" className="sitefooter__action" onClick={onShowLogos}>
          Logo sheet
        </button>
        <button
          type="button"
          className="sitefooter__action"
          onClick={() => navigate('/standings')}
        >
          Standings
        </button>
        <button
          type="button"
          className="sitefooter__action"
          onClick={() => navigate('/leaders')}
        >
          League Leaders
        </button>
        <button
          type="button"
          className="sitefooter__action"
          onClick={() => navigate('/prospects')}
        >
          Top MLB Prospects
        </button>
        <button
          type="button"
          className="sitefooter__action"
          onClick={() => navigate('/rehab')}
        >
          Rehab assignments
        </button>
        <button
          type="button"
          className="sitefooter__action"
          onClick={() => navigate('/umpires')}
        >
          Umpire Rankings
        </button>
        <button
          type="button"
          className="sitefooter__action"
          onClick={() => navigate('/milestones')}
        >
          Milestone Watch
        </button>
      </div>

      {showFinder && <GameFinderModal onClose={() => setShowFinder(false)} />}

      {showFavoriteTeam && (
        <FavoriteTeamModal
          favoriteTeamId={favoriteTeamId}
          onSave={onSetFavoriteTeam}
          onClose={() => setShowFavoriteTeam(false)}
        />
      )}

      <div className="sitefooter__legal">
        <p className="sitefooter__brand">
          <ScorebookMark size={14} simplified />
          Scorebook Helper
        </p>
        <p>Data via the MLB Stats API. Not affiliated with MLB or any club.</p>
        <p>Score on paper — every run, hit, and error stays sealed until you tap.</p>
        <p>
          <button
            type="button"
            className="sitefooter__about"
            onClick={() => navigate('/about')}
          >
            About
          </button>
          {' · '}© {YEAR}
        </p>
      </div>
    </footer>
  )
}
