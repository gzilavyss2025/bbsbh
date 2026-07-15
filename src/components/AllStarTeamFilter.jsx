import { useEffect, useRef } from 'react'
import { TeamLogo } from './TeamLogo.jsx'
import { ALL_MLB_TEAM_IDS, leagueLogoUrl, teamFullName } from '../lib/teams.js'

// The All-Star Rosters page's team filter — a finger-scrollable strip of every
// current MLB club's logo, same structure/scroll-centering as SplitsVsTeam's
// opponent picker (see that file's header comment for the rationale). Instead
// of a per-player opponent list, this is every club alphabetically, with one
// extra "MLB" pseudo-entry (id null = no filter / show every team) spliced
// into the MIDDLE of the array rather than pinned to an end, so the default
// selection starts centered like a real pick would.
const CLUBS = ALL_MLB_TEAM_IDS
  .map((id) => ({ id, name: teamFullName(id) }))
  .sort((a, b) => a.name.localeCompare(b.name))
const MID = Math.floor(CLUBS.length / 2)
const TEAMS = [...CLUBS.slice(0, MID), { id: null, name: 'MLB', isAll: true }, ...CLUBS.slice(MID)]

export function AllStarTeamFilter({ selectedTeamId, onSelect }) {
  const stripRef = useRef(null)
  const activeRef = useRef(null)

  // Same centering effect as SplitsVsTeam: keep the selected logo centered
  // horizontally without a page-level scroll jump, on mount and on every pick.
  useEffect(() => {
    const strip = stripRef.current
    const btn = activeRef.current
    if (!strip || !btn) return
    strip.scrollTo({
      left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2,
      behavior: 'smooth',
    })
  }, [selectedTeamId])

  return (
    <div className="vsteam__tray allstarfilter">
      <div
        className="vsteam__strip"
        role="tablist"
        aria-label="Filter rosters by team"
        ref={stripRef}
      >
        {TEAMS.map((t) => {
          const active = t.id === selectedTeamId
          return (
            <button
              key={t.id ?? 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              title={t.name}
              ref={active ? activeRef : null}
              className={`vsteam__team${active ? ' is-active' : ''}`}
              onClick={() => onSelect(t.id)}
            >
              {t.isAll ? (
                <img
                  src={leagueLogoUrl()}
                  alt=""
                  className="allstarfilter__mlblogo"
                  width={36}
                  height={36}
                  aria-hidden="true"
                />
              ) : (
                <TeamLogo teamId={t.id} name={t.name} size={36} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
