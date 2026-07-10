import { ScorebookMark } from './ScorebookMark.jsx'
import { SiteSearchButton } from './SiteSearch.jsx'
import { goHome } from '../lib/home.js'

// The small "Scorebook" brand mark + wordmark shown atop every screen (except
// the slate, which is already home) — tapping it returns to '/' with a full
// reload (see lib/home.js). Not sticky; each screen still owns whatever
// page-specific header sits below it. The search button rides on the same
// row so site-wide search is reachable from anywhere (the slate gets its own
// copy in its topbar — see GameSelect — since it doesn't render SiteHeader).
export function SiteHeader() {
  return (
    <div className="sitebar">
      <button
        type="button"
        className="sitebar__home"
        onClick={goHome}
        aria-label="Back to games"
      >
        <ScorebookMark size={22} simplified />
        <span className="sitebar__word">Scorebook</span>
      </button>
      <SiteSearchButton className="sitebar__search" />
    </div>
  )
}
