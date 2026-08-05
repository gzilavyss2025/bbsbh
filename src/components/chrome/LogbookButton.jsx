import { useNav } from '../../lib/nav.js'

// A persistent icon button, sibling to SiteSearchButton and SiteMenuButton,
// linking straight to the Logbook (ADR-0035/0036) — otherwise reachable only
// by opening the "More" sheet or scrolling to the slate footer's page list.
// The Logbook just absorbed a dozen-plus PRs of investment as a recurring,
// personal collection feature, so it earns a direct entry point rather than
// staying buried a level deeper than search and menu. Lives in the slate's
// own topbar only for now (see GameSelect.jsx) — SiteHeader can pick it up
// too if the same gap turns out to matter on other screens.
export function LogbookButton({ className = '' }) {
  const navigate = useNav()
  return (
    <button
      type="button"
      className={`logbook-btn ${className}`}
      onClick={() => navigate('/logbook')}
      aria-label="Logbook"
    >
      <LogbookGlyph />
    </button>
  )
}

// A cancellation mark — two concentric rings with four radiating ticks,
// echoing the real game stamp's ring-and-diamond motif (GameStamp.jsx,
// ADR-0035/0036's "Concept 1: The Cancellation") without reproducing that
// gated art itself: this is a generic nav glyph, not a stamp for any game.
function LogbookGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="9" r="3.1" stroke="currentColor" strokeWidth="1.4" />
      <line x1="9" y1="1.3" x2="9" y2="3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9" y1="15" x2="9" y2="16.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="1.3" y1="9" x2="3" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="15" y1="9" x2="16.7" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
