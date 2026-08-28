import { playerTabPath } from '../../lib/route.js'
import { HubTabBar } from '../../components/chrome/HubTabBar.jsx'
import { playerTabsFor } from './tabVisibility.js'

// The player hub's tab bar — this page's tab list over the shared hub control
// (components/chrome/HubTabBar.jsx), the same control the team hub renders. Not
// a copy of TeamTabBar: one control, two lists, so a change to the strip lands
// on both hubs at once.
//
// Four tabs, and the order is the reading order of a player's page: who he is
// now (Overview), what he has done (Stats), what is under those numbers
// (Analytics), how he got here (History).
//
// Labels are written in ordinary sentence case; the ALL-CAPS invariant does the
// uppercasing in CSS (see the block comment in src/styles/01-base.css).
export function PlayerTabBar({ playerId, name = '', active, asOf = null, sportId = null, rosterStatus = null }) {
  return (
    <HubTabBar
      tabs={playerTabsFor(rosterStatus)}
      active={active}
      ariaLabel="Player sections"
      // The cutoff hints are passed straight through rather than read off
      // LinkScope, so a tab switch reproduces the URL the visitor arrived on
      // exactly — a bare /player/661388 stays bare instead of growing a `?s=`
      // the address never had. The name only changes the SPELLING of the
      // address (ADR-0057), so a tab switch keeps the slug the reader can read.
      pathFor={(key) => playerTabPath(playerId, key, { name, d: asOf, s: sportId })}
    />
  )
}
