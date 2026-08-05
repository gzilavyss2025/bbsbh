import { SPORT_LABEL } from '../../../lib/teams.js'
import { TeamLink } from '../../../components/team/TeamLink.jsx'
import { TeamLogo } from '../../../components/logo/TeamLogo.jsx'

const DASH = '—'

export function AffiliatesCard({ affiliates }) {
  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Affiliates</span>
      </div>
      <div className="thub-card__body">
      <div className="thub-affiliates">
        {affiliates.map((a) => (
          <TeamLink key={a.id} id={a.id} className="thub-affiliate">
            <span className="thub-affiliate__level">{SPORT_LABEL[a.sportId] ?? DASH}</span>
            <TeamLogo teamId={a.id} name={a.name} size={48} />
            <span className="thub-affiliate__name">{a.name}</span>
            {a.city && (
              <span className="thub-affiliate__loc">
                {a.city}{a.state ? `, ${a.state}` : ''}
              </span>
            )}
          </TeamLink>
        ))}
      </div>
      </div>
    </div>
  )
}
