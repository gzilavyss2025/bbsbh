import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { teamClubNameShort } from '../../lib/teams.js'
import { mvpStatLine } from '../../lib/postseason/mvpLine.js'

// The official Series MVP (LCS and World Series only), with his line from
// THIS series. Styled by the .psseries__mvp award band in 35-postseason-series.css.
export function SeriesMvpCard({ mvp, lines }) {
  const stats = mvpStatLine(lines, mvp.playerId)
  return (
    <section className="psseries__mvp" aria-label="Series MVP">
      <Headshot personId={mvp.playerId} name={mvp.name} teamId={mvp.teamId} className="psseries__mvpshot" />
      <div className="psseries__mvpinfo">
        <span className="psseries__mvptag">Series MVP</span>
        <PlayerLink id={mvp.playerId} className="psseries__mvpname">
          {mvp.name}
        </PlayerLink>
        {mvp.teamId && (
          <span className="psseries__mvpclub">
            <TeamLogo teamId={mvp.teamId} name={teamClubNameShort(mvp.teamId)} size={16} />
            {teamClubNameShort(mvp.teamId)}
          </span>
        )}
      </div>
      {stats.length > 0 && (
        <dl className="psseries__mvpstats">
          {stats.map(([k, v]) => (
            <div key={k} className="psseries__mvpstat">
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
