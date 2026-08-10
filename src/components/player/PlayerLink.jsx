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
//
// `ariaLabel` is REQUIRED of a caller whose children are art alone — a
// Headshot and nothing else. `Headshot` carries `aria-hidden` and an empty
// `alt` on purpose (it is decoration beside a name, and announcing the same
// player twice is worse than announcing him once), so a portrait-only link
// with no label announces as a bare "button" with no name at all. Same prop,
// same reason, as TeamLink's — which had it from the start; this one didn't,
// so its logo-only callers had no way to name themselves even if they tried.
// e2e/invariants/accessible-names.spec.js is the guard.
export function PlayerLink({ id, className = '', ariaLabel, children }) {
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
      onClick={() => navigate(playerPath(id, { d: asOf, s: sportId }))}
    >
      {children}
    </button>
  )
}
