import '../../styles/report/club-stretch.css'
import { useState } from 'react'
import { clubStretch } from '../../api/streaks/clubStretch.js'
import { BAT_MEASURES } from '../../api/streaks/bestStretch.js'
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
import { Cluster } from '../../components/ui/layout/Cluster.jsx'
import { Stack } from '../../components/ui/layout/Stack.jsx'

// Club Stretch (/club-stretch, wireframe approved by Gary 2026-11-16): a club's best 162 or
// 154 games in a row by one player, in six stats, top ten. Static, computed once per season.
// Not a scoring surface, so nothing is sealed (ADR-0034).
const CHIP = { ops: 'OPS', avg: 'AVG', hr: 'HR', h: 'Hits', rbi: 'RBI', sb: 'SB' }
const LENGTHS = [{ value: '162', label: '162 games' }, { value: '154', label: '154 games' }]
const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })

function readQuery(fallbackTeam) {
  const q = new URLSearchParams(window.location.search)
  const team = Number(q.get('team'))
  return {
    team: ALL_MLB_TEAM_IDS.includes(team) ? team : ALL_MLB_TEAM_IDS.includes(fallbackTeam) ? fallbackTeam : 158,
    n: q.get('n') === '154' ? '154' : '162',
    by: BAT_MEASURES.some((m) => m.key === q.get('by')) ? q.get('by') : 'hr',
  }
}

export function ClubStretchPage() {
  const { favoriteTeamId } = useFavoriteTeam()
  const [picks, setPicks] = useState(() => readQuery(favoriteTeamId))
  const update = (patch) => {
    const next = { ...picks, ...patch }
    setPicks(next)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${new URLSearchParams({ team: next.team, n: next.n, by: next.by })}`)
  }
  const link = useRouteLink()
  const club = teamFullName(picks.team)
  useDocumentTitle(`Club Stretch · ${club}`)
  const { data, loading, error, reload } = useAsync(() => clubStretch(picks.team), [picks.team])
  const measure = BAT_MEASURES.find((m) => m.key === picks.by)
  const rows = data?.boards?.[picks.n]?.[picks.by] ?? []

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Club Stretch</h1>
      </header>
      <Stack gap="loose" className="cstretch">
        <Stack gap="tight">
          <h2 className="cstretch__title">Best {picks.n} games in a {club} uniform</h2>
          {data?.through && <p className="hint">Through the {data.through} season · {data.firstSeason}–{data.through}, every city</p>}
        </Stack>

        <TeamFilterStrip selectedTeamId={picks.team} onSelect={(id) => id != null && update({ team: id })} ariaLabel="Club" showMlbPin={false} />

        <Cluster className="cstretch__controls">
          <Segmented label="Games in a row" value={picks.n} onChange={(n) => update({ n })} options={LENGTHS} />
          <Cluster gap="tight" role="group" aria-label="Stat">
            {BAT_MEASURES.map((m) => (
              <Button key={m.key} size="control" skin={m.key === picks.by ? 'ink' : 'outline'} aria-pressed={m.key === picks.by} onClick={() => update({ by: m.key })}>
                {CHIP[m.key]}
              </Button>
            ))}
          </Cluster>
        </Cluster>

        <AsyncStatus loading={loading} error={error} hasData={rows.length > 0} onRetry={reload}
          errorMessage="Couldn’t load this club’s board. Try again." emptyMessage="No player has a run this long with this club." />

        {rows.length > 0 && !loading && (
          <ol className="cstretch__board" aria-label={`${club}, best ${picks.n} games by ${measure.label}`}>
            {rows.map((r, i) => (
              <li key={r.id}>
                <a className="cstretch__row" {...link(`${pathOf('best-stretch')}?${new URLSearchParams({ group: 'hitting', by: picks.by, n: picks.n, club: picks.team, player: r.id, name: r.name })}`)}>
                  <span className="cstretch__rank">{i + 1}</span>
                  <span className="cstretch__who">
                    <span className="cstretch__name">{r.name}</span>
                    <span className="cstretch__meta">{r.team} · {shortDate(r.first)} – {shortDate(r.last)}</span>
                  </span>
                  <span className="cstretch__value">{r.value}</span>
                </a>
              </li>
            ))}
          </ol>
        )}

        <p className="hint">His games played, in a row, with this club; a run ends when he plays for another club. One row per player. AVG and OPS need 3.1 plate appearances per game. Tap a name for that run in Best Stretch.</p>
      </Stack>
      <ReportFooter />
    </div>
  )
}
