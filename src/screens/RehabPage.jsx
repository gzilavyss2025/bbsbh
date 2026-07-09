import { loadRehabAssignments } from '../api/rehab.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { Loader } from '../components/Loader.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DASH = '—'

function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// Every big leaguer currently on a minor-league rehab assignment, league-wide, as
// a grid of player cards — a headshot header, the player's name + position, then
// the move itself (MLB club → the affiliate he's rehabbing at) and that
// affiliate's name with a level badge. The list is small (see api/rehab.js,
// which verifies each stint is still live against the player's game log), so a
// card per player reads better than a dense table and scales to more columns as
// the viewport widens. Data is a live read of the public transactions + game-log
// feeds, spoiler-free like the rest of the roster-move surfaces, so it degrades
// to a friendly empty state rather than an error.
export function RehabPage() {
  useDocumentTitle('Rehab Assignments')
  const { loading, error, data } = useAsync(() => loadRehabAssignments(), [])
  const players = data?.players ?? []
  const updated = monthDay(data?.generatedAt?.slice(0, 10))

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Rehab Assignments</h1>
      </header>

      {loading && !data && <Loader />}
      {error && <p className="hint hint--error">Couldn’t load rehab assignments. Try again.</p>}

      {data && players.length === 0 && (
        <p className="hint hint--prose">No players are on a rehab assignment right now.</p>
      )}

      {players.length > 0 && (
        <>
          <div className="rehabgrid">
            {players.map((p) => (
              <article className="rehabcard" key={p.playerId}>
                <PlayerLink id={p.playerId} className="rehabcard__portrait">
                  <Headshot personId={p.playerId} name={p.playerName} className="rehabcard__shot" />
                </PlayerLink>

                <PlayerLink id={p.playerId} className="rehabcard__name">
                  {p.playerName}
                </PlayerLink>
                <p className="rehabcard__pos">{p.position || DASH}</p>

                <div className="rehabcard__move">
                  {p.orgId ? (
                    <TeamLink id={p.orgId} className="rehabcard__team">
                      <TeamLogo teamId={p.orgId} name={p.orgName} size={34} />
                    </TeamLink>
                  ) : (
                    <TeamLogo teamId={p.orgId} name={p.orgName} size={34} />
                  )}
                  <span className="rehabcard__arrow" aria-hidden="true">→</span>
                  {p.clubId ? (
                    <TeamLink id={p.clubId} className="rehabcard__team">
                      <TeamLogo teamId={p.clubId} name={p.clubName} size={34} />
                    </TeamLink>
                  ) : (
                    <TeamLogo teamId={p.clubId} name={p.clubName} size={34} />
                  )}
                </div>

                <div className="rehabcard__club">
                  <TeamLink id={p.clubId} className="rehabcard__clubname">
                    {p.clubName || DASH}
                  </TeamLink>
                  {p.level && <span className="reg-pill">{p.level}</span>}
                </div>

                {monthDay(p.since) && (
                  <p className="rehabcard__since">Since {monthDay(p.since)}</p>
                )}
              </article>
            ))}
          </div>
          <p className="hint prospects__caption">
            {players.length} {players.length === 1 ? 'player' : 'players'} currently on a rehab assignment
            {updated && ` · updated ${updated}`}.
          </p>
        </>
      )}
    </div>
  )
}
