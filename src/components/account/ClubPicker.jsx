import { useEffect, useRef } from 'react'
import { TeamLogo } from '../logo/TeamLogo.jsx'

// The club strip — one finger-scrollable row of every club's mark, grayscaled
// except the pick, centred on whatever is currently chosen. It is the ONE
// favourite-team picker in the app: the first-visit welcome modal
// (FavoriteTeamModal) and My Tally's Baseball section both render this, so the
// two can never drift into two subtly different pickers the way the menu and
// footer page lists once did.
//
// Pure presentation, and deliberately so. It takes the club list as a PROP
// rather than fetching one, because its two hosts legitimately want different
// sources: /profile reads the same-origin static club file (no statsapi request
// on a page whose whole promise is that it touches no game data), while the
// intro modal keeps the live-with-static-fallback loader it has always used.
// A picker that owned the fetch would have to pick one of those for both.
//
// Tapping a club calls `onPick` immediately — there is no Save step anywhere
// this is used, and adding one would be a change to both hosts at once.
//
// ACCESSIBILITY — this is a single-select preference input, so it is a REAL
// radiogroup, not the `role="tablist"` the markup was inherited with. A tablist
// promises tabs that control panels; there are none. Three things follow, and
// all three are the standard radiogroup contract:
//
//   - One tab stop for the whole strip (roving `tabindex`), not thirty. Every
//     club being individually tabbable meant a keyboard user pressed Tab thirty
//     times to get past the picker.
//   - Arrow keys / Home / End move the selection, which is how a radiogroup is
//     operated and previously did nothing at all.
//   - A real accessible NAME on each option. `TeamLogo` renders `alt=""`
//     `aria-hidden`, so the only name each button had was its `title` — the
//     last resort in the accname spec, unexposed by several screen-reader and
//     browser combinations and invisible to touch and keyboard users entirely.
//
// `teams` is `[{ id, name }]`; anything else on each entry is ignored.
export function ClubPicker({
  teams = [],
  value,
  onPick,
  ariaLabel = 'Favorite team',
  className = '',
}) {
  // Keep the selected club centred in the strip, same behaviour as the player
  // page's Splits vs Team picker: scroll the strip's own scrollLeft (NOT
  // scrollIntoView, which would also scroll the page or the modal around it) so
  // the pick is centred both on open — a mid-alphabet default sits off-screen
  // otherwise — and after every subsequent tap.
  const stripRef = useRef(null)
  const activeRef = useRef(null)
  useEffect(() => {
    const strip = stripRef.current
    const btn = activeRef.current
    if (!strip || !btn) return
    strip.scrollTo({
      left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2,
      behavior: 'smooth',
    })
  }, [value, teams.length])

  // Arrow-key traversal. Moving the selection IS the action here — there is no
  // Save step anywhere this is used — so an arrow key picks, exactly as it does
  // in a native radiogroup.
  const onKeyDown = (e) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(e.key) || teams.length === 0) return
    e.preventDefault()
    const at = teams.findIndex((team) => team.id === value)
    const from = at === -1 ? 0 : at
    let next = from
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = teams.length - 1
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (from + 1) % teams.length
    else next = (from - 1 + teams.length) % teams.length
    onPick(teams[next].id)
  }

  // Which option carries the single tab stop. The selected one, or the first
  // when nothing is selected yet — never none, or the strip becomes
  // unreachable by keyboard.
  const hasSelection = teams.some((team) => team.id === value)

  return (
    <div className={`vsteam__tray ${className}`}>
      <div
        className="vsteam__strip"
        role="radiogroup"
        aria-label={ariaLabel}
        ref={stripRef}
        onKeyDown={onKeyDown}
      >
        {teams.map((team, i) => {
          const active = team.id === value
          const stop = active || (!hasSelection && i === 0)
          return (
            <button
              key={team.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={team.name}
              tabIndex={stop ? 0 : -1}
              ref={active ? activeRef : null}
              className={`vsteam__team${active ? ' is-active' : ''}`}
              onClick={() => onPick(team.id)}
            >
              <TeamLogo teamId={team.id} name={team.name} size={36} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
