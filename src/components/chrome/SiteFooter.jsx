import { useState } from 'react'
import { GameFinderModal } from '../game/GameFinderModal.jsx'
import { FooterDirectory, FooterLegal } from './FooterParts.jsx'
import { useNav } from '../../lib/nav.js'
import { PAGE_GROUPS, FOOTER_TRAIL } from '../../lib/reportPages.js'
import { profilePath } from '../../lib/route.js'

// The slate's footer: the past-matchup finder (tucked behind a modal so its
// two team pickers + results don't have to live inline), Settings, the
// printable logo sheet, then the site directory and the standard small print.
// Site-wide player/team search used to live here as two boxes; it's now the
// single header search button (see SiteSearch.jsx), reachable from every screen
// rather than just the slate. Nothing here is score-revealing.
//
// **Settings is a destination now, not a modal.** It used to open
// FavoriteTeamModal in a second, non-intro mode holding one control. It
// navigates to `/profile` (My Tally) instead, where the club sits with the
// level, keep-awake, motion, the progress ledger, the sync receipt and the
// account — none of which fit a one-purpose sheet. The modal survives for the
// first-visit intro only (GameSelect).
//
// Bordered-button chrome is reserved for the three things you actually DO on
// this screen (open Settings, look up a past matchup, print the logo sheet).
// Everything under them is the directory — reference pages you go and read —
// which is why those are plain links, and why they are GROUPED now under the
// same headings the More sheet and /more use. The sheet was grouped and given a
// scroll container in #744 and this list was not, so the same nineteen names
// stayed one flat alphabet-soup run at the foot of the busiest screen on the
// site. See FooterParts.jsx.
//
// PAGE_GROUPS, not MENU_GROUPS: the guides get their hub in the trail, and a
// footer has never listed the Logo Sheet — see reportPages.js for both.
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

      <FooterDirectory
        groups={PAGE_GROUPS}
        trail={FOOTER_TRAIL}
        onEverything={() => navigate('/more')}
      />

      {showFinder && <GameFinderModal onClose={() => setShowFinder(false)} />}

      <FooterLegal />
    </footer>
  )
}
