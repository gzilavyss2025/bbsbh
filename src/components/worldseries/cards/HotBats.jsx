import { leadSide, pickHotBat } from '../../../lib/postseason/worldseries/hotBats.js'
import { teamClubNameShort } from '../../../lib/teams.js'
import { TeamLogo } from '../../logo/TeamLogo.jsx'
import { Card } from '../../ui/frame/Card.jsx'
import { StatCell, StatStrip } from '../../ui/frame/StatStrip.jsx'
import { Grid } from '../../ui/layout/Grid.jsx'

// HOT BATS: per club, the hitter with the most postseason PA among those with
// OPS 1.000 or better, through the day before the slate date (the splits come
// from fetchHotBatSplits, which ends there). The card hides when neither club
// has one.
const TILES = [
  ['AVG', 'avg'],
  ['OBP', 'obp'],
  ['SLG', 'slg'],
  ['HR', 'hr'],
  ['RBI', 'rbi'],
]

function Bat({ clubId, bat, other }) {
  const club = teamClubNameShort(clubId)
  return (
    <section className="ww-bat" aria-label={`${club} hot bat`}>
      <div className="ww-bat__who">
        <TeamLogo teamId={clubId} name={club} size={28} />
        {bat ? (
          <>
            <span className="ww-bat__name">{bat.name}</span>
            <span className="ww-bat__meta">{`${bat.pos} · ${bat.pa} PA`}</span>
          </>
        ) : (
          <span className="ww-bat__name">{club}</span>
        )}
      </div>
      {bat && (
        <StatStrip>
          {TILES.map(([label, key]) => (
            <StatCell key={key} label={label} value={bat[key]} className={other && leadSide(bat[key], other[key]) === 'a' ? 'ww-best' : ''} />
          ))}
        </StatStrip>
      )}
    </section>
  )
}

export function HotBats({ clubIds, splitsByClub }) {
  const bats = clubIds.map((id) => pickHotBat(splitsByClub?.[id]))
  if (bats.every((b) => !b)) return null
  return (
    <Card frame="stamped" label="Hot bats" count="Oct OPS 1.000+" className="ww-hotbats">
      <Grid min={260} gap="base">
        {clubIds.map((id, i) => (
          <Bat key={id} clubId={id} bat={bats[i]} other={bats[1 - i]} />
        ))}
      </Grid>
    </Card>
  )
}
