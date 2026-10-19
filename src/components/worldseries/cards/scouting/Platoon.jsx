import '../../../../styles/worldseries/fit.css'
import { teamClubNameShort } from '../../../../lib/teams.js'
import { TeamLogo } from '../../../logo/TeamLogo.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { Stack } from '../../../ui/layout/Stack.jsx'

// PLATOON (#2316): each Series club's lineup OPS against right- and left-handers (regular season).
// `blocks` is platoonModel's output (never null here). The higher OPS wears the leader mark (an
// underline plus hidden text, never colour alone); the cell for the hand a club faces in the next
// game is tinted and says so in its caption. Open surface (ADR-0034): no score. Names no club.
const figure = (v) => v.toFixed(3).replace(/^0/, '')

function Cell({ cell }) {
  const name = teamClubNameShort(cell.clubId)
  return (
    <div className={`ww-platoon__cell${cell.faces ? ' ww-platoon__cell--faces' : ''}`}>
      <span className="ww-platoon__club">
        <TeamLogo teamId={cell.clubId} name={name} size={28} />
        {name}
      </span>
      <span className={`ww-platoon__ops${cell.lead ? ' ww-best' : ''}`}>
        {figure(cell.ops)}
        {cell.lead && <span className="sr-only"> leads</span>}
      </span>
      <span className="ww-platoon__cap">{cell.caption}</span>
    </div>
  )
}

export function Platoon({ blocks }) {
  return (
    <Card frame="stamped" label="Platoon" labelAs="h3" count="Lineup OPS" className="ww-platoon">
      <Stack gap="base">
        {blocks.map((b) => (
          <section key={b.hand} aria-label={b.title}>
            <h4 className="ww-platoon__head">{b.title}</h4>
            <div className="ww-platoon__cells">
              {b.cells.map((c) => (
                <Cell key={c.clubId} cell={c} />
              ))}
            </div>
          </section>
        ))}
      </Stack>
    </Card>
  )
}
