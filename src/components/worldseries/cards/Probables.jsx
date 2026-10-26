import { fetchPostseasonOutings } from '../../../api/postseason/worldSeriesHome.js'
import { fetchWorkload } from '../../../api/workload.js'
import { projectFromLiveLogs } from '../../../api/rotation/liveStarters.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { leadingFigures, pitcherLine } from '../../../lib/postseason/worldseries/probables.js'
import { teamClubNameShort } from '../../../lib/teams.js'
import { TeamLogo } from '../../logo/TeamLogo.jsx'
import { Headshot } from '../../player/Headshot.jsx'
import { Card } from '../../ui/frame/Card.jsx'
import { StatCell, StatStrip } from '../../ui/frame/StatStrip.jsx'
import { Grid } from '../../ui/layout/Grid.jsx'

// PROBABLES: each club's starter for the next game, his headshot and his postseason line (IP,
// ERA, K, BB). A starter MLB has not named is
// the projected one (ADR-0089, the same rule as the series page) and the card
// says "Projected". Every figure ends the day before the slate date.
async function loadSide(clubId, arm, game, season, slateDate) {
  let who = arm?.id ? { id: arm.id, name: arm.name, hand: arm.hand, projected: false } : null
  if (!who) {
    const rows = await projectFromLiveLogs(await fetchWorkload(), clubId, game.date || slateDate)
    const first = rows?.[0]
    who = first ? { id: first.id, name: first.name, hand: '', projected: true } : null
  }
  if (!who) return { clubId, who: null }
  const outings = await fetchPostseasonOutings(who.id, season, slateDate)
  return { clubId, who, line: pitcherLine(outings, slateDate) }
}

const TILES = [
  ['IP', (l) => l.ip],
  ['ERA', (l) => l.era ?? '—'],
  ['K', (l) => l.k],
  ['BB', (l) => l.bb],
]

function Side({ side, other }) {
  const { clubId, who, line } = side
  const club = teamClubNameShort(clubId)
  const leads = leadingFigures(line, other?.line)
  return (
    <section className="ww-prob" aria-label={`${club} starter`}>
      <div className="ww-prob__who">
        <TeamLogo teamId={clubId} name={club} size={28} />
        <span className="ww-prob__name">{who ? who.name : 'Not announced'}</span>
        {who?.hand && <span className="ww-prob__hand">{who.hand}HP</span>}
      </div>
      {who && line && (
        <>
          <p className="ww-prob__line">{`Oct · ${line.gs} GS${line.relief ? `, ${line.relief} relief` : ''}`}</p>
          <div className="ww-prob__body">
            <Headshot personId={who.id} name={who.name} teamId={clubId} className="ww-prob__shot" />
            <StatStrip>
              {TILES.map(([label, show]) => (
                <StatCell key={label} label={label} value={show(line)} className={leads.includes(label) ? 'ww-best' : ''} />
              ))}
            </StatStrip>
          </div>
        </>
      )}
    </section>
  )
}

export function Probables({ game, season, slateDate }) {
  const { data } = useAsync(
    () =>
      game
        ? Promise.all([
            loadSide(game.awayId, game.away, game, season, slateDate),
            loadSide(game.homeId, game.home, game, season, slateDate),
          ])
        : Promise.resolve(null),
    [game?.awayId, game?.homeId, game?.away?.id, game?.home?.id, season, slateDate],
  )
  if (!data || data.every((s) => !s.who)) return null
  const projected = data.some((s) => s.who?.projected)
  return (
    <Card frame="stamped" label="Probables" count={projected ? 'Projected' : undefined} className="ww-probables">
      <Grid min={260} gap="base">
        <Side side={data[0]} other={data[1]} />
        <Side side={data[1]} other={data[0]} />
      </Grid>
    </Card>
  )
}
