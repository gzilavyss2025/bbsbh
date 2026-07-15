import { useEffect, useRef } from 'react'
import { TeamLogo } from './TeamLogo.jsx'
import { ALL_MLB_TEAM_IDS, leagueLogoUrl, teamFullName } from '../lib/teams.js'

// A finger-scrollable strip of every current MLB club's logo, reusing the
// Splits vs Team / Favorite Team picker's tray styling (vsteam__* — see
// index.css) plus an extra "MLB" pseudo-entry (id null = no filter / show
// every team) spliced into the MIDDLE of the alphabetical list, so the
// default selection starts centered like a real pick would. Selecting a
// club is a highlight PICK, not a data filter — the caller decides what
// "highlighted" means (see LeadersPage/AllStarRostersPage's effectiveTeamId).
const CLUBS = ALL_MLB_TEAM_IDS
  .map((id) => ({ id, name: teamFullName(id) }))
  .sort((a, b) => a.name.localeCompare(b.name))
const MID = Math.floor(CLUBS.length / 2)
const TEAMS = [...CLUBS.slice(0, MID), { id: null, name: 'MLB', isAll: true }, ...CLUBS.slice(MID)]

export function TeamFilterStrip({ selectedTeamId, onSelect, ariaLabel, className = '' }) {
  const stripRef = useRef(null)
  const activeRef = useRef(null)

  // Same centering effect as SplitsVsTeam/FavoriteTeamModal: keep the
  // selected logo centered horizontally without a page-level scroll jump, on
  // mount and on every pick.
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
    <div className={`vsteam__tray teamfilterstrip ${className}`.trim()}>
      <div className="vsteam__strip" role="tablist" aria-label={ariaLabel} ref={stripRef}>
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
                  className="teamfilterstrip__mlblogo"
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
