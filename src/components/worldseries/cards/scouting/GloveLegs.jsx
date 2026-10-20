import { Fragment } from 'react'
import '../../../../styles/worldseries/glove.css'
import { gloveFigure } from '../../../../lib/postseason/worldseries/scouting/gloveLegs.js'
import { teamClubNameShort } from '../../../../lib/teams.js'
import { TeamLogo } from '../../../logo/TeamLogo.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { Pill } from '../../../ui/control/Pill.jsx'
import { Table } from '../../../ui/table/Table.jsx'

// GLOVE AND LEGS (#2316): defense and baserunning of the two Series clubs, side by side, on the
// Tale of the tape rows. `rows` is gloveLegsModel's output (never null here). The club that leads a
// measure wears the leader mark; a tie or a missing figure marks nobody and a missing one draws a
// gap. Regular-season club totals: an open surface (ADR-0034), no score. Names no club.
function Val({ r, side }) {
  const v = r[side]
  if (v == null) return <span>—<span className="sr-only"> no figure</span></span>
  const leads = r.lead === side
  return (
    <Pill figure mark fill={leads ? 'marker' : 'outline'} className="ww-glove__fig">
      {gloveFigure(r, v)}
      {leads && <span className="sr-only"> leads</span>}
    </Pill>
  )
}

function Club({ id }) {
  return (
    <span className="ww-glove__club">
      <TeamLogo teamId={id} name={teamClubNameShort(id)} size={28} />
      {teamClubNameShort(id)}
    </span>
  )
}

export function GloveLegs({ rows, clubIds }) {
  return (
    <Card frame="stamped" label="Glove and legs" labelAs="h3" count="Regular season" body="flush" className="ww-glove">
      <Table frame="bare" density="keep" className="ww-glove__table">
        <thead>
          <tr>
            <th scope="col" className="ww-glove__val">
              <Club id={clubIds[0]} />
            </th>
            <th scope="col" className="ww-glove__label"><span className="sr-only">Measure</span></th>
            <th scope="col" className="ww-glove__val ww-glove__val--b">
              <Club id={clubIds[1]} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <Fragment key={r.key}>
              {rows[i - 1]?.group !== r.group && (
                <tr className="ww-glove__group">
                  <th scope="colgroup" colSpan={3}>{r.group}</th>
                </tr>
              )}
              <tr>
                <td className="ww-glove__val"><Val r={r} side="a" /></td>
                <th scope="row" className="ww-glove__label">
                  {r.label}
                  {r.unit === 'ft/s' && ' (ft/s)'}
                </th>
                <td className="ww-glove__val ww-glove__val--b"><Val r={r} side="b" /></td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}
