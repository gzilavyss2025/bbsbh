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

  return (
    <div className={`vsteam__tray ${className}`}>
      <div className="vsteam__strip" role="tablist" aria-label={ariaLabel} ref={stripRef}>
        {teams.map((team) => {
          const active = team.id === value
          return (
            <button
              key={team.id}
              type="button"
              role="tab"
              aria-selected={active}
              title={team.name}
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
