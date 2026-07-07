import { useState } from 'react'
import { PlayerSearchBox } from './PlayerSearchBox.jsx'
import { TeamSearchBox } from './TeamSearchBox.jsx'
import { GameFinderModal } from './GameFinderModal.jsx'
import { BaseballMark } from './BaseballMark.jsx'
import { useNav } from '../lib/nav.js'

const YEAR = new Date().getFullYear()

// The slate's footer: site-wide player/team search, the past-matchup finder
// (tucked behind a modal so its two team pickers + results don't have to live
// inline), the printable logo sheet, and the standard small print. Nothing
// here is score-revealing — search surfaces identity and schedule only, same
// as every other spoiler-free selector.
export function SiteFooter({ onShowLogos }) {
  const [showFinder, setShowFinder] = useState(false)
  const navigate = useNav()

  return (
    <footer className="sitefooter">
      <div className="sitefooter__search">
        <PlayerSearchBox />
        <TeamSearchBox />
      </div>

      <div className="sitefooter__actions">
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
          onClick={() => navigate('/prospects')}
        >
          Top MLB Prospects
        </button>
      </div>

      {showFinder && <GameFinderModal onClose={() => setShowFinder(false)} />}

      <div className="sitefooter__legal">
        <p className="sitefooter__brand">
          <BaseballMark size={14} simplified />
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
