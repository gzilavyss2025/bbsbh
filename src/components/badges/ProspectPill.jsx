import { leagueLogoUrl } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Pill } from '../ui/control/Pill.jsx'

// A neutral "prospect" pill (not a performance judgment) for a game's own
// pages (lineups, rosters): the MLB Pipeline mark + overall rank when the
// player is in the national Top 100, else his own org's logo + his rank on
// that org's farm-system leaderboard (1-30). Renders nothing when neither is
// set, so callers can splice it in unconditionally — see prospectBadge
// (src/api/prospects.js) for how these props get resolved from the app's
// Top-100 snapshot. An outline Pill with no ink: a rank on a prospect list is
// not a judgment, so it wears the neutral one. .prospect__tag is the hook the
// context rules and e2e/offseason-home.spec.js hold on to.
export function ProspectPill({ rank, orgRank, orgTeamId, orgTeamName }) {
  if (rank) {
    return (
      <Pill className="prospect__tag">
        <img src={leagueLogoUrl()} alt="" className="prospect__logo" />
        #{rank} PROSPECT
      </Pill>
    )
  }
  if (orgRank) {
    return (
      <Pill className="prospect__tag">
        <TeamLogo teamId={orgTeamId} name={orgTeamName} size={12} />
        #{orgRank} PROSPECT
      </Pill>
    )
  }
  return null
}
