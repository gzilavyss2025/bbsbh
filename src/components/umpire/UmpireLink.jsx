import { useNav } from '../../lib/nav.js'
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
export function UmpireLink({ id, className = '', onOpen = null, children }) {
  const navigate = useNav()
  if (!id) {
    return <span className={className}>{children}</span>
  }
  return (
    <button
      type="button"
      className={`plink ${className}`}
      onClick={onOpen ?? (() => navigate(umpirePath(id)))}
    >
      {children}
    </button>
  )
}
