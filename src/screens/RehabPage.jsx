import { loadRehabAssignments } from '../api/rehab.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Ledger } from '../components/Ledger.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { Loader } from '../components/Loader.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DASH = '—'

function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// Every big leaguer currently on a minor-league rehab assignment, league-wide —
// each row linking to this app's own player/team pages. Data is a live read of
// the public transactions feed (see api/rehab.js), spoiler-free like the rest of
// the roster-move surfaces, so it degrades to a friendly empty state rather than
// an error when nobody's rehabbing or the feed is unreachable.
export function RehabPage() {
  useDocumentTitle('Rehab Assignments')
  const { loading, error, data } = useAsync(() => loadRehabAssignments(), [])
  const players = data?.players ?? []

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
          <Ledger
            leftCols={1}
            head={['Player', 'Pos', 'Org', 'Rehabbing at', 'Since']}
            rows={players.map((p) => ({
              key: p.playerId,
              cells: [
                <PlayerLink key="player" id={p.playerId} className="prospecttable__name">
                  {p.playerName}
                </PlayerLink>,
                p.position || DASH,
                p.orgId ? (
                  <TeamLink key="org" id={p.orgId} className="prospecttable__teamlogo">
                    <TeamLogo teamId={p.orgId} name={p.orgName} size={20} />
                  </TeamLink>
                ) : (
                  DASH
                ),
                p.clubId ? (
                  <TeamLink key="club" id={p.clubId} className="rehabtable__club">
                    <TeamLogo teamId={p.clubId} name={p.clubName} size={16} />
                    <span className="rehabtable__clubname">{p.clubName}</span>
                    {p.level && <span className="reg-pill">{p.level}</span>}
                  </TeamLink>
                ) : (
                  DASH
                ),
                monthDay(p.since) || DASH,
              ],
            }))}
          />
          <p className="hint prospects__caption">
            {players.length} {players.length === 1 ? 'player' : 'players'} currently on a rehab assignment.
          </p>
        </>
      )}
    </div>
  )
}
