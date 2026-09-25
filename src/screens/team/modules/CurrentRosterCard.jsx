import { RosterList } from './RosterList.jsx'
import { SectionHead } from '../../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'

const DASH = '—'

export function CurrentRosterCard({ position, pitchers, season, isMilb, sportId }) {
  return (
    <Card
      head={
        <SectionHead look="band" club>
          Current Roster
        </SectionHead>
      }
    >
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
    </Card>
  )
}
