import { useNav, useLinkScope } from '../../lib/nav.js'
import { teamTabPath } from '../../lib/route.js'

// Team-name counterpart to PlayerLink — navigates to the team hub, carrying the
// same spoiler-safe cutoff hints. Renders plain children when `id` is absent.
// `ariaLabel` is for logo-only callers whose visible children carry no text a
// screen reader can announce (TeamLogo's own image is aria-hidden).
//
// `tab` defaults to the Overview — the front door, right for a link that names
// a club as an identity (a player's/game's team, a browse-other-clubs strip).
// A caller whose own subject IS one tab's content should say so explicitly
// (see StandingsPage.jsx's `tab="numbers"`) rather than land a visitor on a
// preview of the very table they just clicked out of.
export function TeamLink({ id, tab = 'overview', className = '', ariaLabel, children }) {
  const navigate = useNav()
  const { asOf, sportId } = useLinkScope()
  if (!id) {
    return <span className={className}>{children}</span>
  }
  return (
    <button
      type="button"
      className={`plink ${className}`}
      aria-label={ariaLabel}
      onClick={() => navigate(teamTabPath(id, tab, { d: asOf, s: sportId }))}
    >
      {children}
    </button>
  )
}
