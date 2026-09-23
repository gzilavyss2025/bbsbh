import { RosterList } from './RosterList.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'

export function InjuredListCard({ injured, season, showInjured, onShowInjured }) {
  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Injured List</span>
      </div>
      <div className="thub-card__body">
      {showInjured ? (
        <RosterList
          season={season}
          showProspect={false}
          rows={injured.map((p) => ({ ...p, badge: p.ilLabel, badgeClass: 'ilchip', war: undefined }))}
        />
      ) : (
        <Door layout="block" onClick={onShowInjured}>
          Show {injured.length} injured
        </Door>
      )}
      </div>
    </div>
  )
}
