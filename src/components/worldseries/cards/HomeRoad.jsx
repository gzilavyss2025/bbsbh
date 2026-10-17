import { homeRoad } from '../../../lib/postseason/worldseries/homeRoad.js'
import { teamClubNameShort } from '../../../lib/teams.js'
import { TeamLogo } from '../../logo/TeamLogo.jsx'
import { Card } from '../../ui/frame/Card.jsx'
import { Stack } from '../../ui/layout/Stack.jsx'

// HOME AND ROAD (off day): per club, a row of W/L blocks at home and one on the
// road, in date order, with the W–L count at the end of each row. Postseason
// results dated before the slate date only (homeRoad re-applies the cutoff).
function Row({ label, marks, record }) {
  return (
    <li className="ww-hr__row">
      <span className="ww-hr__label">{label}</span>
      <span className="ww-hr__marks">
        {marks.map((m, i) => (
          <span key={i} className={`ww-hr__mark ww-hr__mark--${m}`}>
            {m}
          </span>
        ))}
      </span>
      <span className="ww-hr__record">{`${record.wins}–${record.losses}`}</span>
    </li>
  )
}

export function HomeRoad({ clubIds, clubGames, slateDate }) {
  const sides = clubIds.map((id) => ({ id, hr: homeRoad(clubGames?.[id], id, slateDate) }))
  if (sides.every((s) => s.hr.home.length + s.hr.road.length === 0)) return null
  return (
    <Card frame="stamped" label="Home and road" className="ww-homeroad">
      <Stack gap="base">
        {sides.map(({ id, hr }) => (
          <section key={id} aria-label={`${teamClubNameShort(id)} home and road`}>
            <div className="ww-hr__club">
              <TeamLogo teamId={id} name={teamClubNameShort(id)} size={24} />
              {teamClubNameShort(id)}
            </div>
            <Stack as="ul" gap="tight" className="ww-hr__rows">
              <Row label="Home" marks={hr.home} record={hr.homeRecord} />
              <Row label="Road" marks={hr.road} record={hr.roadRecord} />
            </Stack>
          </section>
        ))}
      </Stack>
    </Card>
  )
}
