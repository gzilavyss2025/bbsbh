import { TallyBaseballMark, TallyWordmark } from './TallyBrand.jsx'
import { SiteSearchButton } from './SiteSearch.jsx'
import { SiteMenuButton } from './SiteMenu.jsx'
import { goHome } from '../lib/home.js'

// The Tally wordmark shown atop every screen (except
// the slate, which is already home) — tapping it returns to '/' with a full
// reload (see lib/home.js). Not sticky; each screen still owns whatever
// page-specific header sits below it. The search + menu buttons ride on the
// same row so site-wide search and the standalone pages (standings,
// prospects, etc.) are reachable from anywhere (the slate gets its own copy
// in its topbar — see GameSelect — since it doesn't render SiteHeader).
export function SiteHeader() {
  return (
    <div className="sitebar">
      <button
        type="button"
        className="sitebar__home"
        onClick={goHome}
        aria-label="Back to games"
      >
        <span className="tally-lockup" aria-hidden="true">
          <TallyBaseballMark size={38} className="tally-lockup__mark" />
          <TallyWordmark height={34} className="tally-lockup__wordmark sitebar__wordmark" />
        </span>
      </button>
      <div className="sitebar__actions">
        <SiteSearchButton />
        <SiteMenuButton />
      </div>
    </div>
  )
}
