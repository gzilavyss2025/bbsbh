import { Headshot } from '../../../../components/player/Headshot.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { TeamLogo } from '../../../../components/logo/TeamLogo.jsx'

const DASH = '—'
// Org prospect list starts collapsed to the top 10, expandable to the full ~30.
const PROSPECTS_PREVIEW_COUNT = 10
// Headshot spotlight strip above the ranked table shows only the very top of
// the list; how many of these actually render is viewport-width-driven (see
// .prospectshowcase in index.css), this is just the outer cap.
const PROSPECT_SHOWCASE_COUNT = 5

export function ProspectsCard({ prospects, showAllProspects, onShowAll }) {
  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Prospects</span>
        <em>org rank</em>
      </div>
      <div className="thub-card__body">
      <div className="prospectshowcase">
        {prospects.slice(0, PROSPECT_SHOWCASE_COUNT).map((p) => (
          <PlayerLink
            key={p.playerId}
            id={p.playerId}
            name={p.name}
            className="prospectshowcase__card"
          >
            <span className="prospectshowcase__shotwrap">
              <Headshot personId={p.playerId} name={p.name} teamId={p.affiliateTeamId} className="prospectshowcase__shot" />
              {p.position && <span className="prospectshowcase__posbadge">{p.position}</span>}
            </span>
            <span className="prospectshowcase__name">{p.name}</span>
          </PlayerLink>
        ))}
      </div>
      <div className="ledger-wrap">
        <table className="ledger prospecttable">
          <thead>
            <tr>
              <th className="lft">Rk</th>
              <th className="lft">Player</th>
              <th>Pos</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {(showAllProspects ? prospects : prospects.slice(0, PROSPECTS_PREVIEW_COUNT)).map((p) => {
              const isTop = p.topRank != null
              return (
                <tr key={p.playerId}>
                  <td className="lft yr">{p.orgRank}</td>
                  <td className="lft ledger__sub">
                    <PlayerLink id={p.playerId} className="prospecttable__name">{p.name}</PlayerLink>
                    {isTop && <span className="prospecttable__top">#{p.topRank}</span>}
                  </td>
                  <td>{p.position || DASH}</td>
                  <td className="prospecttable__level">
                    <span>{p.levelLabel || DASH}</span>
                    {p.affiliateTeamId && (
                      <TeamLogo teamId={p.affiliateTeamId} name={p.levelLabel} size={16} crop />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!showAllProspects && prospects.length > PROSPECTS_PREVIEW_COUNT && (
          <button type="button" className="pshistory__more" onClick={onShowAll}>
            Show all {prospects.length} prospects
          </button>
        )}
      </div>
      </div>
    </div>
  )
}
