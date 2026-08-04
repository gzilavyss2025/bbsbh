import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate } from '../../components/AsyncGate.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'
import { loadRoster } from './data/loadRoster.js'
import { lineupDefenseFrom, hiddenTeamTabs } from './data/shared.js'
import { RosterProjection } from './modules/RosterProjection.jsx'
import { CurrentRosterCard } from './modules/CurrentRosterCard.jsx'
import { InjuredListCard } from './modules/InjuredListCard.jsx'

// Roster tab: the season roster projection (full, at the top — this is the
// tab's headline), then the 40-man Current Roster and the Injured List, each
// its own full card. Its own loadRoster.js fetches only what those three
// need — see
// .scratch/team-page-ia/issues/03-roster-tab.md. Runs alongside
// loadTeamIdentity (the shell's own cheap loader every tab pays for) rather
// than duplicating its fetches here.
export function RosterTab({ id, asOf, sportId }) {
  const teamId = Number(id)
  const identity = useAsync(() => loadTeamIdentity(teamId, asOf), [teamId, asOf])
  const roster = useAsync(() => loadRoster(teamId, asOf), [teamId, asOf])
  const back = () => window.history.back()

  // Season / Current toggle, keyed by team id so client-side navigation to a
  // different club naturally resets to the Current default rather than
  // inheriting the last club's chosen view (same idiom TeamPage.jsx used).
  const [seasonRosterTeamId, setSeasonRosterTeamId] = useState(null)

  const gate = AsyncGate({
    loading: identity.loading || roster.loading,
    error: identity.error || roster.error,
    data: identity.data && roster.data ? true : null,
    screenClass: 'team-hub',
    noun: 'team',
    onBack: back,
  })
  if (gate) return gate

  const {
    season,
    isMilb,
    position,
    pitchers,
    injured,
    preferredLineup,
    substitutes,
    startingPitchers,
    bullpen,
    recentPreferredLineup,
    recentSubstitutes,
    recentStartingPitchers,
    recentBullpen,
  } = roster.data

  const injuredIds = new Set(injured.map((p) => p.id))
  // Same diamond row shape the Overview's lineup preview uses (shared.js), so
  // the two surfaces can't drift on how a hurt player is flagged.
  const preferredLineupDefense = lineupDefenseFrom(preferredLineup, injuredIds)
  const recentPreferredLineupDefense = lineupDefenseFrom(recentPreferredLineup, injuredIds)
  const hasRecentRoster =
    recentPreferredLineup.length > 0 ||
    recentSubstitutes.length > 0 ||
    recentStartingPitchers.length > 0 ||
    recentBullpen.length > 0
  // Defaults to the Current window whenever that data exists — a club with no
  // completed games yet always renders the Season card instead.
  const showRecentRoster = hasRecentRoster && seasonRosterTeamId !== teamId
  const rosterLineup = showRecentRoster ? recentPreferredLineupDefense : preferredLineupDefense
  const rosterSubs = showRecentRoster ? recentSubstitutes : substitutes
  const rosterSP = showRecentRoster ? recentStartingPitchers : startingPitchers
  const rosterBullpen = showRecentRoster ? recentBullpen : bullpen

  return (
    <TeamHubShell
      team={identity.data.team}
      record={identity.data.record}
      manager={identity.data.manager}
      asOf={asOf}
      sportId={sportId}
      active="roster"
      hiddenTabs={hiddenTeamTabs(identity.data.team)}
    >
      {(preferredLineup.length > 0 || substitutes.length > 0 || startingPitchers.length > 0 || bullpen.length > 0) && (
        <RosterProjection
          hasRecentRoster={hasRecentRoster}
          showRecentRoster={showRecentRoster}
          onShowSeason={() => setSeasonRosterTeamId(teamId)}
          onShowCurrent={() => setSeasonRosterTeamId(null)}
          rosterLineup={rosterLineup}
          rosterSubs={rosterSubs}
          rosterSP={rosterSP}
          rosterBullpen={rosterBullpen}
          injuredIds={injuredIds}
          season={season}
          isMilb={isMilb}
        />
      )}

      {(position.length > 0 || pitchers.length > 0) && (
        <CurrentRosterCard position={position} pitchers={pitchers} season={season} isMilb={isMilb} sportId={sportId} />
      )}

      {injured.length > 0 && (
        <InjuredListCard injured={injured} season={season} showInjured onShowInjured={() => {}} />
      )}
    </TeamHubShell>
  )
}
