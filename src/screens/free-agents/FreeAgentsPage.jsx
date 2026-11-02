import { useMemo, useState } from 'react'
import {
  loadFreeAgents,
  loadLastDeals,
  filterFreeAgents,
  summarizeFreeAgents,
  POSITION_GROUPS,
} from '../../api/free-agents/freeAgents.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useNav } from '../../lib/nav.js'
import { monthDayName } from '../../lib/dates.js'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { StatTile } from '../../components/ui/frame/StatTile.jsx'
import { Chips } from '../../components/ui/control/Chips.jsx'
import { Switch } from '../../components/ui/control/Switch.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { EmptyState } from '../../components/ui/state/EmptyState.jsx'
import { TeamFilterStrip } from '../../components/team/TeamFilterStrip.jsx'
import { PlayerLink } from '../../components/player/PlayerLink.jsx'
import { Headshot } from '../../components/player/Headshot.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { Grid } from '../../components/ui/layout/Grid.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import '../../styles/free-agents/page.css'

const DASH = '—'

// The class still signing: players file once the World Series ends, so from
// October on it is this year's, and until then last year's.
export function latestClassSeason(now = new Date()) {
  return now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1
}

const ALL = 'all'
const POSITION_OPTIONS = [{ value: ALL, label: 'All' }, ...POSITION_GROUPS.map((g) => ({ value: g, label: g }))]

// The free-agent class (#2509, wireframe approved 2026-11-02): four header
// tiles, the filters, then one row per player — headshot, name, last club's
// logo and position, status (unsigned, or old → new club and the date), the
// feed's note, the deal that just ran out, age and season line, and WAR. A
// list on a phone; the same rows lay out as table columns from 900px (CSS).
// Open surface (ADR-0034): nothing here is a game result.
export function FreeAgentsPage({ season: routeSeason }) {
  const season = routeSeason ?? latestClassSeason()
  useDocumentTitle(`${season} MLB Free Agents`)
  const navigate = useNav()
  const { loading, error, data, reload } = useAsync((signal) => loadFreeAgents(season, { signal }), [season])
  const rows = useMemo(() => data ?? [], [data])

  const [group, setGroup] = useState(ALL)
  const [teamId, setTeamId] = useState(null)
  const [unsignedOnly, setUnsignedOnly] = useState(false)
  const [includeMinors, setIncludeMinors] = useState(false)

  const summary = useMemo(() => summarizeFreeAgents(rows), [rows])
  const shown = filterFreeAgents(rows, { group: group === ALL ? null : group, teamId, unsignedOnly, includeMinors })
  // Deals for the rows on screen only, not the whole class.
  const shownKey = shown.map((r) => r.id).join(',')
  const { data: deals } = useAsync(
    () => (shownKey ? loadLastDeals(shownKey.split(',').map(Number), season) : Promise.resolve({})),
    [shownKey, season],
  )

  return (
    <div className="screen fa">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">{season} MLB Free Agents</h1>
      </header>

      {loading && !data && <p className="hint" role="status">Reading the free-agent list…</p>}

      {error && !data && (
        <EmptyState role="alert" className="fa__state">
          <p>The free-agent list did not load.</p>
          <Button skin="ink" onClick={reload}>Try again</Button>
        </EmptyState>
      )}

      {data && rows.length === 0 && (
        <EmptyState role="status" className="fa__state">
          <p>No one has filed for free agency yet. Players file after the World Series ends.</p>
          <Door onClick={() => navigate(`/free-agents/${season - 1}`)}>See the {season - 1} class</Door>
        </EmptyState>
      )}

      {rows.length > 0 && (
        <>
          <Grid min={150} gap="base" className="fa__tiles">
            <StatTile tone="ink" label="Still unsigned" value={summary.unsigned} caption={`of ${summary.declared} who filed`} />
            <StatTile
              tone="tint"
              label="Signed"
              value={summary.signed}
              caption={summary.latest ? `Latest: ${summary.latest.name}, ${monthDayName(summary.latest.dateSigned)}` : 'None yet'}
            />
            <StatTile
              label="Best unsigned"
              value={summary.best ? summary.best.war.toFixed(1) : DASH}
              caption={summary.best ? `${summary.best.name} · WAR` : 'No WAR on file'}
            />
            <StatTile label="Options declined" value={summary.optionsDeclined} caption="Club, player or mutual" />
          </Grid>

          <Stack gap="snug" className="fa__filters">
            <Chips label="Position" options={POSITION_OPTIONS} value={group} onChange={setGroup} layout="wrap" />
            <Cluster gap="base">
              <Switch label="Unsigned only" checked={unsignedOnly} onChange={setUnsignedOnly} />
              <Switch label="Include minor-league" checked={includeMinors} onChange={setIncludeMinors} />
            </Cluster>
            <TeamFilterStrip selectedTeamId={teamId} onSelect={setTeamId} ariaLabel="Filter free agents by last club" className="fa__clubs" />
          </Stack>

          {shown.length === 0 ? (
            <EmptyState role="status">No free agents match these filters.</EmptyState>
          ) : (
            <div className="fa__table" role="table" aria-label={`${season} free agents`}>
              <div className="fa__row fa__row--head" role="row">
                <span role="columnheader">Player</span>
                <span role="columnheader">Last club</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Last deal</span>
                <span role="columnheader">{season} stats</span>
                <span role="columnheader" className="fa__num">WAR</span>
              </div>
              {shown.map((r) => (
                <FreeAgentRow key={r.id} row={r} deal={deals?.[r.id]} season={season} />
              ))}
            </div>
          )}
          <p className="hint">
            {shown.length} {shown.length === 1 ? 'player' : 'players'}.
          </p>
        </>
      )}

      <ReportFooter />
    </div>
  )
}

function FreeAgentRow({ row: r, deal, season }) {
  const statsText = [r.age != null ? `Age ${r.age}` : null, r.stats || null].filter(Boolean).join(' · ') || DASH
  return (
    <div className="fa__row" role="row">
      <span className="fa__player" role="cell">
        <PlayerLink id={r.id} name={r.name} className="fa__shot" ariaLabel={r.name}>
          <Headshot personId={r.id} name={r.name} teamId={r.teamId} className="fa__face" />
        </PlayerLink>
        <span className="fa__who">
          <PlayerLink id={r.id} className="fa__name">{r.name}</PlayerLink>
          {r.note && <span className="fa__note">{r.note}</span>}
        </span>
      </span>
      <span className="fa__club" role="cell">
        <TeamLogo teamId={r.teamId} name={r.teamName} size={24} />
        <span className="sr-only">{r.teamName}</span>
        <span className="fa__pos">{r.pos || DASH}</span>
      </span>
      <span className="fa__status" role="cell">
        {r.resigned ? (
          <>
            <span className="fa__tag fa__tag--signed">Re-signed</span>
            <TeamLogo teamId={r.teamId} name={r.teamName} size={20} />
            <span className="sr-only">with {r.teamName}</span>
            <span className="fa__date">{monthDayName(r.dateSigned)}</span>
          </>
        ) : r.signed ? (
          <>
            <span className="fa__tag fa__tag--signed">Signed</span>
            <TeamLogo teamId={r.teamId} name={r.teamName} size={20} />
            <span aria-hidden="true">→</span>
            <TeamLogo teamId={r.newTeamId} name={r.newTeamName} size={20} />
            <span className="sr-only">to {r.newTeamName}</span>
            <span className="fa__date">{monthDayName(r.dateSigned)}</span>
          </>
        ) : (
          <span className="fa__tag">Unsigned</span>
        )}
      </span>
      <span className="fa__deal" role="cell">
        <span className="fa__label">Last deal </span>
        {deal || DASH}
      </span>
      <span className="fa__stats" role="cell">
        <span className="fa__label">{season} </span>
        {statsText}
      </span>
      <span className="fa__war fa__num" role="cell">
        {r.war != null ? r.war.toFixed(1) : DASH}
        <span className="fa__label"> WAR</span>
      </span>
    </div>
  )
}
