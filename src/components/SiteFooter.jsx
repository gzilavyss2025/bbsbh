import { useState } from 'react'
import { GameFinderModal } from './GameFinderModal.jsx'
import { FavoriteTeamModal } from './FavoriteTeamModal.jsx'
import { TallyBaseballMark, TallyWordmark } from './TallyBrand.jsx'
import { useNav } from '../lib/nav.js'

const YEAR = new Date().getFullYear()

// The slate's footer: the past-matchup finder (tucked behind a modal so its
// two team pickers + results don't have to live inline), the Settings modal
// (favorite team + Game Score visibility, see FavoriteTeamModal.jsx), the
// printable logo sheet, and the standard small print. Site-wide player/team
// search used to live here as two boxes; it's now the single header search
// button (see SiteSearch.jsx), reachable from every screen rather than just
// the slate. Nothing here is score-revealing — the favorite-team pick
// surfaces identity and schedule only, same as every other spoiler-free
// selector.
//
// Bordered-button chrome is reserved for the three things you actually DO on
// this screen (open Settings, look up a past matchup, print the logo sheet);
// the ten reference/browse pages below them are plain links instead, grouped
// under one "More" label — matching the standard footer convention (buttons
// for primary actions, plain text for the rest of a sitemap-style list) —
// rather than all thirteen sharing one identical bold uppercase box regardless
// of how often anyone actually taps it.
export function SiteFooter({
  onShowLogos,
  favoriteTeamId,
  onSetFavoriteTeam,
  gameScoreVisible,
  onSetGameScoreVisible,
}) {
  const [showFinder, setShowFinder] = useState(false)
  const [showFavoriteTeam, setShowFavoriteTeam] = useState(false)
  const navigate = useNav()

  return (
    <footer className="sitefooter">
      <div className="sitefooter__actions">
        <button
          type="button"
          className="sitefooter__action"
          onClick={() => setShowFavoriteTeam(true)}
        >
          Settings
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
      </div>

      <div className="sitefooter__more">
        {/* Roughly "current-season and busiest first, archival/meta last":
            standings/leaders/Top Games (what's happening now) → player-
            trajectory pages (prospects/rehab/milestones) → the deeper-cut
            umpire stats → season-culminating history → About, always last. */}
        <p className="sitefooter__more-label">More Baseball</p>
        <nav className="sitefooter__links" aria-label="More pages">
          <button type="button" className="sitefooter__link" onClick={() => navigate('/standings')}>
            Standings
          </button>
          <button type="button" className="sitefooter__link" onClick={() => navigate('/leaders')}>
            League Leaders
          </button>
          <button type="button" className="sitefooter__link" onClick={() => navigate('/top-games')}>
            Top Games
          </button>
          <button type="button" className="sitefooter__link" onClick={() => navigate('/prospects')}>
            Top MLB Prospects
          </button>
          <button type="button" className="sitefooter__link" onClick={() => navigate('/rehab')}>
            Rehab assignments
          </button>
          <button type="button" className="sitefooter__link" onClick={() => navigate('/milestones')}>
            Milestone Watch
          </button>
          <button type="button" className="sitefooter__link" onClick={() => navigate('/umpires')}>
            Umpire Rankings
          </button>
          <button type="button" className="sitefooter__link" onClick={() => navigate('/awards')}>
            Awards History
          </button>
          <button type="button" className="sitefooter__link" onClick={() => navigate('/postseason-history')}>
            Postseason History
          </button>
          <button type="button" className="sitefooter__link" onClick={() => navigate('/all-star-rosters')}>
            All Star Game
          </button>
          <button type="button" className="sitefooter__link" onClick={() => navigate('/about')}>
            About
          </button>
        </nav>
      </div>

      {showFinder && <GameFinderModal onClose={() => setShowFinder(false)} />}

      {showFavoriteTeam && (
        <FavoriteTeamModal
          favoriteTeamId={favoriteTeamId}
          onSave={onSetFavoriteTeam}
          onClose={() => setShowFavoriteTeam(false)}
          gameScoreVisible={gameScoreVisible}
          onSetGameScoreVisible={onSetGameScoreVisible}
        />
      )}

      <div className="sitefooter__legal">
        <p className="sitefooter__brand">
          <TallyBaseballMark size={18} />
          <TallyWordmark height={14} />
          <span>Baseball</span>
        </p>
        <p>Data via the MLB Stats API. Not affiliated with MLB or any club.</p>
        <p>Built for keeping score by hand. Game results stay sealed until opened.</p>
        <p>© {YEAR}</p>
      </div>
    </footer>
  )
}
