import { fetchPostseasonOutings } from '../../../api/postseason/worldSeriesHome.js'
import { fetchWorkload } from '../../../api/workload.js'
import { projectFromLiveLogs } from '../../../api/rotation/liveStarters.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { leadSide } from '../../../lib/postseason/worldseries/hotBats.js'
import { pitchBars, pitcherLine } from '../../../lib/postseason/worldseries/probables.js'
import { teamClubNameShort } from '../../../lib/teams.js'
import { TeamLogo } from '../../logo/TeamLogo.jsx'
import { Card } from '../../ui/frame/Card.jsx'
import { Key } from '../../ui/frame/Key.jsx'
import { StatCell, StatStrip } from '../../ui/frame/StatStrip.jsx'
import { Grid } from '../../ui/layout/Grid.jsx'

// PROBABLES: each club's starter for the next game, his postseason line (IP,
// ERA, K, BB) and a bar per postseason outing. A starter MLB has not named is
// the projected one (ADR-0089, the same rule as the series page) and the card
// says "Projected". Every figure ends the day before the slate date.
const MAX_PITCHES = 120
const swatch = (kind) => <span className={`ww-swatch ww-swatch--${kind}`} aria-hidden="true" />
const KEY = [
  { label: 'Start', mark: swatch('start') },
  { label: 'Latest', mark: swatch('latest') },
  { label: 'Relief', mark: swatch('relief') },
  { label: 'Pitches', mark: <span className="ww-swatch ww-swatch--count" aria-hidden="true">#</span> },
]

async function loadSide(clubId, arm, game, season, slateDate) {
  let who = arm?.id ? { id: arm.id, name: arm.name, hand: arm.hand, projected: false } : null
  if (!who) {
    const rows = await projectFromLiveLogs(await fetchWorkload(), clubId, game.date || slateDate)
    const first = rows?.[0]
    who = first ? { id: first.id, name: first.name, hand: '', projected: true } : null
  }
  if (!who) return { clubId, who: null }
  const outings = await fetchPostseasonOutings(who.id, season, slateDate)
  return { clubId, who, line: pitcherLine(outings, slateDate), bars: pitchBars(outings, slateDate) }
}

function Bars({ bars }) {
  const peak = Math.max(MAX_PITCHES, ...bars.map((b) => b.pitches))
  return (
    <ol className="ww-bars">
      {bars.map((b, i) => (
        <li key={i} className="ww-bars__item">
          <span className="ww-bars__count">{b.pitches}</span>
          <span className={`ww-bars__bar ww-bars__bar--${b.kind}`} style={{ height: `${(b.pitches / peak) * 100}%` }} />
          <span className="ww-bars__label">
            {b.date.slice(5).replace('-', '/')} {b.away ? '@' : ''}
            {b.opp}
          </span>
        </li>
      ))}
    </ol>
  )
}

const TILES = [
  ['IP', (l) => l.ip, (l) => l.ipValue, false],
  ['ERA', (l) => l.era ?? '—', (l) => (l.era == null ? null : Number(l.era)), true],
  ['K', (l) => l.k, (l) => l.k, false],
  ['BB', (l) => l.bb, (l) => l.bb, true],
]

function Side({ side, other }) {
  const { clubId, who, line, bars } = side
  const club = teamClubNameShort(clubId)
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
          <StatStrip>
            {TILES.map(([label, show, num, lowerWins]) => {
              const lead = other?.line?.games && line.games ? leadSide(num(line), num(other.line), { lowerWins }) : null
              return <StatCell key={label} label={label} value={show(line)} className={lead ? 'ww-best' : ''} />
            })}
          </StatStrip>
          {bars.length > 0 && <Bars bars={bars} />}
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
      <Key items={KEY} className="ww-probables__key" />
    </Card>
  )
}
