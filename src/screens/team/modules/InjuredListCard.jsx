import { RosterList } from './RosterList.jsx'

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
        <button type="button" className="pshistory__more" onClick={onShowInjured}>
          Show {injured.length} injured
        </button>
      )}
      </div>
    </div>
  )
}
