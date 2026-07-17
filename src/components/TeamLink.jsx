import { useNav, useLinkScope } from '../lib/nav.js'
import { teamPath } from '../lib/route.js'

// Team-name counterpart to PlayerLink — navigates to the team hub, carrying the
// same spoiler-safe cutoff hints. Renders plain children when `id` is absent.
// `ariaLabel` is for logo-only callers whose visible children carry no text a
// screen reader can announce (TeamLogo's own image is aria-hidden).
export function TeamLink({ id, className = '', ariaLabel, children }) {
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
      onClick={() => navigate(teamPath(id, { d: asOf, s: sportId }))}
    >
      {children}
    </button>
  )
}
