import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate } from '../../components/AsyncGate.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { TeamShelf } from './TeamShelf.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'

// STUB. Issue 03 fills this in (roster projection, 40-man, injured list) with
// its own loadRoster.js beside this file; everything below the shell is
// placeholder. The shell + its identity loader are the part that is real, and
// they are what lets issues 03–06 build their four tabs in parallel.
export function RosterTab({ id, asOf, sportId }) {
  const teamId = Number(id)
  const { loading, error, data } = useAsync(() => loadTeamIdentity(teamId, asOf), [teamId, asOf])
  const back = () => window.history.back()

  const gate = AsyncGate({ loading, error, data, screenClass: 'team-hub', noun: 'team', onBack: back })
  if (gate) return gate

  return (
    <TeamHubShell
      team={data.team}
      record={data.record}
      manager={data.manager}
      asOf={asOf}
      sportId={sportId}
      active="roster"
    >
      <TeamShelf teamId={teamId} title="Roster">
        {() => <p className="hint">Nothing here yet.</p>}
      </TeamShelf>
    </TeamHubShell>
  )
}
