import '../../../../styles/worldseries/pitch.css'
import { useRouteLink } from '../../../../lib/nav.js'
import { pillSolidStyle } from '../../../../lib/design/pillClass.js'
import { surnameOf } from '../../../../lib/postseason/worldseries/scouting/filmRoom.js'
import { teamAbbr, teamClubNameShort } from '../../../../lib/teams.js'
import { PitchMark } from '../../../playbyplay/pitcherCard/PitchMark.jsx'
import { Headshot } from '../../../player/Headshot.jsx'
import { PlayerLink } from '../../../player/PlayerLink.jsx'
import { Pill } from '../../../ui/control/Pill.jsx'
import { Door } from '../../../ui/control/Door.jsx'
import { Card } from '../../../ui/frame/Card.jsx'
import { Table } from '../../../ui/table/Table.jsx'

// PITCH BY PITCH (#2316, slice 2): the probable starter's arsenal, and how the other club's
// regular hitters (not the posted lineup) do against each pitch, set against the league. The
// call is made by lib/postseason/worldseries/scouting/pitchByPitch.js. Open surface (ADR-0034).
//
//   data      loadPitchByPitch(): { starter: { id, name, hand, projected }, hitters, rows }
//   clubId    the starter's club
//   oppId     the hitters' club
//   gameNumber  the Series game the starter is named for
const fig = (x) => (x == null ? '—' : x.toFixed(3).replace(/^0/, ''))
const EDGE = {
  arm: <Pill fill="ink">Arm</Pill>,
  bats: <Pill fill="solid" style={pillSolidStyle({ ground: 'var(--surface-stamped-tint)', text: 'var(--text-heading)' })}>Bats</Pill>,
  even: <span className="ww-pitch__even">Even</span>,
  none: <span className="ww-pitch__even">—</span>,
}

export function PitchByPitch({ data, clubId, oppId, gameNumber }) {
  const routeLink = useRouteLink()
  const { starter, rows, hitters } = data
  const last = surnameOf(starter.name)
  const meta = [starter.hand && `${starter.hand}HP`, teamClubNameShort(clubId), `${starter.projected ? 'projected' : 'probable'}${gameNumber ? ` Game ${gameNumber}` : ''} starter`]
  return (
    <Card frame="stamped" label="Pitch by pitch" count={`${last} vs ${teamAbbr({ id: oppId })}`} body="flush" className="ww-pitch">
      <PlayerLink id={starter.id} name={starter.name} className="ww-pitch__head">
        <Headshot personId={starter.id} name={starter.name} teamId={clubId} className="ww-pitch__shot" />
        <span className="ww-pitch__who">
          <span className="ww-pitch__name">{starter.name}</span>
          <span className="ww-pitch__meta">{meta.filter(Boolean).join(' · ')}</span>
        </span>
      </PlayerLink>
      <Table frame="bare" className="ww-pitch__table">
        <caption className="ww-pitch__cap">
          xwOBA against each pitch. Club hitters, not the posted lineup ({hitters} hitters).
        </caption>
        <thead>
          <tr>
            <th scope="col">Pitch</th>
            <th scope="col">Uses</th>
            <th scope="col">Hitters</th>
            <th scope="col">League</th>
            <th scope="col">Edge</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="ww-pitch__pitch">
                <PitchMark mark={r.mark} />
                {r.name}
              </th>
              <td className="ww-pitch__uses">
                <span className="ww-pitch__bar" style={{ '--uses': `${r.uses}%` }} aria-hidden="true" />
                {r.uses}%
              </td>
              <td>{fig(r.xwoba)}</td>
              <td>{fig(r.league)}</td>
              <td>{EDGE[r.edge ?? 'none']}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Door className="ww-pitch__door" {...routeLink('/scout')}>
        Full scout
      </Door>
    </Card>
  )
}
