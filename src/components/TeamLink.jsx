import { useNav, useLinkScope } from '../lib/nav.js'
import { teamPath } from '../lib/route.js'

// Team-name counterpart to PlayerLink — navigates to the team hub, carrying the
// same spoiler-safe cutoff hints. Renders plain children when `id` is absent.
export function TeamLink({ id, className = '', children }) {
  const navigate = useNav()
  const { asOf, sportId } = useLinkScope()
  if (!id) {
    return <span className={className}>{children}</span>
  }
  return (
    <button
      type="button"
      className={`plink ${className}`}
      onClick={() => navigate(teamPath(id, { d: asOf, s: sportId }))}
    >
      {children}
    </button>
  )
}
