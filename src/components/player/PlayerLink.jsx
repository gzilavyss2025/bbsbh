import { useNav, useLinkScope } from '../../lib/nav.js'
import { playerPath } from '../../lib/route.js'

// Wraps a player's name (already rendered as children) in a plain, no-underline
// button that navigates to their page. SPOILER-SAFE for the reason that
// matters: it injects no stat or score into the DOM at the link site — the
// player page fetches its own. It carries only the id plus whatever
// `LinkScope` holds, which off a game is the level hint alone; a link out of a
// game no longer stamps an as-of cutoff (ADR-0034's amendment), so a player
// page opened from a lineup card shows current stats, same as from search.
// When `id` is missing (a name selector occasionally lacks one), it
// renders the children as plain text in a same-class span, so the row keeps its
// layout and there's never a dead link. The dotted underline appears only on
// hover/focus (see .plink in index.css) — the scorebook never sprouts web-links.
export function PlayerLink({ id, className = '', children }) {
  const navigate = useNav()
  const { asOf, sportId } = useLinkScope()
  if (!id) {
    return <span className={className}>{children}</span>
  }
  return (
    <button
      type="button"
      className={`plink ${className}`}
      onClick={() => navigate(playerPath(id, { d: asOf, s: sportId }))}
    >
      {children}
    </button>
  )
}
