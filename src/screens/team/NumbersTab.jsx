import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate, AsyncStatus } from '../../components/AsyncGate.jsx'
import { useNav } from '../../lib/nav.js'
import { teamLeadersPath, orgLeadersPath } from '../../lib/route.js'
import { teamClubName } from '../../lib/teams.js'
import { FEATURED_CATEGORIES } from '../../api/teamLeaders.js'
import { TeamLeaders } from '../../components/TeamLeaders.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { TeamShelf } from './TeamShelf.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadNumbers } from './data/loadNumbers.js'
import { StandingsCard } from './modules/StandingsCard.jsx'
import { TeamStats, todayDowLabel } from './modules/TeamStatsCard.jsx'
import { ComebackCard } from './modules/ComebackCard.jsx'

function pctLabel(rate) {
  return rate == null ? null : `${Math.round(rate * 100)}%`
}

// Standings, team batting/pitching ranks and team leaders (full), plus the
// day-of-week record and comeback wins shelved — see
// .scratch/team-page-ia/issues/05-numbers-tab.md. The identity header comes
// from the same loadTeamIdentity every tab shares; loadNumbers.js is this
// tab's own body data, fetched independently so switching to this tab never
// pays for another tab's data.
export function NumbersTab({ id, asOf, sportId }) {
  const teamId = Number(id)
  const navigate = useNav()
  const identity = useAsync(() => loadTeamIdentity(teamId, asOf), [teamId, asOf])
  const numbers = useAsync(() => loadNumbers(teamId, asOf), [teamId, asOf])
  const back = () => window.history.back()

  const gate = AsyncGate({
    loading: identity.loading,
    error: identity.error,
    data: identity.data,
    screenClass: 'team-hub',
    noun: 'team',
    onBack: back,
  })
  if (gate) return gate

  const { team, record, manager } = identity.data
  const isMilb = (team.sport?.id ?? 1) !== 1
  const n = numbers.data

  const todayRow = n?.dayOfWeek?.find((r) => r.k === todayDowLabel())
  const dowSummary = todayRow ? `${todayRow.k} ${todayRow.v}` : null
  const sub30 = n?.comeback?.thresholds?.find((t) => t.key === 'sub30')
  const comebackSummary = sub30 ? pctLabel(sub30.rate) ?? `${sub30.wins} win${sub30.wins === 1 ? '' : 's'}` : null

  return (
    <TeamHubShell
      team={team}
      record={record}
      manager={manager}
      asOf={asOf}
      sportId={sportId}
      active="numbers"
    >
      <AsyncStatus
        loading={numbers.loading}
        error={numbers.error}
        hasData={n != null}
        errorMessage="Couldn’t load team numbers. Try again."
      />

      {n && (
        <>
          {n.standings.length > 0 && (
            <StandingsCard
              team={team}
              standings={n.standings}
              asOf={asOf}
              divisionPostseasonOdds={n.divisionPostseasonOdds}
            />
          )}

          {n.batting && <TeamStats title="Team batting" stats={n.batting} />}
          {n.pitching && <TeamStats title="Team pitching" stats={n.pitching} />}

          <TeamLeaders
            pool={n.leaderPool}
            categories={FEATURED_CATEGORIES}
            onSeeAll={() => navigate(teamLeadersPath(teamId, { d: asOf, s: sportId }))}
            showTeamAbbr={false}
            injuredIds={n.injuredIds}
            horizontal
            secondaryAction={
              (!isMilb || team.parentOrgId) && (
                <button
                  type="button"
                  className="tlead__seeall"
                  onClick={() =>
                    navigate(orgLeadersPath(isMilb ? team.parentOrgId : teamId, { d: asOf, s: sportId }))
                  }
                >
                  Org leaders ›
                </button>
              )
            }
          />

          {n.dayOfWeek && (
            <TeamShelf teamId={teamId} title="Record by day of week" summary={dowSummary}>
              {() => (
                <TeamStats
                  title="Record by Day of Week"
                  stats={n.dayOfWeek}
                  note="win pct"
                  highlightKey={todayDowLabel()}
                />
              )}
            </TeamShelf>
          )}

          {n.comeback && (
            <TeamShelf teamId={teamId} title="Comeback wins" summary={comebackSummary}>
              {() => <ComebackCard data={n.comeback} teamId={teamId} clubName={teamClubName(team)} />}
            </TeamShelf>
          )}
        </>
      )}
    </TeamHubShell>
  )
}
