import { useMemo, useState } from 'react'
import { fetchAbsSeriesGames, fmtWinPct, seriesAbsRows } from '../../api/around-the-game/absSeries.js'
import { useAsync } from '../../hooks/useAsync.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { useRouteLink } from '../../lib/nav.js'
import { Door } from '../ui/control/Door.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Card } from '../ui/frame/Card.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'

// ABS CHALLENGES (series page): every player of the two clubs who challenged a
// ball or a strike in a game of THIS series, one combined record each (at bat
// and in the field added), best win % first. The top five show; a door opens
// the rest. It sits under Nine Keys on both series pages.
//
// No spoiler surface: a challenge record is a ball-strike judgment, not a
// score, and only games Final before the page's cutoff count (ADR-0034, ADR-0087;
// the reader is api/around-the-game/absSeries.js). Draw-only apart from the one
// static-file read, which it makes itself so the finished page can mount it below
// its loading gate. Renders nothing until a counted game has a challenge.
//
//   season   the series' season (the file is one season's)
//   clubIds  the two clubs
//   gamePks  the series' counted games
//   cutoff   the page's cutoff date, or null when every game is counted
const SHOWN = 5

export function SeriesAbsReport({ season, clubIds, gamePks, cutoff = null }) {
  const routeLink = useRouteLink()
  const [all, setAll] = useState(false)
  const { data: file } = useAsync(() => fetchAbsSeriesGames(season).catch(() => null), [season])
  const pks = gamePks.join(',')
  const ids = clubIds.join(',')
  const rows = useMemo(
    () => seriesAbsRows(file, { gamePks, clubIds, cutoff }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- joined keys stand for the arrays
    [file, pks, ids, cutoff],
  )
  if (rows.length === 0) return null
  const shown = all ? rows : rows.slice(0, SHOWN)
  return (
    <section className="psseries__abssection">
      <SectionHead look="label" action={<Door {...routeLink('/abs-challenges')}>All challenges</Door>}>
        ABS challenges
      </SectionHead>
      <Card as="div" body="flush" className="psseries__abs">
        <table className="psseries__abstable">
          <caption className="sr-only">ABS challenge record by player, best win percentage first</caption>
          <thead>
            <tr>
              <th scope="col" className="psseries__absrank" aria-label="Rank" />
              <th scope="col">Player</th>
              <th scope="col">W-L</th>
              <th scope="col">Win %</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.playerId} className="psseries__absrow">
                <td className="psseries__absrank">{i + 1}</td>
                <th scope="row" className="psseries__absname">
                  <PlayerLink id={r.playerId} name={r.name} className="psseries__abslink">
                    {r.name}
                  </PlayerLink>
                  <TeamLogo teamId={r.teamId} size={16} className="psseries__abslogo" name={teamClubNameShort(r.teamId)} />
                </th>
                <td className="psseries__absnum">
                  {r.wins}-{r.losses}
                </td>
                <td className="psseries__absnum psseries__abspct">{fmtWinPct(r.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > SHOWN && (
          <Door layout="block" onClick={() => setAll((v) => !v)} aria-expanded={all}>
            {all ? 'Show top 5' : `Show all ${rows.length} players`}
          </Door>
        )}
      </Card>
    </section>
  )
}
