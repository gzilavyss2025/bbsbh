import { BaseballMark } from './BaseballMark.jsx'
import { useNav } from '../lib/nav.js'

// The small "Scorebook" brand mark + wordmark shown atop every screen (except
// the slate, which is already home) — tapping it always returns to '/'. Not
// sticky; each screen still owns whatever page-specific header sits below it.
export function SiteHeader() {
  const navigate = useNav()
  return (
    <div className="sitebar">
      <button
        type="button"
        className="sitebar__home"
        onClick={() => navigate('/')}
        aria-label="Back to games"
      >
        <BaseballMark size={22} simplified />
        <span className="sitebar__word">Scorebook</span>
      </button>
    </div>
  )
}
