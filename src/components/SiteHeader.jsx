import { ScorebookMark } from './ScorebookMark.jsx'
import { goHome } from '../lib/home.js'

// The small "Scorebook" brand mark + wordmark shown atop every screen (except
// the slate, which is already home) — tapping it returns to '/' with a full
// reload (see lib/home.js). Not sticky; each screen still owns whatever
// page-specific header sits below it.
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
    </div>
  )
}
