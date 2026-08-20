import { useNav, nameFromChildren } from '../../lib/nav.js'
import { managerPath } from '../../lib/route.js'

// Wraps a manager's fact-grid content (already rendered as children) in a
// plain, no-underline button that navigates to his page — the manager
// counterpart of UmpireLink. No spoiler-cutoff hint to carry: a manager's
// coaching career/awards are never score-revealing, so the target page just
// fetches its own data. When `id` is missing (an older feed, or a MiLB club
// whose coaches endpoint didn't resolve a personId), renders the children as
// plain text so the row keeps its layout and there's never a dead link.
// `name` is what puts the person's name in the address bar rather than a bare
// id (route.js, ADR-0057). It defaults to the children when they are already a
// plain string, which is the ordinary case here — the link IS the name — so
// almost no caller has to say anything. A caller whose children are ART (a
// headshot, a club mark) has no string to borrow and should pass `name`
// explicitly; without it the link still works, just at the bare-id address.
export function ManagerLink({ id, name, className = '', children }) {
  const navigate = useNav()
  if (!id) {
    return <span className={className}>{children}</span>
  }
  return (
    <button
      type="button"
      className={`plink ${className}`}
      onClick={() => navigate(managerPath(id, name ?? nameFromChildren(children)))}
    >
      {children}
    </button>
  )
}
