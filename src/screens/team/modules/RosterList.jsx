import { PlayerLink } from '../../../components/player/PlayerLink.jsx'
import { InjuredMark } from '../../../components/badges/InjuredMark.jsx'
import { ProspectPill } from '../../../components/badges/ProspectPill.jsx'
import { RookiePill } from '../../../components/badges/RookiePill.jsx'

const DASH = '—'

export function RosterList({ rows, season, showProspect }) {
  return (
    <ul className="thub-roster">
      {rows.map((r) => (
        <li key={`${r.id}-${r.jersey}`} className="thub-row">
          <span className="thub-jersey">{r.jersey}</span>
          <span className="thub-namewrap">
            <PlayerLink id={r.id} className="thub-name">
              {r.name}
              {r.allStar && (
                <span className="thub-allstar" title={`${season} All Star`}>★</span>
              )}
            </PlayerLink>
            <InjuredMark hurt={r.hurt} />
            {showProspect && <ProspectPill {...r.prospect} />}
            <RookiePill active={r.rookie} />
          </span>
          {r.war !== undefined && (
            <span
              className={`rankchip${r.war == null ? '' : r.war >= 3 ? ' rankchip--good' : r.war < 0 ? ' rankchip--bad' : ''}`}
              title="Season WAR (MLB calc)"
            >
              {r.war == null ? DASH : r.war.toFixed(1)}
            </span>
          )}
          {r.badge && <span className={r.badgeClass}>{r.badge}</span>}
          <span className="thub-chev">›</span>
        </li>
      ))}
    </ul>
  )
}
