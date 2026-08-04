import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate } from '../../components/AsyncGate.jsx'
import { TeamTransactionsCard } from '../../components/TeamTransactionsCard.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadGames } from './data/loadGames.js'
import { LastTenGames } from './modules/LastTenGames.jsx'
import { SeasonSchedule } from './modules/SeasonSchedule.jsx'
import { TeamPhotosRail } from './modules/TeamPhotosRail.jsx'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

// The Games tab: season schedule (the tab's headline), the last-ten strip,
// then Photos and Transactions, each its own full card. See data/loadGames.js
// for what this tab fetches and why.
export function GamesTab({ id, asOf, sportId }) {
  const teamId = Number(id)
  const identity = useAsync(() => loadTeamIdentity(teamId, asOf), [teamId, asOf])
  const games = useAsync(() => loadGames(teamId, asOf), [teamId, asOf])
  const back = () => window.history.back()

  const gate = AsyncGate({
    loading: identity.loading || games.loading,
    error: identity.error || games.error,
    data: identity.data && games.data ? true : null,
    screenClass: 'team-hub',
    noun: 'team',
    onBack: back,
  })
  if (gate) return gate

  const { team, record, manager } = identity.data
  const { schedule, allStarGame, recentGames, seasonGames, transactionsPage } = games.data

  return (
    <TeamHubShell
      team={team}
      record={record}
      manager={manager}
      asOf={asOf}
      sportId={sportId}
      active="games"
    >
      {schedule.length > 0 && (
        <SeasonSchedule
          teamId={team.id}
          asOf={asOf}
          schedule={schedule}
          allStarGame={allStarGame}
          refDate={asOf || isoToday()}
        />
      )}

      {recentGames.length > 0 && (
        <LastTenGames teamId={team.id} asOf={asOf} recentGames={recentGames} seasonGames={seasonGames} />
      )}

      {seasonGames.length > 0 && (
        // `seasonGames` (not the raw schedule) keeps this spoiler-safe, see
        // loadGames.js.
        <TeamPhotosRail key={`photos-${team.id}-${asOf ?? ''}`} teamId={team.id} games={seasonGames} />
      )}

      {transactionsPage.days.length > 0 && (
        <TeamTransactionsCard
          key={`${team.id}-${asOf ?? ''}`}
          teamId={team.id}
          asOf={asOf}
          initialDays={transactionsPage.days}
          initialCursor={transactionsPage.cursor}
          initialHasMore={transactionsPage.hasMore}
        />
      )}
    </TeamHubShell>
  )
}
