import '../../styles/postseason/series-mvp.css'
import { useState } from 'react'
import { actionPhotoUrl } from '../../lib/headshot/actionPhoto.js'
import { HEADSHOT_CROSS_ORIGIN } from '../../lib/headshot/retry.js'
import { mvpStatLine } from '../../lib/postseason/mvpLine.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { TeamLogo } from '../logo/TeamLogo.jsx'
import { Headshot } from '../player/Headshot.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'

// The player's action photo, washed into the stage. Invisible until it loads and gone on an
// error (a 404 means no photo: retired players have none), so the card never shows a broken
// image. Same rule as the World Series Hero's wash.
function Wash({ personId }) {
  const [state, setState] = useState('wait')
  const src = actionPhotoUrl(personId)
  if (!src || state === 'gone') return null
  return (
    <img
      className={`psseries__mvpwash${state === 'ready' ? ' is-ready' : ''}`}
      src={src}
      alt=""
      crossOrigin={HEADSHOT_CROSS_ORIGIN}
      decoding="async"
      onLoad={() => setState('ready')}
      onError={() => setState('gone')}
    />
  )
}

// The official Series MVP (LCS and World Series only) on a navy stage, in the World Series
// Hero's idiom: the player's cut-out and action wash on the right, the award tag, name and
// club on the left, his line from THIS series in a strip along the bottom.
export function SeriesMvpCard({ mvp, lines }) {
  // No face on file (a retired player): the club's mono mark stands in, as on the Hero's empty slab.
  const [noPhoto, setNoPhoto] = useState(false)
  const stats = mvpStatLine(lines, mvp.playerId)
  const club = mvp.teamId ? teamClubNameShort(mvp.teamId) : null
  return (
    <section className="psseries__mvp" aria-label="Series MVP">
      <div className="psseries__mvpstage">
        <div className="psseries__mvpphoto" aria-hidden="true">
          <Wash personId={mvp.playerId} />
          <Headshot personId={mvp.playerId} name={mvp.name} teamId={mvp.teamId} tint={false} hideFallback onFallback={() => setNoPhoto(true)} className="psseries__mvpcut" />
          {noPhoto && mvp.teamId && (
            <TeamLogo teamId={mvp.teamId} name={club ?? ''} variant="mono" size={88} className="psseries__mvpmark" />
          )}
        </div>
        <div className="psseries__mvpwho">
          <span className="psseries__mvptag">Series MVP</span>
          <PlayerLink id={mvp.playerId} className="psseries__mvpname">
            {mvp.name}
          </PlayerLink>
          {club && (
            <span className="psseries__mvpclub">
              <TeamLogo teamId={mvp.teamId} name={club} variant="mono" size={20} />
              {club}
            </span>
          )}
        </div>
      </div>
      {stats.length > 0 && (
        <dl className="psseries__mvpstats">
          {stats.map(([k, v], i) => (
            <div key={k} className="psseries__mvpstat" style={{ '--i': i }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
