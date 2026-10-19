import { Fragment } from 'react'
import '../../../styles/worldseries/glove.css'
import { teamClubNameShort } from '../../../lib/teams.js'
import { TeamLogo } from '../../logo/TeamLogo.jsx'
import { Card } from '../../ui/frame/Card.jsx'
import { SectionHead } from '../../ui/frame/SectionHead.jsx'
import { Stack } from '../../ui/layout/Stack.jsx'

// GLOVE AND LEGS (#2316): defense and baserunning of the two Series clubs, side by side, on the
// Tale of the tape rows. `rows` is gloveLegsModel's output (never null here). The club that leads a
// measure wears the leader mark; a tie or a missing figure marks nobody and a missing one draws a
// gap. Regular-season club totals: an open surface (ADR-0034), no score. Names no club.
const shown = (r, v) => `${r.signed && v > 0 ? '+' : ''}${v}${r.unit === '%' ? '%' : ''}`

function Val({ r, side }) {
  const v = r[side]
  if (v == null) return <span aria-label="no figure">—</span>
  return <span className={r.lead === side ? 'ww-best' : undefined}>{shown(r, v)}</span>
}

export function GloveLegs({ rows, clubIds: [idA, idB] }) {
  const club = (id, flip) => (
    <span className={`ww-tape__club${flip ? ' ww-tape__club--home' : ''}`}>
      {flip && teamClubNameShort(id)}
      <TeamLogo teamId={id} name={teamClubNameShort(id)} size={28} />
      {!flip && teamClubNameShort(id)}
    </span>
  )
  return (
    <Stack gap="snug" className="ww-glove">
      <SectionHead look="rule" as="h3" note="Regular season">
        Glove and legs
      </SectionHead>
      <Card frame="stamped" className="ww-tape">
        <div className="ww-tape__heads">
          {club(idA, false)}
          {club(idB, true)}
        </div>
        <ul className="ww-tape__rows">
          {rows.map((r, i) => (
            <Fragment key={r.key}>
              {rows[i - 1]?.group !== r.group && <li className="ww-glove__group">{r.group}</li>}
              <li className="ww-tape__row">
                <span className="ww-tape__val"><Val r={r} side="a" /></span>
                <span className="ww-tape__label">
                  {r.label}
                  {r.unit === 'ft/s' && ' (ft/s)'}
                </span>
                <span className="ww-tape__val ww-tape__val--home"><Val r={r} side="b" /></span>
              </li>
            </Fragment>
          ))}
        </ul>
      </Card>
    </Stack>
  )
}
