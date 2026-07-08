import { leagueLogoUrl } from '../lib/teams.js'
import { TeamLogo } from './TeamLogo.jsx'

// A neutral "prospect" pill (not a performance judgment) for a game's own
// pages (lineups, rosters): the MLB Pipeline mark + overall rank when the
// player is in the national Top 100, else his own org's logo + his rank on
// that org's farm-system leaderboard (1-30). Renders nothing when neither is
// set, so callers can splice it in unconditionally — see prospectBadge
// (src/api/prospects.js) for how these props get resolved from the app's
// Top-100 snapshot.
export function ProspectPill({ rank, orgRank, orgTeamId, orgTeamName }) {
  if (rank) {
    return (
      <span className="prospectpill">
        <img src={leagueLogoUrl()} alt="" className="prospectpill__logo" />
        #{rank} PROSPECT
      </span>
    )
  }
  if (orgRank) {
    return (
      <span className="prospectpill">
        <TeamLogo teamId={orgTeamId} name={orgTeamName} size={12} />
        #{orgRank} PROSPECT
      </span>
    )
  }
  return null
}
