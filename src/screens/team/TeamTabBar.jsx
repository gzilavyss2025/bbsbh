import { useNav } from '../../lib/nav.js'
import { teamTabPath } from '../../lib/route.js'

// The team hub's tab bar. Every tab is a REAL route (teamTabPath -> useNav ->
// pushState), not local state: the URL changes, browser back/forward step
// through tabs, and any tab is shareable. That is also what keeps each tab
// loading only its own data.
//
// `hidden` is an optional Set of tab keys to leave out entirely — a thin MiLB
// club with no prospects, no uniform catalog and no transactions should not get
// a tab button that opens an empty screen. Nothing sets it yet; the bar just
// doesn't hard-code five.
//
// Labels are written in ordinary sentence case; the ALL-CAPS invariant does the
// uppercasing in CSS (see the block comment in src/index.css).
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'roster', label: 'Roster' },
  { key: 'games', label: 'Games' },
  { key: 'numbers', label: 'Numbers' },
  { key: 'contracts', label: 'Contracts' },
  { key: 'minors', label: 'Minors' },
]

export function TeamTabBar({ teamId, active, asOf = null, sportId = null, hidden }) {
  const navigate = useNav()
  const tabs = hidden ? TABS.filter((t) => !hidden.has(t.key)) : TABS

  return (
    <nav className="teamtabs" aria-label="Team sections">
      <div className="teamtabs__row">
        {tabs.map((t) => {
          const isActive = t.key === active
          return (
            <button
              key={t.key}
              type="button"
              className={`teamtabs__btn ${isActive ? 'is-active' : ''}`.trim()}
              aria-current={isActive ? 'page' : undefined}
              // The cutoff hints are passed straight through rather than read
              // off LinkScope, so a tab switch reproduces the URL the visitor
              // arrived on exactly — a bare /team/158 stays bare instead of
              // growing a `?s=` the address never had.
              onClick={() =>
                !isActive && navigate(teamTabPath(teamId, t.key, { d: asOf, s: sportId }))
              }
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
