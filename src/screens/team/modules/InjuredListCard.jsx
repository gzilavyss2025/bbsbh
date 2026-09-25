import { RosterList } from './RosterList.jsx'
import { Door } from '../../../components/ui/control/Door.jsx'
import { SectionHead } from '../../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../../components/ui/frame/Card.jsx'

export function InjuredListCard({ injured, season, showInjured, onShowInjured }) {
  return (
    <Card
      head={
        <SectionHead look="band" club>
          Injured List
        </SectionHead>
      }
    >
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
    </Card>
  )
}
