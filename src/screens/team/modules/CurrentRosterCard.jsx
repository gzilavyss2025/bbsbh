import { RosterList } from './RosterList.jsx'

const DASH = '—'

export function CurrentRosterCard({ position, pitchers, season, isMilb, sportId }) {
  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Current Roster</span>
      </div>
      <div className="thub-card__body">
      <div className="roster-cols">
        {position.length > 0 && (
          <div>
            <h4 className="roster-sub__title">Position players{sportId === 1 ? ' · season WAR' : ''}</h4>
            <RosterList
              season={season}
              showProspect={isMilb}
              rows={position.map((p) => ({ ...p, badge: p.pos, badgeClass: 'thub-pos' }))}
            />
          </div>
        )}
        {pitchers.length > 0 && (
          <div>
            <h4 className="roster-sub__title">Pitchers · role inferred{sportId === 1 ? ' · season WAR' : ''}</h4>
            <RosterList
              season={season}
              showProspect={isMilb}
              rows={pitchers.map((p) => ({
                ...p,
                badge: p.role ?? DASH,
                badgeClass: `rolechip${p.role === 'RP' ? ' rolechip--rp' : p.role === 'CL' ? ' rolechip--cl' : ''}`,
              }))}
            />
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
