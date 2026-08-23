import { teamTabPath } from '../../lib/route.js'
import { HubTabBar } from '../../components/chrome/HubTabBar.jsx'

// The team hub's tab bar — this club's tab list over the shared hub control
// (components/chrome/HubTabBar.jsx), which owns the markup, the `.teamtabs`
// classes and the navigation. The player hub renders the same control with its
// own list, so the two tab strips cannot drift apart.
//
// `hidden` is an optional Set of tab keys to leave out entirely — a thin MiLB
// club with no prospects, no uniform catalog and no transactions should not get
// a tab button that opens an empty screen (see hiddenTeamTabs, data/shared.js).
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
  return (
    <HubTabBar
      tabs={hidden ? TABS.filter((t) => !hidden.has(t.key)) : TABS}
      active={active}
      ariaLabel="Team sections"
      // The cutoff hints are passed straight through rather than read off
      // LinkScope, so a tab switch reproduces the URL the visitor arrived on
      // exactly — a bare /team/158 stays bare instead of growing a `?s=` the
      // address never had.
      pathFor={(key) => teamTabPath(teamId, key, { d: asOf, s: sportId })}
    />
  )
}
