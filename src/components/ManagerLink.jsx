import { useNav } from '../lib/nav.js'
import { managerPath } from '../lib/route.js'

// Wraps a manager's fact-grid content (already rendered as children) in a
// plain, no-underline button that navigates to his page — the manager
// counterpart of UmpireLink. No spoiler-cutoff hint to carry: a manager's
// coaching career/awards are never score-revealing, so the target page just
// fetches its own data. When `id` is missing (an older feed, or a MiLB club
// whose coaches endpoint didn't resolve a personId), renders the children as
// plain text so the row keeps its layout and there's never a dead link.
export function ManagerLink({ id, className = '', children }) {
  const navigate = useNav()
  if (!id) {
    return <span className={className}>{children}</span>
  }
  return (
    <button type="button" className={`plink ${className}`} onClick={() => navigate(managerPath(id))}>
      {children}
    </button>
  )
}
