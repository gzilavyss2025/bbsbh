import { useNav } from '../../lib/nav.js'

// The tab bar under a hub's pinned identity header. ONE control, two callers —
// the team hub (screens/team/TeamTabBar.jsx) and the player hub
// (screens/player/PlayerTabBar.jsx) — so the two can never drift into two
// different-looking tab strips. It owns the markup and the `.teamtabs` classes
// (styles/46-consent-modal.css) and nothing else; each caller supplies its own
// tab list and its own path builder.
//
// Every tab is a REAL route (a path builder -> useNav -> pushState), not local
// state: the URL changes, browser back/forward step through tabs, and any tab is
// shareable. That is also what keeps each tab loading only its own data.
//
// The control is deliberately NOT club-coloured, on either hub. `.teamtabs__btn`
// inks its active tab from `--accent-primary`, the app's own navy, even on a page
// whose header wears a club's triad — ADR-0030's rule that a club may colour a
// card that identifies the club, never a CONTROL.
//
// Labels are written in ordinary sentence case; the ALL-CAPS invariant does the
// uppercasing in CSS (see the block comment in src/styles/01-base.css).
export function HubTabBar({ tabs, active, ariaLabel, pathFor }) {
  const navigate = useNav()

  return (
    <nav className="teamtabs" aria-label={ariaLabel}>
      <div className="teamtabs__row">
        {tabs.map((t) => {
          const isActive = t.key === active
          return (
            <button
              key={t.key}
              type="button"
              className={`teamtabs__btn ${isActive ? 'is-active' : ''}`.trim()}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => !isActive && navigate(pathFor(t.key))}
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
