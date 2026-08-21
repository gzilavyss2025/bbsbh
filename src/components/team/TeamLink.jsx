import { useNav, useLinkScope, nameFromChildren } from '../../lib/nav.js'
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
//
// It names the SEGMENT after the club, which is not always a hub tab: the
// club's standalone pages sit at the same depth, so `tab="transactions"` lands
// on the club's roster-move ledger (MoveRow.jsx's club chip). Anything
// route.js parses at `/team/{id}/{segment}` is fair game.
// `name` is what puts the person's name in the address bar rather than a bare
// id (route.js, ADR-0057). It defaults to the children when they are already a
// plain string, which is the ordinary case here — the link IS the name — so
// almost no caller has to say anything. A caller whose children are ART (a
// headshot, a club mark) has no string to borrow and should pass `name`
// explicitly; without it the link still works, just at the bare-id address.
export function TeamLink({ id, name, tab = 'overview', className = '', ariaLabel, children }) {
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
      onClick={() =>
        navigate(
          teamTabPath(id, tab, { name: name ?? nameFromChildren(children), d: asOf, s: sportId }),
        )
      }
    >
      {children}
    </button>
  )
}
