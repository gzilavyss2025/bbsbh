import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate, AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { useNav } from '../../lib/nav.js'
import { teamLeadersPath, orgLeadersPath } from '../../lib/route.js'
import { teamClubName } from '../../lib/teams.js'
import { LEDGER_HITTING, LEDGER_PITCHING } from '../../api/teamLeaders.js'
import { TeamLeadersLedger } from '../../components/teamstats/TeamLeadersLedger.jsx'
import { ChevronLink } from '../../components/ui/ChevronLink.jsx'
import { JerseyCombos, MilbUniformStrip } from '../../components/logo/JerseyCombos.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadNumbers } from './data/loadNumbers.js'
import { hiddenTeamTabs } from './data/shared.js'
import { StandingsCard } from './modules/StandingsCard.jsx'
import { TeamStats, todayDowLabel } from './modules/TeamStatsCard.jsx'
import { ComebackCard } from './modules/ComebackCard.jsx'
import { TeamRunValueCard } from './modules/TeamRunValueCard.jsx'
import { RecordsCard } from './modules/records/RecordsCard.jsx'
import { LastTimeCard } from './modules/records/LastTimeCard.jsx'

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

          {/* Between the two rank tables and the ledger on purpose: those
              tables rank the club on runs scored and runs allowed, this says
              where the runs CAME from — bats, gloves, legs, arms, on one
              scale — and it names the men carrying it, which reads straight
              into the leaders below. MLB only (Savant runs no minor-league
              board), so an affiliate's page is unchanged. */}
          <TeamRunValueCard data={n.runValue} clubName={teamClubName(team)} />

          {/* The full ledger — six categories a side, every one on screen. The
              "See all ›" door goes on to /team/{id}/leaders, which is where the
              headshot card board and the runners-up still live. */}
          <TeamLeadersLedger
            pool={n.leaderPool}
            hitting={LEDGER_HITTING}
            pitching={LEDGER_PITCHING}
            onSeeAll={() => navigate(teamLeadersPath(teamId, { d: asOf, s: sportId }))}
            injuredIds={n.injuredIds}
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

          {n.teamRecords && <RecordsCard data={n.teamRecords} cutoff={n.recordsCutoff} />}

          {n.scheduleShape && <LastTimeCard data={n.scheduleShape} cutoff={n.recordsCutoff} />}

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
