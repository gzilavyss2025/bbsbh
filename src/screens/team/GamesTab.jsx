import { useAsync } from '../../hooks/useAsync.js'
import { useNav } from '../../lib/nav.js'
import { teamTransactionsPath } from '../../lib/route.js'
import { ChevronLink } from '../../components/ui/ChevronLink.jsx'
import { AsyncGate } from '../../components/ui/AsyncGate.jsx'
import { TeamTransactionsCard } from '../../components/transactions/TeamTransactionsCard.jsx'
import { isMlbTeamId } from '../../lib/teams.js'
import { TeamHubShell } from './TeamHubShell.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadGames } from './data/loadGames.js'
import { hiddenTeamTabs } from './data/shared.js'
import { AllGames } from './modules/TeamGames.jsx'
import { SeasonSchedule } from './modules/SeasonSchedule.jsx'
import { TeamHighlightsRail } from './modules/media/TeamHighlightsRail.jsx'
import { TeamPhotosRail } from './modules/media/TeamPhotosRail.jsx'

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

// The Games tab: season schedule (the tab's headline), then every decided game
// so far as a grid of ticket stubs — the Overview keeps the last-ten strip, the
// tab that owns games shows them all — then Photos and Transactions, each its
// own full card. See data/loadGames.js for what this tab fetches and why.
export function GamesTab({ id, asOf, sportId }) {
  const navigate = useNav()
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
  const { schedule, allStarGame, seasonGames, photoGames, transactionsPage } = games.data

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
          sportId={sportId}
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

      {seasonGames.length > 0 && isMlbTeamId(team.id) && (
        <TeamHighlightsRail key={`highlights-${team.id}`} teamId={team.id} games={seasonGames} />
      )}

      {photoGames.length > 0 && (
        // `photoGames`, not `seasonGames` — this rail may include a game
        // still in progress (an explicit override; see loadGames.js).
        <TeamPhotosRail key={`photos-${team.id}-${asOf ?? ''}`} teamId={team.id} games={photoGames} />
      )}

      {transactionsPage.days.length > 0 && (
        <>
          <TeamTransactionsCard
            key={`${team.id}-${asOf ?? ''}`}
            teamId={team.id}
            asOf={asOf}
            initialDays={transactionsPage.days}
            initialCursor={transactionsPage.cursor}
            initialHasMore={transactionsPage.hasMore}
          />
          {/* The deck can page the whole season sideways, but it cannot be
              skimmed backwards. The ledger page is the same moves upright —
              and it is where the home slate's wire lands, so a reader who
              arrives from there and then walks the club sees one shape. */}
          <div className="thub-door">
            <ChevronLink
              onClick={() =>
                navigate(teamTransactionsPath(team.id, { name: team.name, d: asOf, s: sportId }))
              }
            >
              All transactions
            </ChevronLink>
          </div>
        </>
      )}
    </TeamHubShell>
  )
}
