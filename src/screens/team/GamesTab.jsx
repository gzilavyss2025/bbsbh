import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate } from '../../components/AsyncGate.jsx'
import { TeamTransactionsCard } from '../../components/TeamTransactionsCard.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadGames } from './data/loadGames.js'
import { hiddenTeamTabs } from './data/shared.js'
import { AllGames } from './modules/TeamGames.jsx'
import { SeasonSchedule } from './modules/SeasonSchedule.jsx'
import { TeamPhotosRail } from './modules/TeamPhotosRail.jsx'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

// The Games tab: season schedule (the tab's headline), then every decided game
// so far as a grid of ticket stubs — the Overview keeps the last-ten strip, the
// tab that owns games shows them all — then Photos and Transactions, each its
// own full card. See data/loadGames.js for what this tab fetches and why.
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
  const { schedule, allStarGame, seasonGames, transactionsPage } = games.data

  return (
    <TeamHubShell
      team={team}
      record={record}
      manager={manager}
      asOf={asOf}
      sportId={sportId}
      active="games"
      hiddenTabs={hiddenTeamTabs(team)}
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

      {seasonGames.length > 0 && (
        // Keyed so switching club (or dated view) starts the list back at its
        // first page instead of inheriting how far the last one was paged.
        <AllGames key={`games-${team.id}-${asOf ?? ''}`} games={seasonGames} />
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
