import { upcomingGameLabel } from '../../screens/postseason-live/selectors.js'
import { dayShape } from '../../lib/postseason/dayShape.js'
import { teamAbbr } from '../../lib/teams.js'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Card } from '../ui/frame/Card.jsx'

// STILL TO PLAY (live series page): one row per game ahead of today.
//
// A DATED game also shows its park, the shape of the days before it ("Travel
// day before"), and, on today's page only, its announced probable pitchers. An
// "IF NECESSARY" game shows none of that: it has no date, park or pitcher, and
// a line there would say whether the series runs long (ADR-0087, R3 in
// docs/api/postseason.md). Nothing here is a result.
//
//   games     the series' `upcoming` rows, today's game already removed
//   details   { [gamePk]: { venue, awayId, homeId, away, home } } from
//             api/postseason/upcoming.js (may be empty: a failed read just drops
//             the extra lines)
//   previous  { date, venueId } of the game before the first row (today's, else
//             the last counted one), or null before Game 1
//   showArms  false on a past `?d=`: the schedule now holds the starter who
//             really pitched, picked after that date
//   formatDate  ISO date -> the page's date words
export function StillToPlay({ games, details, previous, showArms, formatDate }) {
  if (!games?.length) return null
  // Each row measures its gap from the nearest DATED row above it, else from
  // the game before the list. An if-necessary row has no date to measure from.
  const dated = games.map((g) =>
    g.date ? { date: g.date, venueId: details?.[g.gamePk]?.venue.id ?? null } : null,
  )
  const before = (i) => {
    for (let k = i - 1; k >= 0; k--) if (dated[k]) return dated[k]
    return previous
  }
  return (
    <section className="psseries__upcoming">
      <SectionHead look="label">Still to play</SectionHead>
      <Card as="div" body="flush">
        <ul className="psseries__upcominglist">
          {games.map((g, i) => {
            const info = g.date && g.gamePk ? details?.[g.gamePk] : null
            const shape = info ? dayShape(before(i), { date: g.date, venueId: info.venue.id }) : ''
            const meta = [info?.venue.name, shape].filter(Boolean).join(' · ')
            return (
              <li key={g.gameNumber} className="psseries__upcomingrow">
                <span className="psseries__upcominggame">Game {g.gameNumber}</span>
                <span className="psseries__upcomingdate">{upcomingGameLabel(g, formatDate)}</span>
                {meta && <span className="psseries__upcomingmeta">{meta}</span>}
                {showArms && info && <UpcomingArms info={info} />}
              </li>
            )
          })}
        </ul>
      </Card>
    </section>
  )
}

function UpcomingArms({ info }) {
  if (!info.away && !info.home) {
    return <span className="psseries__upcomingarms psseries__upcomingarms--none">Starters not announced yet.</span>
  }
  return (
    <span className="psseries__upcomingarms">
      <Arm clubId={info.awayId} arm={info.away} />
      <span className="psseries__armsep" aria-hidden="true">
        ·
      </span>
      <Arm clubId={info.homeId} arm={info.home} />
    </span>
  )
}

function Arm({ clubId, arm }) {
  const abbr = teamAbbr({ id: clubId })
  if (!arm) {
    return (
      <span className="psseries__arm psseries__arm--tba">
        <span className="psseries__armclub">{abbr}</span> TBA
      </span>
    )
  }
  return (
    <span className="psseries__arm">
      <span className="psseries__armclub">{abbr}</span>{' '}
      <PlayerLink id={arm.id} className="psseries__armname">
        {arm.name}
      </PlayerLink>
      {arm.hand && <span className="psseries__armhand"> {arm.hand}HP</span>}
    </span>
  )
}
