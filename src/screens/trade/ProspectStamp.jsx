import { money } from '../../lib/trade/deal.js'
import { teamPrimaryColor, teamClubName, leagueLogoUrl } from '../../lib/teams.js'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'

// A prospect's rank as a scout's rubber stamp, inked in his club's colour and
// set a few degrees off true, with what the rank means and what he is worth
// beside it. It takes the salary and WAR columns, which he has no figures for.
// The stamp's weight is the tier: MLB's top 100 is a solid stamp, a club's top
// 10 a double ring, a deeper club prospect a light single ring.
export function ProspectStamp({ p, teamId, big = false }) {
  const top = Boolean(p.topRank)
  const n = p.topRank || p.orgRank
  const tier = top ? 'mlb' : n <= 10 ? 'club' : 'deep'
  const club = teamClubName(teamId)
  return (
    <span className={`prospectstamp prospectstamp--${tier}${big ? ' prospectstamp--big' : ''}`} style={{ '--stamp-ink': teamPrimaryColor(teamId) || undefined }}>
      <span className="prospectstamp__mark" aria-hidden="true">
        <span className="prospectstamp__seal">
          <span className="prospectstamp__no">No.</span>
          <span className="prospectstamp__n">{n}</span>
        </span>
        {/* Whose list he is on: MLB's logo for the top 100, his club's for its own list. */}
        <span className="prospectstamp__badge">
          {top ? <img src={leagueLogoUrl()} alt="" /> : <TeamLogo teamId={teamId} size={16} />}
        </span>
      </span>
      <span className="prospectstamp__text">
        <span className="prospectstamp__what">{top ? 'Top 100 prospect' : `${club ? `${club}' ` : 'Club '}No. ${n}`}</span>
        {p.value && !big && <span className="prospectstamp__worth">{money(p.value.surplusUsd)} value</span>}
      </span>
      <span className="sr-only">{top ? `MLB's No. ${n} prospect` : `No. ${n} prospect in the ${club ?? 'club'} system`}</span>
    </span>
  )
}
