import '../../styles/report/club-stretch.css'
import { useState } from 'react'
import { clubStretch } from '../../api/streaks/clubStretch.js'
import { CLUB_PITCH_LENGTHS, MLB_SCOPE as MLB, measuresFor } from '../../api/streaks/bestStretch.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { ALL_MLB_TEAM_IDS, teamFullName } from '../../lib/teams.js'
import { pathOf } from '../../lib/route/table.js'
import { useRouteLink } from '../../lib/nav.js'
import { Segmented } from '../../components/ui/control/Segmented.jsx'
import { Button } from '../../components/ui/control/Button.jsx'
import { TeamFilterStrip } from '../../components/team/TeamFilterStrip.jsx'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { InfoPopover } from '../../components/ui/InfoPopover.jsx'
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'

// Club Stretch (/club-stretch, wireframe approved by Gary 2026-11-16): a club's best 162 or
// 154 games in a row by one player, in six stats, top twenty, ten at a time. Static, computed once per season.
// Not a scoring surface, so nothing is sealed (ADR-0034).
// The MLB pin (issue 3133) opens the same boards across MLB, where a run crosses trades.
// Counting stats first, so the default (HR) leads the row.
const CHIPS = {
  hitting: [['hr', 'HR'], ['h', 'Hits'], ['rbi', 'RBI'], ['sb', 'SB'], ['avg', 'AVG'], ['ops', 'OPS']],
  pitching: [['era', 'ERA'], ['whip', 'WHIP'], ['k', 'K'], ['kbb', 'K−BB']],
}
// A rank shared with a neighbour on the same value reads T-4, as the leader boards do.
const rankOf = (rows, i) => {
  const first = rows.findIndex((r) => r.value === rows[i].value) + 1
  return rows.filter((r) => r.value === rows[i].value).length > 1 ? `T-${first}` : String(first)
}
const LENGTHS = {
  hitting: [{ value: '162', label: '162 games' }, { value: '154', label: '154 games' }],
  pitching: [{ value: String(CLUB_PITCH_LENGTHS.starts), label: '32 starts' }, { value: String(CLUB_PITCH_LENGTHS.relief), label: '65 relief' }],
}
const GROUPS = [{ value: 'hitting', label: 'Batting' }, { value: 'pitching', label: 'Pitching' }]
const unitOf = (group, n) => (group === 'hitting' ? 'games' : n === String(CLUB_PITCH_LENGTHS.relief) ? 'relief outings' : 'starts')
const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })

function readQuery(fallbackTeam) {
  const q = new URLSearchParams(window.location.search)
  const team = q.get('team') === MLB ? MLB : Number(q.get('team'))
  const group = q.get('group') === 'pitching' ? 'pitching' : 'hitting'
  const ns = LENGTHS[group].map((l) => l.value)
  return {
    team: team === MLB || ALL_MLB_TEAM_IDS.includes(team) ? team : ALL_MLB_TEAM_IDS.includes(fallbackTeam) ? fallbackTeam : 158,
    group,
    n: ns.includes(q.get('n')) ? q.get('n') : ns[0],
    by: CHIPS[group].some(([k]) => k === q.get('by')) ? q.get('by') : CHIPS[group][0][0],
  }
}

export function ClubStretchPage() {
  const { favoriteTeamId } = useFavoriteTeam()
  const [picks, setPicks] = useState(() => readQuery(favoriteTeamId))
  const update = (patch) => {
    const next = { ...picks, ...patch }
    setPicks(next)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${new URLSearchParams({ team: next.team, group: next.group, n: next.n, by: next.by })}`)
  }
  const link = useRouteLink()
  const mlb = picks.team === MLB
  const club = mlb ? 'MLB' : teamFullName(picks.team)
  useDocumentTitle(`Best Stretch by Club · ${club}`)
  const { data, loading, error, reload } = useAsync(() => clubStretch(picks.team, picks.group), [picks.team, picks.group])
  const measure = measuresFor(picks.group).find((m) => m.key === picks.by)
  const unit = unitOf(picks.group, picks.n)
  const setGroup = (group) => update({ group, n: LENGTHS[group][0].value, by: CHIPS[group][0][0] })
  const rows = data?.boards?.[picks.n]?.[picks.by] ?? []
  // Ten rows, and a button for the next ten; a new board starts at ten again.
  const boardKey = `${picks.team}:${picks.group}:${picks.n}:${picks.by}`
  const [moreFor, setMoreFor] = useState(null)
  const shown = moreFor === boardKey ? rows : rows.slice(0, 10)

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Best Stretch by Club</h1>
      </header>
      <Stack gap="loose" className="cstretch">
        <Stack gap="tight">
          <h2 className="cstretch__title">Best {picks.n} {unit} {mlb ? 'in MLB' : `with the ${club}`}</h2>
          {data?.through && (
            <p className="hint infopop-row">
              Through the {data.through} season · {data.firstSeason}–{data.through}{' '}
              <InfoPopover label="How a run is counted" className="infopop--paper infopop--down">
                {picks.group === 'pitching'
                  ? `His starts (or relief outings), in a row, ${mlb ? 'for any club. A run goes on through a trade' : 'with this club. A run ends when he pitches for another club'}. One row per player. No innings minimum. Tap a name for that run in Best Stretch.`
                  : `His games played, in a row, ${mlb ? 'for any club. A run goes on through a trade' : 'with this club. A run ends when he plays for another club'}. One row per player. AVG and OPS need 3.1 plate appearances per game. Tap a name for that run in Best Stretch.`}
              </InfoPopover>
            </p>
          )}
        </Stack>

        <TeamFilterStrip selectedTeamId={mlb ? null : picks.team} onSelect={(id) => update({ team: id ?? MLB })} ariaLabel="Club" />

        <Cluster className="cstretch__controls">
          <Segmented label="Batting or pitching" value={picks.group} onChange={setGroup} options={GROUPS} />
          <Segmented label="In a row" value={picks.n} onChange={(n) => update({ n })} options={LENGTHS[picks.group]} />
          <Cluster gap="tight" role="group" aria-label="Stat">
            {CHIPS[picks.group].map(([key, label]) => (
              <Button key={key} size="control" skin={key === picks.by ? 'ink' : 'outline'} aria-pressed={key === picks.by} onClick={() => update({ by: key })}>
                {label}
              </Button>
            ))}
          </Cluster>
        </Cluster>

        <AsyncStatus loading={loading} error={error} hasData={rows.length > 0} onRetry={reload}
          errorMessage="Couldn’t load this board. Try again." emptyMessage={mlb ? 'This board isn’t built yet.' : 'No player has a run this long with this club.'} />

        {rows.length > 0 && !loading && (
          <ol className="cstretch__board" aria-label={`${club}, best ${picks.n} ${unit} by ${measure.label}`}>
            {shown.map((r, i) => (
              <li key={r.id}>
                <a className="cstretch__row" {...link(`${pathOf('best-stretch')}?${new URLSearchParams({ group: picks.group, by: picks.by, n: picks.n, club: picks.team, player: r.id, name: r.name })}`)}>
                  <span className="cstretch__rank">{rankOf(rows, i)}</span>
                  <span className="cstretch__who">
                    <span className="cstretch__name">
                      {r.name}
                      {/* A run still reaching into the latest season gets a bright tag (Gary, 2026-11-16). */}
                      {data.through && r.last >= `${data.through}` && <> <span className="cstretch__now"><span className="sr-only">run reaches </span>{data.through}</span></>}
                    </span>
                    <span className="t-label">{r.team} · {shortDate(r.first)} – {shortDate(r.last)}</span>
                  </span>
                  <span className="cstretch__value">{r.value}</span>
                </a>
              </li>
            ))}
          </ol>
        )}
        {shown.length < rows.length && !loading && (
          <Button skin="outline" onClick={() => setMoreFor(boardKey)}>Show {rows.length - shown.length} more</Button>
        )}
      </Stack>
      <ReportFooter />
    </div>
  )
}
