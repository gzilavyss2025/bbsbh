import { fetchTopProspects } from '../api/prospects.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Ledger } from '../components/Ledger.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DASH = '—'

function generatedLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// A standalone replica of MLB Pipeline's Top 100 Prospects list, ranked in
// source order (batters and pitchers interleaved, same as the source),
// linking every row straight into this app's own player/team pages. Data is
// a same-origin static snapshot refreshed weekly — see docs/top-prospects.md
// — so this degrades to a friendly empty state rather than an error when the
// snapshot hasn't been generated yet (or the source page's structure broke
// the scrape).
export function ProspectsPage({ onBack }) {
  useDocumentTitle('Top 100 Prospects')
  const { loading, error, data } = useAsync(() => fetchTopProspects(), [])
  const players = data?.players ?? []

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <button className="topbar__back" onClick={onBack}>
          ‹ Games
        </button>
        <h1 className="topbar__title">Top 100 Prospects</h1>
      </header>

      {loading && !data && <p className="hint">Loading prospect rankings…</p>}
      {error && <p className="hint hint--error">Couldn’t load prospect rankings. Try again.</p>}

      {data && players.length === 0 && (
        <p className="hint">Prospect rankings aren’t available right now — check back later.</p>
      )}

      {players.length > 0 && (
        <>
          {data.generatedAt && (
            <p className="hint">Rankings as of {generatedLabel(data.generatedAt)}.</p>
          )}
          <Ledger
            leftCols={2}
            head={['Rk', 'Player', 'Pos', '#', 'Level', 'Team', 'Line']}
            rows={players.map((p) => ({
              key: p.playerId,
              cells: [
                p.rank,
                <PlayerLink key="player" id={p.playerId}>{p.name}</PlayerLink>,
                p.position || DASH,
                p.number || DASH,
                p.levelRaw || DASH,
                <TeamLink key="team" id={p.teamId} className="prospecttable__teamlogo">
                  <TeamLogo teamId={p.teamId} name={p.team} size={20} />
                </TeamLink>,
                p.statLine || DASH,
              ],
            }))}
          />
        </>
      )}
    </div>
  )
}
