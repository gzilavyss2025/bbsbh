import { PlayerSearchBox } from './PlayerSearchBox.jsx'
import { TeamSearchBox } from './TeamSearchBox.jsx'
import { GameFinder } from './GameFinder.jsx'
import { BaseballMark } from './BaseballMark.jsx'

const YEAR = new Date().getFullYear()

// The slate's footer: the printable logo sheet link (moved down here so the
// masthead stays lean), site-wide player/team/matchup search, and the
// standard small print. Nothing here is score-revealing — search surfaces
// identity and schedule only, same as every other spoiler-free selector.
export function SiteFooter({ onShowLogos }) {
  return (
    <footer className="sitefooter">
      <div className="sitefooter__search">
        <PlayerSearchBox />
        <TeamSearchBox />
      </div>

      <GameFinder />

      <div className="sitefooter__links">
        <button type="button" className="sitefooter__link" onClick={onShowLogos}>
          Logo sheet
        </button>
      </div>

      <div className="sitefooter__legal">
        <p className="sitefooter__brand">
          <BaseballMark size={14} simplified />
          Scorebook Helper
        </p>
        <p>Data via the MLB Stats API. Not affiliated with MLB or any club.</p>
        <p>Score on paper — every run, hit, and error stays sealed until you tap.</p>
        <p>© {YEAR}</p>
      </div>
    </footer>
  )
}
