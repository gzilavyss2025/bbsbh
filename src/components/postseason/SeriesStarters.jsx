import { fetchPitcherLastGame, fetchPitcherSeasonLine } from '../../api/game.js'
import { fetchPitcherPostseasonCareer } from '../../api/postseason/pitcherCareer.js'
import { fetchWorkload } from '../../api/workload.js'
import { projectFromLiveLogs } from '../../api/rotation/liveStarters.js'
import { useAsync } from '../../hooks/useAsync.js'
import { pitcherRole, restLabel, seasonCells } from '../../lib/pitcherCard/card.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { LastAppearance } from '../playbyplay/pitcherCard/LastAppearance.jsx'
import { StatGrid } from '../playbyplay/pitcherCard/SeasonLines.jsx'
import { ProjectedStarters } from '../workload/ProjectedStarters.jsx'
import { SectionHead } from '../ui/frame/SectionHead.jsx'
import { Card } from '../ui/frame/Card.jsx'

// STARTING PITCHERS (live series page): both probable starters for the next
// game, his hand, his season line, his postseason line (this year, then all-time)
// and his last start.
//
// SPOILER FOOTING (ADR-0088, ADR-0087). Every line ends the DAY BEFORE the
// cutoff (fetchPitcherSeasonLine), the last appearance is strictly before it
// (fetchPitcherLastGame), and the postseason row shows a dash for the decision:
// a W or L there would say how an earlier game of this series ended. This is
// deliberately NOT the lineup page's PitcherCard: that card reads the game's own
// feed, and this page never fetches today's feed. A side with no announced
// probable shows the "Likely starters" guess (ADR-0089) and never a headshot or
// a season line for a guess.
//
//   head      "Starting pitchers" or "Next game"
//   note      "Game 3 · Petco Park"
//   game      { date, awayId, homeId, away: arm|null, home: arm|null } from
//             api/postseason/upcoming.js. Days of rest count to its `date`:
//             the page draws a later game here only on today's page, and
//             neither club plays between today and that game.
//   season    the season's year
//   cutoff    the page's cutoff date (ISO)
//   gameNumber  the game's number in the DAY (a doubleheader), 1 here
export function SeriesStarters({ head, note, game, season, cutoff, gameNumber = 1 }) {
  if (!game) return null
  const shared = { season, cutoff, restOn: game.date || cutoff, gameNumber }
  return (
    <section className="psseries__startersection">
      <SectionHead look="label" note={note}>
        {head}
      </SectionHead>
      <Card as="div" body="flush" className="psseries__starters">
        <Starter clubId={game.awayId} arm={game.away} {...shared} />
        <div className="psseries__startersvs" aria-hidden="true">
          <span>vs</span>
        </div>
        <Starter clubId={game.homeId} arm={game.home} {...shared} />
      </Card>
    </section>
  )
}

function Starter({ clubId, arm, season, cutoff, restOn, gameNumber }) {
  const club = teamClubNameShort(clubId)
  const { data } = useAsync(async () => {
    if (!arm?.id) return null
    const [line, post, last] = await Promise.all([
      fetchPitcherSeasonLine(arm.id, season, 1, cutoff),
      fetchPitcherSeasonLine(arm.id, season, 1, cutoff, { postseason: true }),
      fetchPitcherLastGame(arm.id, season, cutoff, gameNumber),
    ])
    const career = await fetchPitcherPostseasonCareer(arm.id, season, post)
    return { line, post, career, last }
  }, [arm?.id, season, cutoff, gameNumber])
  if (!arm) return <NoStarter clubId={clubId} club={club} restOn={restOn} />
  const role = pitcherRole(data?.line)
  const hasPost = (data?.post?.games ?? 0) > 0
  // A second row only when it says more than the first: his earlier Octobers.
  const hasCareer = (data?.career?.games ?? 0) > (data?.post?.games ?? 0)
  return (
    <article className="psseries__starter" aria-label={`${club} starter, ${arm.name}`}>
      <div className="psseries__starterhead">
        <Headshot personId={arm.id} name={arm.name} teamId={clubId} className="psseries__startershot" />
        <div className="psseries__starterwho">
          <PlayerLink id={arm.id} className="psseries__startername">
            {arm.name}
          </PlayerLink>
          <span className="psseries__starterclub">
            {club}
            {arm.hand && <span className="psseries__starterhand">{arm.hand}HP</span>}
          </span>
        </div>
        <TeamLogo teamId={clubId} name={club} size={22} className="psseries__startermark" />
      </div>
      {data && role && (
        <div className="pcard__sec">
          <StatGrid cells={seasonCells(role, data.line)} />
          {hasPost && (
            <>
              <div className="pcard__postrule">
                <span className="pcard__lbl pcard__lbl--ink">{season} postseason</span>
              </div>
              <StatGrid cells={seasonCells(role, data.post, { postseason: true })} />
            </>
          )}
          {hasCareer && (
            <>
              <div className="pcard__postrule">
                <span className="pcard__lbl pcard__lbl--ink">All-time postseason</span>
              </div>
              <StatGrid cells={seasonCells(role, data.career, { postseason: true })} />
            </>
          )}
        </div>
      )}
      {data && !data.line && !data.last && (
        <div className="pcard__sec">
          <span className="pcard__lbl pcard__lbl--ink">MLB debut</span>
        </div>
      )}
      {data?.last && (
        <LastAppearance last={data.last} season={season} sportId={1} rest={restLabel(role, data.last, restOn)} />
      )}
    </article>
  )
}

// No probable posted. Shows the club and "Not announced yet", then the
// days-of-rest guess when the live logs give one (ADR-0089).
function NoStarter({ clubId, club, restOn }) {
  const { data: guess } = useAsync(async () => {
    const workload = await fetchWorkload()
    return projectFromLiveLogs(workload, clubId, restOn)
  }, [clubId, restOn])
  return (
    <article className="psseries__starter psseries__starter--none" aria-label={`${club} starter, not announced`}>
      <div className="psseries__starterhead">
        <TeamLogo teamId={clubId} name={club} size={28} className="psseries__startermark" />
        <div className="psseries__starterwho">
          <span className="psseries__startername">{club}</span>
          <span className="psseries__starternote">Not announced yet</span>
        </div>
      </div>
      <ProjectedStarters rows={guess} />
    </article>
  )
}
