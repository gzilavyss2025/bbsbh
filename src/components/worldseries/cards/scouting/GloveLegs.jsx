import { Fragment } from 'react'
import '../../../../styles/worldseries/glove.css'
import { gloveFigure } from '../../../../lib/postseason/worldseries/scouting/gloveLegs.js'
import { teamClubNameShort } from '../../../../lib/teams.js'
import { TeamLogo } from '../../../logo/TeamLogo.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { SectionHead } from '../../../ui/frame/SectionHead.jsx'
import { Stack } from '../../../ui/layout/Stack.jsx'

// GLOVE AND LEGS (#2316): defense and baserunning of the two Series clubs, side by side, on the
// Tale of the tape rows. `rows` is gloveLegsModel's output (never null here). The club that leads a
// measure wears the leader mark; a tie or a missing figure marks nobody and a missing one draws a
// gap. Regular-season club totals: an open surface (ADR-0034), no score. Names no club.
function Val({ r, side }) {
  const v = r[side]
  if (v == null) return <span>—<span className="sr-only"> no figure</span></span>
  const leads = r.lead === side
  return (
    <span className={leads ? 'ww-best' : undefined}>
      {gloveFigure(r, v)}
      {leads && <span className="sr-only"> leads</span>}
    </span>
  )
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
