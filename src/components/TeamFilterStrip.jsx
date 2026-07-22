import { useEffect, useRef } from 'react'
import { TeamLogo } from './TeamLogo.jsx'
import { ALL_MLB_TEAM_IDS, leagueLogoUrl, teamFullName } from '../lib/teams.js'

// A finger-scrollable strip of every current MLB club's logo, reusing the
// Splits vs Team / Favorite Team picker's tray styling (vsteam__* — see
// index.css). The "MLB" pseudo-entry (id null = no filter / show every team)
// is a separate PINNED button to the left of the scrolling strip, not one of
// the scrolled items — so it stays reachable with one tap to clear a pick,
// regardless of how far the club list has been scrolled. Selecting a club is
// a highlight PICK, not a data filter — the caller decides what "highlighted"
// means (see LeadersPage/AllStarRostersPage's effectiveTeamId).
const CLUBS = ALL_MLB_TEAM_IDS
  .map((id) => ({ id, name: teamFullName(id) }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function TeamFilterStrip({ selectedTeamId, onSelect, ariaLabel, className = '' }) {
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

  const isAll = selectedTeamId == null

  return (
    <div className={`vsteam__tray teamfilterstrip ${className}`.trim()}>
      <div className="teamfilterstrip__row" role="tablist" aria-label={ariaLabel}>
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
        <div className="vsteam__strip" ref={stripRef}>
          {CLUBS.map((t) => {
            const active = t.id === selectedTeamId
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={t.name}
                ref={active ? activeRef : null}
                className={`vsteam__team${active ? ' is-active' : ''}`}
                onClick={() => onSelect(t.id)}
              >
                <TeamLogo teamId={t.id} name={t.name} size={36} />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
