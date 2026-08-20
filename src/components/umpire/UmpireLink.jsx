import { useNav, nameFromChildren } from '../../lib/nav.js'
import { umpirePath } from '../../lib/route.js'

// Wraps an umpire's name (already rendered as children) in a plain,
// no-underline button. Unlike PlayerLink there's no spoiler-cutoff hint to
// carry — umpire assignments/dates are never score-revealing, so the target
// just fetches its own season data. When `id` is missing (selectOfficials
// occasionally lacks one), renders the children as plain text so the row keeps
// its layout and there's never a dead link.
//
// Two behaviours, one component. By default the name NAVIGATES to the umpire's
// page, which is what every caller outside the lineup page wants. Pass `onOpen`
// and it calls that instead — the lineup page's Umpires card uses it to open
// UmpireAccuracyModal in place, for every member of the crew rather than only
// the plate umpire. Staying on the lineup page matters there: you're staging a
// game, and the answer is one sheet rather than a round trip. The modal's own
// "Full umpire page" button still reaches the page, so the navigating path is
// never lost — which is why this is a prop and not a second component.
// `name` is what puts the person's name in the address bar rather than a bare
// id (route.js, ADR-0057). It defaults to the children when they are already a
// plain string, which is the ordinary case here — the link IS the name — so
// almost no caller has to say anything. A caller whose children are ART (a
// headshot, a club mark) has no string to borrow and should pass `name`
// explicitly; without it the link still works, just at the bare-id address.
export function UmpireLink({ id, name, className = '', onOpen = null, children }) {
  const navigate = useNav()
  if (!id) {
    return <span className={className}>{children}</span>
  }
  return (
    <button
      type="button"
      className={`plink ${className}`}
      onClick={onOpen ?? (() => navigate(umpirePath(id, name ?? nameFromChildren(children))))}
    >
      {children}
    </button>
  )
}
