import { Fragment } from 'react'
import { InjuredMark } from '../../../../components/badges/InjuredMark.jsx'
import { ProspectPill } from '../../../../components/badges/ProspectPill.jsx'
import { RookiePill } from '../../../../components/badges/RookiePill.jsx'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Pill } from '../../../../components/ui/control/Pill.jsx'
import { Table } from '../../../../components/ui/table/Table.jsx'
import { warText, warLeaderId, warSum } from './boxRows.js'

// The roster box of a paper scorecard (direction D, Gary's pick): one ruled table with an ink
// head row. Each row is a lead cell (a position, a rotation slot or a role), the number, the
// name with its marks (and, in the Season view, the arm's line under it), and WAR. A group with a title opens on a
// break row; a foot row sums WAR. The one leading WAR in the box takes the marker pill.
//
//   lead     the first column's head ("Pos", "Role").
//   groups   [{ title?, role?, rows }]; a row is boxRows.js's shape. `role` draws each lead
//            as a role chip (the closer in ink).
//   showWar  false for a club with no WAR (MiLB): the column and the foot go.
//   foot     the foot row's label, or nothing.
export function RosterBox({ label, lead, groups, showWar, showProspect, season, foot }) {
  const rows = groups.flatMap((g) => g.rows)
  const leader = showWar ? warLeaderId(rows) : null
  const span = showWar ? 4 : 3
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
      <tbody>
        {groups.map((g) => (
          <Fragment key={g.title ?? 'rows'}>
            {g.title && g.rows.length > 0 && (
              <tr className="rosterbox__break">
                <th scope="colgroup" colSpan={span}>{g.title}</th>
              </tr>
            )}
            {g.rows.map((r) => (
              <tr key={`${g.title ?? ''}-${r.id}`}>
                <td className="rosterbox__lead">{g.role ? <Pill mark fill={r.lead === 'CL' ? 'ink' : 'outline'}>{r.lead}</Pill> : r.lead}</td>
                <td className="rosterbox__num">{r.jersey || '—'}</td>
                <td className="rosterbox__name">
                  <PlayerLink id={r.id} name={r.name} className="rosterbox__link">{r.name}</PlayerLink>
                  {r.allStar && <span className="rosterbox__star" role="img" aria-label={`${season} All Star`}>★</span>}
                  <InjuredMark hurt={r.hurt} />
                  {showProspect && <ProspectPill {...r.prospect} />}
                  <RookiePill active={r.rookie} />
                  {r.line && <span className="rosterbox__line">{r.line}</span>}
                </td>
                {showWar && (
                  <td>
                    {r.id === leader ? (
                      <Pill mark figure fill="marker">{warText(r.war)}</Pill>
                    ) : (
                      <span className={r.war < 0 ? 'rosterbox__war rosterbox__war--down' : 'rosterbox__war'}>{warText(r.war)}</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </Fragment>
        ))}
        {showWar && foot && (
          <tr className="rosterbox__foot">
            <th scope="row" colSpan={span - 1}>{foot}</th>
            <td>{warSum(rows).toFixed(1)}</td>
          </tr>
        )}
      </tbody>
    </Table>
  )
}
