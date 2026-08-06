import { useState } from 'react'
import { GameFinderModal } from '../game/GameFinderModal.jsx'
import { TallyBaseballMark, TallyWordmark } from './TallyBrand.jsx'
import { useNav } from '../../lib/nav.js'
import { REPORT_PAGES } from '../../lib/reportPages.js'
import { profilePath } from '../../lib/route.js'
import { BuildStamp } from '../ui/BuildStamp.jsx'

// Same REPORT_PAGES list the hamburger menu (SiteMenu.jsx) uses, plus About
// as the trailing item — see reportPages.js for why Logo Sheet isn't here
// (it's already one of the bordered action buttons above).
const FOOTER_LINKS = [...REPORT_PAGES, { label: 'About', path: '/about' }]

const YEAR = new Date().getFullYear()

// The slate's footer: the past-matchup finder (tucked behind a modal so its
// two team pickers + results don't have to live inline), Settings, the
// printable logo sheet, and the standard small print. Site-wide player/team
// search used to live here as two boxes; it's now the single header search
// button (see SiteSearch.jsx), reachable from every screen rather than just
// the slate. Nothing here is score-revealing.
//
// **Settings is a destination now, not a modal.** It used to open
// FavoriteTeamModal in a second, non-intro mode holding one control. It
// navigates to `/profile` (My Tally) instead, where the club sits with the
// level, keep-awake, motion, the progress ledger, the sync receipt and the
// account — none of which fit a one-purpose sheet. The modal survives for the
// first-visit intro only (GameSelect).
//
// Bordered-button chrome is reserved for the three things you actually DO on
// this screen (open Settings, look up a past matchup, print the logo sheet);
// the ten reference/browse pages below them are plain links instead, grouped
// under one "More" label — matching the standard footer convention (buttons
// for primary actions, plain text for the rest of a sitemap-style list) —
// rather than all thirteen sharing one identical bold uppercase box regardless
// of how often anyone actually taps it.
export function SiteFooter({ onShowLogos }) {
  const [showFinder, setShowFinder] = useState(false)
  const navigate = useNav()

  return (
    <footer className="sitefooter">
      <div className="sitefooter__actions">
        <button
          type="button"
          className="sitefooter__action"
          onClick={() => navigate(profilePath())}
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
        <p className="sitefooter__more-label">More Baseball</p>
        <nav className="sitefooter__links" aria-label="More pages">
          {FOOTER_LINKS.map((item) => (
            <button
              key={item.path}
              type="button"
              className="sitefooter__link"
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {showFinder && <GameFinderModal onClose={() => setShowFinder(false)} />}

      <div className="sitefooter__legal">
        <p className="sitefooter__brand">
          <TallyBaseballMark size={18} />
          <TallyWordmark height={14} tight />
          <span>Baseball</span>
        </p>
        <p>Data via the MLB Stats API. Not affiliated with MLB or any club.</p>
        <p>Built for keeping score by hand. Game results stay sealed until opened.</p>
        <p>
          © {YEAR}
          <BuildStamp />
        </p>
      </div>
    </footer>
  )
}
