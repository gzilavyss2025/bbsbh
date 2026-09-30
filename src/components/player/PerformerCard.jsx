import { Headshot } from './Headshot.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLink } from '../team/TeamLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { ProspectPill } from '../badges/ProspectPill.jsx'
import { isMlbTeamId } from '../../lib/teams.js'
import { Card } from '../ui/frame/Card.jsx'

// "Tyler Tolbert" -> ["Tyler", "Tolbert"] (everything after the first space).
// Used so the name wraps to two lines next to the bigger headshot, without a
// fixed split table.
function splitFirstLast(full) {
  const i = (full ?? '').indexOf(' ')
  return i === -1 ? [full ?? '', ''] : [full.slice(0, i), full.slice(i + 1)]
}

// One "baseball card" tile: headshot (with position floated on it as a small
// badge, same idiom as the former-teammates cards' .teammate__posbadge),
// name (a clickable PlayerLink), team logo + abbreviation + an optional
// prospect pill, stat line underneath. Shared by the Statcast leaders box,
// the box score's Insights card, and each result card's Dominant Performance
// / Blowout / Extra-Innings pill — entry fields a given caller doesn't carry
// (prospectRank/orgProspectRank) simply render nothing, rather than growing a
// second "baseball card" style per caller.
export function PerformerCard({ entry }) {
  const [first, last] = splitFirstLast(entry.name)
  return (
    <Card as="li" frame="ledger" body="flush" className="playerline">
      <span className="playerline__shotwrap">
        <Headshot
          personId={entry.id}
          name={entry.name}
          teamId={entry.parentOrgId ?? entry.teamId}
          isMlb={isMlbTeamId(entry.teamId)}
          className="playerline__shot"
        />
        {entry.position && <span className="playerline__posbadge">{entry.position}</span>}
      </span>
      <div className="playerline__body">
        <div className="playerline__name">
          <PlayerLink id={entry.id} name={entry.name}>
            {first} {last && <br className="playerline__namebreak" />}
            {last}
          </PlayerLink>
        </div>
        <div className="playerline__team">
          <TeamLogo teamId={entry.teamId} name={entry.teamAbbr} size={16} />
          <TeamLink id={entry.teamId}>{entry.teamAbbr}</TeamLink>
          {(entry.prospectRank || entry.orgProspectRank) && (
            <ProspectPill
              rank={entry.prospectRank}
              orgRank={entry.orgProspectRank}
              orgTeamId={entry.parentOrgId}
              orgTeamName={entry.teamAbbr}
            />
          )}
        </div>
        <div className="playerline__stat">{entry.stat}</div>
      </div>
    </Card>
  )
}
