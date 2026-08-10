import { useState } from 'react'
import { fetchTopProspects, resolveCurrentLevels, isPitcher } from '../api/prospects.js'
import { fetchProspectTrend, prospectTrendById, levelTier } from '../api/prospectTrend.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { filterByTeam } from '../lib/teamFilter.js'
import { PlayerLink } from '../components/player/PlayerLink.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { Ledger } from '../components/player/Ledger.jsx'
import { ProspectTrendPill } from '../components/badges/ProspectTrendPill.jsx'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { TeamFilterStrip } from '../components/team/TeamFilterStrip.jsx'
import { VsLevelSlider } from '../components/badges/VsLevelSlider.jsx'
import { ReportFooter } from '../components/chrome/ReportFooter.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DASH = '—'

function generatedLabel(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

async function loadProspects() {
  const [snapshot, trend] = await Promise.all([fetchTopProspects(), fetchProspectTrend()])
  const players = snapshot.players ?? []
  if (!players.length) return { ...snapshot, trend }
  return { ...snapshot, trend, players: await resolveCurrentLevels(players) }
}

// The "Line" cell: one plain string for a player with a season line at just
// one group of levels, or (from resolveCurrentLevels) two prefixed strings —
// "(MLB) …" and "(MiLB) …", the latter summed across every MiLB level he's
// played this year — stacked in place rather than widening the cell.
function LineCell({ lines }) {
  if (!lines?.length) return DASH
  if (lines.length === 1) return lines[0]
  return (
    <span className="prospecttable__lines">
      {lines.map((l) => (
        <span key={l} className="prospecttable__lineitem">{l}</span>
      ))}
    </span>
  )
}

// Batters/Pitchers, same segmented-pill look as GameSelect's own MLB/AAA/AA/
// A+/A level toggle (.levelnav) — a plain "which rows show" filter, not a
// tablist, same footing as LeadersPage's ScopeNav.
const GROUPS = [
  { key: 'all', label: 'All' },
  { key: 'hitting', label: 'Batters' },
  { key: 'pitching', label: 'Pitchers' },
]
function GroupPill({ group, onChange }) {
  return (
    <div className="levelnav" aria-label="Batters or pitchers">
      {GROUPS.map((g) => (
        <button
          key={g.key}
          type="button"
          aria-pressed={group === g.key}
          className={`levelnav__btn ${group === g.key ? 'is-active' : ''}`}
          onClick={() => onChange(g.key)}
        >
          {g.label}
        </button>
      ))}
    </div>
  )
}

// A standalone replica of MLB Pipeline's Top 100 Prospects list, ranked in
// source order (batters and pitchers interleaved, same as the source),
// linking every row straight into this app's own player/team pages. Data is
// a same-origin static snapshot refreshed weekly — see docs/top-prospects.md
// — so this degrades to a friendly empty state rather than an error when the
// snapshot hasn't been generated yet (or the source page's structure broke
// the scrape). Three independent, stackable filters narrow the list: team
// (TeamFilterStrip, a true filter per lib/teamFilter.js, not a highlight),
// vs. Level performance tier (VsLevelSlider, the SAME 1-5 rating the "vs.
// Level" dots draw, not a level-of-play filter), and batter/pitcher
// (GroupPill) — without ever touching `rank`, which is fixed at each
// player's Top 100 position and never recomputed from the filtered array's
// own indices.
export function ProspectsPage() {
  useDocumentTitle('Top 100 Prospects')
  const { loading, error, data } = useAsync(() => loadProspects(), [])
  const [filterTeamId, setFilterTeamId] = useState(null)
  const [filterTier, setFilterTier] = useState(null)
  const [filterGroup, setFilterGroup] = useState('all')
  const allPlayers = data?.players ?? []
  const tierFor = (p) => {
    const entry = prospectTrendById(data?.trend, p.playerId)
    return entry?.qualified ? levelTier(entry.percentile) : null
  }
  const players = filterByTeam(allPlayers, filterTeamId, (p) => p.teamId)
    .filter((p) => filterTier == null || tierFor(p) === filterTier)
    .filter((p) => filterGroup === 'all' || isPitcher(p.position) === (filterGroup === 'pitching'))

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Top 100 Prospects</h1>
      </header>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={allPlayers.length > 0}
        errorMessage="Couldn’t load prospect rankings. Try again."
        emptyMessage="Prospect rankings aren’t available right now — check back later."
        emptyProse
      />

      {allPlayers.length > 0 && (
        <>
          <div className="prospects__filterrow">
            <TeamFilterStrip
              selectedTeamId={filterTeamId}
              onSelect={setFilterTeamId}
              ariaLabel="Filter Top 100 Prospects by team"
            />
            <VsLevelSlider value={filterTier} onChange={setFilterTier} ariaLabel="Filter Top 100 Prospects by vs. Level performance tier" />
          </div>
          <GroupPill group={filterGroup} onChange={setFilterGroup} />
        </>
      )}

      {allPlayers.length > 0 && players.length === 0 && (
        <p className="hint hint--prose">No Top 100 prospects match that filter right now.</p>
      )}

      {players.length > 0 && (
        <>
          {/* "vs. Level", not "Trend". The cell holds a STANDING against
              everyone else qualified at this player's own level this season,
              not a direction, and calling it Trend made a column of static
              figures look like an arrow column that had broken. It also sits
              LAST, after Line: dropped in at position five it pushed Team and
              Line — including the very stat line it summarizes — off the right
              edge of a 390px phone. */}
          <Ledger
            leftCols={2}
            head={['Rk', 'Player', 'Pos', 'Level', 'Team', 'Line', 'vs. Level']}
            rows={players.map((p) => ({
              key: p.playerId,
              cells: [
                p.rank,
                <PlayerLink key="player" id={p.playerId} className="prospecttable__name">{p.name}</PlayerLink>,
                p.position || DASH,
                p.levelLabel || DASH,
                <TeamLink key="team" id={p.teamId} className="prospecttable__teamlogo" ariaLabel={p.team}>
                  <TeamLogo teamId={p.teamId} name={p.team} size={20} />
                </TeamLink>,
                <LineCell key="line" lines={p.lines} />,
                <ProspectTrendPill key="trend" entry={prospectTrendById(data.trend, p.playerId)} />,
              ],
            }))}
          />
          {data.generatedAt && (
            <p className="hint prospects__caption">Rankings as of {generatedLabel(data.generatedAt)}.</p>
          )}
        </>
      )}

      <ReportFooter />
    </div>
  )
}
