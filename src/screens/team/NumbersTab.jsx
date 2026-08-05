import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate, AsyncStatus } from '../../components/chrome/AsyncGate.jsx'
import { useNav } from '../../lib/nav.js'
import { teamLeadersPath, orgLeadersPath } from '../../lib/route.js'
import { teamClubName } from '../../lib/teams.js'
import { FEATURED_CATEGORIES } from '../../api/teamLeaders.js'
import { TeamLeaders } from '../../components/TeamLeaders.jsx'
import { ChevronLink } from '../../components/ui/ChevronLink.jsx'
import { JerseyCombos, MilbUniformStrip } from '../../components/JerseyCombos.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadNumbers } from './data/loadNumbers.js'
import { hiddenTeamTabs } from './data/shared.js'
import { StandingsCard } from './modules/StandingsCard.jsx'
import { TeamStats, todayDowLabel } from './modules/TeamStatsCard.jsx'
import { ComebackCard } from './modules/ComebackCard.jsx'

// Standings, team batting/pitching ranks and team leaders (full), plus jersey
// combos, the day-of-week record and comeback wins, each its own full card —
// see .scratch/team-page-ia/issues/05-numbers-tab.md. The identity header
// comes from the same loadTeamIdentity every tab shares; loadNumbers.js is
// this tab's own body data, fetched independently so switching to this tab
// never pays for another tab's data.
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

  return (
    <TeamHubShell
      team={team}
      record={record}
      manager={manager}
      asOf={asOf}
      sportId={sportId}
      active="numbers"
      hiddenTabs={hiddenTeamTabs(team)}
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
                <ChevronLink
                  onClick={() =>
                    navigate(orgLeadersPath(isMilb ? team.parentOrgId : teamId, { d: asOf, s: sportId }))
                  }
                >
                  Org leaders
                </ChevronLink>
              )
            }
          />

          {(isMilb || n.jerseyCombos.length > 0) &&
            (isMilb ? (
              <MilbUniformStrip
                teamId={team.id}
                teamName={team.name}
                homeRecord={n.homeRecord}
                awayRecord={n.awayRecord}
              />
            ) : (
              <JerseyCombos combos={n.jerseyCombos} teamId={team.id} teamName={team.name} />
            ))}

          {n.dayOfWeek && (
            <TeamStats
              title="Record by Day of Week"
              stats={n.dayOfWeek}
              note="win pct"
              highlightKey={todayDowLabel()}
            />
          )}

          {n.comeback && (
            <ComebackCard data={n.comeback} teamId={teamId} clubName={teamClubName(team)} />
          )}
        </>
      )}
    </TeamHubShell>
  )
}
