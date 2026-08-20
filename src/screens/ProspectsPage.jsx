import { useState } from 'react'
import { fetchTopProspects, resolveCurrentLevels, isPitcher } from '../api/prospects.js'
import { fetchProspectTrend, prospectTrendById, levelTier, LEVEL_STANDING_BANDS } from '../api/prospectTrend.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { filterByTeam } from '../lib/teamFilter.js'
import { teamFullName } from '../lib/teams.js'
import { PlayerLink } from '../components/player/PlayerLink.jsx'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
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
function LineCell({ lines, level }) {
  if (!lines?.length) return DASH
  const splitLine = (line) => {
    const match = line.match(/^\((MLB|MiLB)\)\s*(.*)$/)
    return match ? { scope: match[1], stats: match[2] } : { scope: level === 'MLB' ? 'MLB' : 'MiLB', stats: line }
  }
  return (
    <span className={`prospecttable__lines${lines.length > 1 ? ' prospecttable__lines--split' : ''}`}>
      {lines.map((line) => {
        const { scope, stats } = splitLine(line)
        return (
          <span key={line} className={`prospecttable__lineitem prospecttable__lineitem--${scope === 'MLB' ? 'mlb' : 'milb'}`}>
            <span className="prospecttable__linetag">{scope}</span>
            <span className="prospecttable__linestats">{stats}</span>
          </span>
        )
      })}
    </span>
  )
}

function AssignmentCell({ player }) {
  return (
    <span className="prospectboard__assignment">
      <span className="prospectboard__position">{player.position || DASH}</span>
      <span className="prospectboard__level">{player.levelLabel || DASH}</span>
      <TeamLink
        id={player.teamId}
        name={player.team}
        className="prospectboard__club"
        ariaLabel={player.team}
      >
        <TeamLogo teamId={player.teamId} name={player.team} size={18} />
        <span>{player.team}</span>
      </TeamLink>
    </span>
  )
}

function ProspectBoard({ players, trend, selectedId, onSelect }) {
  return (
    <div className="prospectboard-wrap">
      <table className="prospectboard">
        <caption className="sr-only">MLB Pipeline Top 100 ranking with current level, season line, and standing versus level</caption>
        <thead>
          <tr>
            <th scope="col">Pipeline rk</th>
            <th scope="col">Player</th>
            <th scope="col">Pos · current level · club</th>
            <th scope="col">2026 season line</th>
            <th scope="col">Standing vs level</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => {
            const isSelected = player.playerId === selectedId
            return (
              <tr
                key={player.playerId}
                className={isSelected ? 'is-selected' : ''}
                onPointerDown={() => onSelect(player.playerId)}
                onFocusCapture={() => onSelect(player.playerId)}
              >
                <td className="prospectboard__rank" data-label="Pipeline rank"><span>{player.rank}</span></td>
                <td className="prospectboard__identity" data-label="Player">
                  <PlayerLink id={player.playerId} className="prospecttable__name">{player.name}</PlayerLink>
                </td>
                <td className="prospectboard__assignmentcell" data-label="Current level"><AssignmentCell player={player} /></td>
                <td className="prospectboard__linecell" data-label="2026 season line"><LineCell lines={player.lines} level={player.levelLabel} /></td>
                <td className="prospectboard__standingcell" data-label="Standing vs level">
                  <ProspectTrendPill entry={prospectTrendById(trend, player.playerId)} level={player.levelLabel} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
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
// standing band (VsLevelSlider, the same five-band scale every standing cell
// and Prospect Card names, not a level-of-play filter), and batter/pitcher
// (GroupPill) — without ever touching `rank`, which is fixed at each
// player's Top 100 position and never recomputed from the filtered array's
// own indices.
export function ProspectsPage() {
  useDocumentTitle('Top 100 Prospects')
  const { loading, error, data } = useAsync(() => loadProspects(), [])
  const [filterTeamId, setFilterTeamId] = useState(null)
  const [filterTier, setFilterTier] = useState(null)
  const [filterGroup, setFilterGroup] = useState('all')
  const [secondaryOpen, setSecondaryOpen] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const allPlayers = data?.players ?? []
  const tierFor = (p) => {
    const entry = prospectTrendById(data?.trend, p.playerId)
    return entry?.qualified ? levelTier(entry.percentile) : null
  }
  const players = filterByTeam(allPlayers, filterTeamId, (p) => p.teamId)
    .filter((p) => filterTier == null || tierFor(p) === filterTier)
    .filter((p) => filterGroup === 'all' || isPitcher(p.position) === (filterGroup === 'pitching'))
  const activeFilters = [
    filterTeamId == null ? null : teamFullName(filterTeamId),
    filterGroup === 'all' ? null : GROUPS.find((group) => group.key === filterGroup)?.label,
    filterTier == null ? null : LEVEL_STANDING_BANDS[filterTier],
  ].filter(Boolean)
  const hasActiveFilters = activeFilters.length > 0
  const selectedId = players.some((p) => p.playerId === selectedPlayerId) ? selectedPlayerId : players[0]?.playerId
  const resetFilters = () => {
    setFilterTeamId(null)
    setFilterTier(null)
    setFilterGroup('all')
  }
  const filterSummary = hasActiveFilters ? activeFilters.join(' · ') : 'All prospects'

  return (
    <div className="screen">
      <SiteHeader />
      <header className="prospects__header">
        <div>
          <h1 className="topbar__title">Top 100 Prospects</h1>
          <p className="prospects__dateline">
            MLB Pipeline ranking{data?.generatedAt ? ` · ${generatedLabel(data.generatedAt)}` : ''}
          </p>
        </div>
        {allPlayers.length > 0 && (
          <p className="prospects__resultcount" aria-live="polite" aria-atomic="true">
            {players.length} shown
          </p>
        )}
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
        <section className="prospects__filterdeck" aria-labelledby="prospect-filter-title">
          <div className="prospects__filterhead">
            <h2 id="prospect-filter-title">Filter prospects</h2>
            {hasActiveFilters && (
              <button type="button" className="prospects__reset" onClick={resetFilters}>
                Clear all
              </button>
            )}
          </div>

          <div className="prospects__filterfield prospects__filterfield--role">
            <p className="prospects__filterlabel">Role</p>
            <GroupPill group={filterGroup} onChange={setFilterGroup} />
          </div>

          <button
            type="button"
            className="prospects__secondary-toggle"
            aria-expanded={secondaryOpen}
            aria-controls="prospect-secondary-filters"
            onClick={() => setSecondaryOpen((open) => !open)}
          >
            <span>{secondaryOpen ? 'Hide team & performance' : 'Team & performance'}</span>
            <span className="prospects__toggle-summary">{filterSummary}</span>
          </button>

          <div
            id="prospect-secondary-filters"
            className={`prospects__secondary${secondaryOpen ? ' is-open' : ''}`}
          >
            <div className="prospects__filterfield prospects__filterfield--team">
              <p className="prospects__filterlabel">Team</p>
              <TeamFilterStrip
                selectedTeamId={filterTeamId}
                onSelect={setFilterTeamId}
                ariaLabel="Filter Top 100 Prospects by team"
              />
            </div>
            <div className="prospects__filterfield prospects__filterfield--performance">
              <p className="prospects__filterlabel">Standing band</p>
              <VsLevelSlider
                value={filterTier}
                onChange={setFilterTier}
                ariaLabel="Filter Top 100 Prospects by standing band versus current level"
              />
            </div>
          </div>

          <p className="prospects__active-summary" aria-live="polite">
            <span>{hasActiveFilters ? 'Active' : 'Showing'}</span> {filterSummary}
          </p>
        </section>
      )}

      {allPlayers.length > 0 && players.length === 0 && (
        <div className="prospects__empty" role="status">
          <p>No Top 100 prospects match those filters.</p>
          <button type="button" className="prospects__reset" onClick={resetFilters}>Clear filters</button>
        </div>
      )}

      {players.length > 0 && (
        <>
          <ProspectBoard
            players={players}
            trend={data.trend}
            selectedId={selectedId}
            onSelect={setSelectedPlayerId}
          />
          <p className="hint prospects__caption">Pipeline rank stays fixed when the board is filtered. Standing compares OPS or ERA with qualified players at the same level.</p>
        </>
      )}

      <ReportFooter />
    </div>
  )
}
