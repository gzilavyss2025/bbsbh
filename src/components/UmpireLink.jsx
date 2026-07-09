import { useNav } from '../lib/nav.js'
import { umpirePath } from '../lib/route.js'

// Wraps an umpire's name (already rendered as children) in a plain,
// no-underline button that navigates to their page. Unlike PlayerLink there's
// no spoiler-cutoff hint to carry — umpire assignments/dates are never
// score-revealing, so the target page just fetches its own season data. When
// `id` is missing (selectOfficials occasionally lacks one), renders the
// children as plain text so the row keeps its layout and there's never a
// dead link.
export function UmpireLink({ id, className = '', children }) {
  const navigate = useNav()
  if (!id) {
    return <span className={className}>{children}</span>
  }
  return (
    <button type="button" className={`plink ${className}`} onClick={() => navigate(umpirePath(id))}>
      {children}
    </button>
  )
}
