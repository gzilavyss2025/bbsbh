import { useEffect, useRef } from 'react'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { ALL_MLB_TEAM_IDS, leagueLogoUrl, teamFullName } from '../../lib/teams.js'

// A finger-scrollable strip of every current MLB club's logo, reusing the
// Splits vs Team / Favorite Team picker's tray styling (vsteam__* — see
// index.css). The "MLB" pseudo-entry (id null = no filter / show every team)
// is a separate PINNED button to the left of the scrolling strip, not one of
// the scrolled items — so it stays reachable with one tap to clear a pick,
// regardless of how far the club list has been scrolled. Selecting a club is
// a highlight PICK, not a data filter — the caller decides what "highlighted"
// means (see LeadersPage/AllStarRostersPage's effectiveTeamId).
//
// `teams` defaults to every current MLB club (id + full name), but a caller
// can pass its own list instead — the slate's team-logo banner (GameSelect)
// passes the current level's own clubs (fetchTeams(sportId)), so the same
// strip scrolls AAA/AA/A+/A logos there without an MLB-only id map.
// `showMlbPin` hides the pinned "MLB" reset button (and its divider) for a
// caller like that banner, which has no "every team" state to reset to —
// it's a straight navigation strip, not a filter.
const CLUBS = ALL_MLB_TEAM_IDS
  .map((id) => ({ id, name: teamFullName(id) }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function TeamFilterStrip({
  teams = CLUBS,
  selectedTeamId,
  onSelect,
  ariaLabel,
  showMlbPin = true,
  showArrows = false,
  centerTeamId = null,
  className = '',
}) {
  const stripRef = useRef(null)
  const activeRef = useRef(null)

  // Same centering effect as SplitsVsTeam/FavoriteTeamModal: keep the picked
  // club's logo centered horizontally without a page-level scroll jump, on
  // mount and on every pick. The pinned MLB button lives outside this
  // scrolling strip, so picking it (activeRef unset) leaves the scroll
  // position wherever the user left it instead of jumping.
  useEffect(() => {
    const strip = stripRef.current
    const btn = activeRef.current
    if (!strip || !btn) return
    strip.scrollTo({
      left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2,
      behavior: 'smooth',
    })
  }, [selectedTeamId])

  // A nav strip like GameSelect's never has a "picked" club (the effect
  // above never fires there), but it still wants to land on the user's
  // favorite team on arrival — jump straight there with no animation, same
  // as if the page had always been scrolled there.
  useEffect(() => {
    const strip = stripRef.current
    if (!strip || centerTeamId == null) return
    const btn = strip.querySelector(`[data-team-id="${centerTeamId}"]`)
    if (!btn) return
    strip.scrollLeft = btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2
  }, [centerTeamId, teams])

  const scrollByStrip = (dir) => {
    stripRef.current?.scrollBy({ left: dir * stripRef.current.clientWidth * 0.8, behavior: 'smooth' })
  }

  const isAll = selectedTeamId == null

  return (
    <div className={`vsteam__tray teamfilterstrip ${className}`.trim()}>
      <div className="teamfilterstrip__row" role="tablist" aria-label={ariaLabel}>
        {showMlbPin && (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={isAll}
              title="MLB"
              className={`vsteam__team teamfilterstrip__pin${isAll ? ' is-active' : ''}`}
              onClick={() => onSelect(null)}
            >
              <img
                src={leagueLogoUrl()}
                alt=""
                className="teamfilterstrip__mlblogo"
                width={36}
                height={36}
                aria-hidden="true"
              />
            </button>
            <span className="teamfilterstrip__divider" aria-hidden="true" />
          </>
        )}
        {showArrows && (
          <button
            type="button"
            className="teamfilterstrip__arrow teamfilterstrip__arrow--left"
            aria-label="Scroll teams left"
            onClick={() => scrollByStrip(-1)}
          >
            ‹
          </button>
        )}
        <div className="vsteam__strip" ref={stripRef}>
          {teams.map((t) => {
            const active = t.id === selectedTeamId
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={t.name}
                data-team-id={t.id}
                ref={active ? activeRef : null}
                className={`vsteam__team${active ? ' is-active' : ''}`}
                onClick={() => onSelect(t.id)}
              >
                <TeamLogo teamId={t.id} name={t.name} size={36} />
              </button>
            )
          })}
        </div>
        {showArrows && (
          <button
            type="button"
            className="teamfilterstrip__arrow teamfilterstrip__arrow--right"
            aria-label="Scroll teams right"
            onClick={() => scrollByStrip(1)}
          >
            ›
          </button>
        )}
      </div>
    </div>
  )
}
