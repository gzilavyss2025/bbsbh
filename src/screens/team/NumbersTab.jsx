import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate, AsyncStatus } from '../../components/ui/AsyncGate.jsx'
import { useNav } from '../../lib/nav.js'
import { teamLeadersPath, orgLeadersPath } from '../../lib/route.js'
import { teamClubName } from '../../lib/teams.js'
import { LEDGER_HITTING, LEDGER_PITCHING } from '../../api/teamLeaders.js'
import { TeamLeadersLedger } from '../../components/teamstats/TeamLeadersLedger.jsx'
import { Door } from '../../components/ui/control/Door.jsx'
import { JerseyCombos, MilbUniformStrip } from '../../components/logo/JerseyCombos.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadNumbers } from './data/loadNumbers.js'
import { hiddenTeamTabs, parentOrgIdOf } from './data/shared.js'
import { StandingsCard } from './modules/StandingsCard.jsx'
import { TeamStats, todayDowLabel } from './modules/TeamStatsCard.jsx'
import { ComebackCard } from './modules/ComebackCard.jsx'
import { TeamRunValueCard } from './modules/TeamRunValueCard.jsx'
import { TeamChallengeCard } from './modules/TeamChallengeCard.jsx'
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
      <NumbersBody numbers={numbers} team={team} asOf={asOf} sportId={sportId} />
    </TeamHubShell>
  )
}

// The tab's body, apart from its shell, so the one-scroll page's Standings and
// Ranks bands (next/standings/, next/ranks/) mount the same cards (#1107). `numbers`
// is the useAsync result. `part` picks a band's share, in the tab's own order:
// 'standings' is the standings table and the record cards, 'ranks' the rank tables
// and the leaders ledger, 'all' (the tab) both.
export function NumbersBody({ numbers, team, asOf, sportId, part = 'all' }) {
  const teamId = team.id
  const navigate = useNav()
  const isMilb = (team.sport?.id ?? 1) !== 1
  const n = numbers.data
  const showStanding = part !== 'ranks'
  const showRanks = part !== 'standings'

  return (
    <>
      <AsyncStatus
        loading={numbers.loading}
        error={numbers.error}
        hasData={n != null}
        errorMessage="Couldn’t load team numbers. Try again."
      />

      {n && (
        <>
          {showStanding && n.standings.length > 0 && (
            <StandingsCard
              team={team}
              standings={n.standings}
              asOf={asOf}
              divisionPostseasonOdds={n.divisionPostseasonOdds}
            />
          )}

          {showRanks && n.batting && <TeamStats title="Team batting" stats={n.batting} />}
          {showRanks && n.pitching && <TeamStats title="Team pitching" stats={n.pitching} />}

          {/* Between the two rank tables and the ledger on purpose: those
              tables rank the club on runs scored and runs allowed, this says
              where the runs CAME from — bats, gloves, legs, arms, on one
              scale — and it names the men carrying it, which reads straight
              into the leaders below. MLB only (Savant runs no minor-league
              board), so an affiliate's page is unchanged. */}
          {showRanks && <TeamRunValueCard data={n.runValue} clubName={teamClubName(team)} />}

          {/* And beside it, the one question the run-value card cannot ask: who
              on this club argues with the plate umpire, against how much
              baseball they see. It is the only place a club's challenge habit
              appears — the league board ranks thirty clubs on one rate and
              cannot show that the same club is last at the plate and third
              behind it. MLB and Triple-A, the two levels that run the rig; a
              club below that draws nothing and fetches nothing. */}
          {showRanks && (
            <TeamChallengeCard
              data={n.absExposureClubs}
              teamId={teamId}
              clubName={teamClubName(team)}
              level={n.absExposureLevel}
            />
          )}

          {/* The full ledger — six categories a side, every one on screen. The
              "See all ›" door goes on to /team/{id}/leaders, which is where the
              headshot card board and the runners-up still live. */}
          {showRanks && (
            <TeamLeadersLedger
              pool={n.leaderPool}
              hitting={LEDGER_HITTING}
              pitching={LEDGER_PITCHING}
              onSeeAll={() => navigate(teamLeadersPath(teamId, { d: asOf, s: sportId }))}
              injuredIds={n.injuredIds}
              secondaryAction={
                (!isMilb || parentOrgIdOf(team)) && (
                  <Door
                    onClick={() =>
                      navigate(orgLeadersPath(isMilb ? parentOrgIdOf(team) : teamId, { d: asOf, s: sportId }))
                    }
                  >
                    Org leaders
                  </Door>
                )
              }
            />
          )}

          {showStanding && n.teamRecords && <RecordsCard data={n.teamRecords} cutoff={n.recordsCutoff} />}

          {showStanding && n.scheduleShape && <LastTimeCard data={n.scheduleShape} cutoff={n.recordsCutoff} />}

          {showStanding && (isMilb || n.jerseyCombos.length > 0) &&
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

          {showStanding && n.dayOfWeek && (
            <TeamStats
              title="Record by Day of Week"
              stats={n.dayOfWeek}
              note="win pct"
              highlightKey={todayDowLabel()}
            />
          )}

          {showStanding && n.comeback && (
            <ComebackCard data={n.comeback} teamId={teamId} clubName={teamClubName(team)} />
          )}
        </>
      )}
    </>
  )
}
