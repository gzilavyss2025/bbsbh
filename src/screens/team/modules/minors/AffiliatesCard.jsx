import { SPORT_LABEL } from '../../../../lib/teams.js'
import { useLinkScope, useRouteLink } from '../../../../lib/nav.js'
import { teamTabPath } from '../../../../lib/route.js'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'
import { Pill } from '../../../../components/ui/control/Pill.jsx'
import { SectionHead } from '../../../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../../../components/ui/frame/Card.jsx'

const DASH = '—'

export function AffiliatesCard({ affiliates }) {
  return (
    <Card
      head={
        <SectionHead look="band" club>
          Affiliates
        </SectionHead>
      }
    >
      <div className="thub-affiliates">
        {affiliates.map((a) => (
          <AffiliateTile key={a.id} a={a} />
        ))}
      </div>
    </Card>
  )
}

// The whole tile is the link to the club's page, so it is a Card link (the
// interactive card: its hover tint and focus ring), and a real anchor, so a
// middle-click or "open in new tab" works (useRouteLink). A MiLB club is not
// in the static name table, so its address takes the name its own feed gave
// us (ADR-0057).
function AffiliateTile({ a }) {
  const linkProps = useRouteLink()
  const { asOf, sportId } = useLinkScope()
  const path = teamTabPath(a.id, 'overview', { name: a.name, d: asOf, s: sportId })
  return (
    <Card as="a" body="flush" className="thub-affiliate" {...linkProps(path)}>
      <Pill fill="paper" figure className="thub-affiliate__level">{SPORT_LABEL[a.sportId] ?? DASH}</Pill>
      <TeamLogo teamId={a.id} name={a.name} size={48} />
      <span className="thub-affiliate__name">{a.name}</span>
      {a.city && (
        <span className="thub-affiliate__loc">
          {a.city}{a.state ? `, ${a.state}` : ''}
        </span>
      )}
    </Card>
  )
}
