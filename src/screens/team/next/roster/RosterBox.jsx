import { InjuredMark } from '../../../../components/badges/InjuredMark.jsx'
import { ProspectPill } from '../../../../components/badges/ProspectPill.jsx'
import { RookiePill } from '../../../../components/badges/RookiePill.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Pill } from '../../../../components/ui/control/Pill.jsx'
import { Table } from '../../../../components/ui/table/Table.jsx'
import { DASH, footText, warIsDown, warLeaderId, warSum, warText } from './boxRows.js'

// The roster box of a paper scorecard (direction D, Gary's pick): one ruled table with an ink
// head row. Each row is a lead cell (a position, a rotation slot or a role), the number, the
// name with its marks (and, in the Season view, the arm's line under it), and WAR. A group
// with a title opens on a break row; a foot row sums WAR, group by group and in all. The one
// leading WAR in the box takes the marker pill.
//
//   lead     the first column's head ("Pos", "Role").
//   groups   [{ title?, sum, role?, rows }]; a row is boxRows.js's shape. `sum` names the
//            group in the foot row ("Lineup"). `role` draws each lead as a role chip (the
//            closer in ink).
//   showWar  false for a club with no WAR (MiLB): the column and the foot go.
export function RosterBox({ label, lead, groups, showWar, showProspect, season }) {
  const rows = groups.flatMap((g) => g.rows)
  const leader = showWar ? warLeaderId(rows) : null
  const foot = showWar ? footText(groups) : null
  return (
    <Table frame="bare" label={label} className="rosterbox">
      <thead>
        <tr>
          <th scope="col" className="rosterbox__lead">{lead}</th>
          <th scope="col" className="rosterbox__num">No.</th>
          <th scope="col" className="rosterbox__name">Player</th>
          {showWar && <th scope="col">WAR</th>}
        </tr>
      </thead>
      {groups.map((g) => (
        <tbody key={g.title ?? 'rows'}>
          {g.title && g.rows.length > 0 && (
            <tr className="rosterbox__break">
              <th scope="rowgroup" colSpan={showWar ? 4 : 3}>{g.title}</th>
            </tr>
          )}
          {g.rows.map((r) => (
            <tr key={r.id}>
              <td className="rosterbox__lead">{g.role ? <Pill mark fill={r.lead === 'CL' ? 'ink' : 'outline'}>{r.lead}</Pill> : r.lead}</td>
              <td className="rosterbox__num">{r.jersey || DASH}</td>
              <td className="rosterbox__name">
                <PlayerLink id={r.id} name={r.name}>{r.name}</PlayerLink>
                {r.allStar && <span role="img" aria-label={`${season} All Star`}>★</span>}
                <InjuredMark hurt={r.hurt} />
                {showProspect && <ProspectPill {...r.prospect} />}
                <RookiePill active={r.rookie} />
                {r.line && <span className="t-label rosterbox__line">{r.line}</span>}
              </td>
              {showWar && (
                <td>
                  {r.id === leader ? (
                    <Pill mark figure fill="marker">{warText(r.war)}</Pill>
                  ) : (
                    <span className={warIsDown(r.war) ? 'rosterbox__war--down' : undefined}>{warText(r.war)}</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      ))}
      {foot && (
        <tfoot>
          <tr className="rosterbox__foot">
            <th scope="row" colSpan={3}>{foot}</th>
            <td>{warText(warSum(rows))}</td>
          </tr>
        </tfoot>
      )}
    </Table>
  )
}
