import { useAsync } from '../../hooks/useAsync.js'
import { AsyncGate } from '../../components/AsyncGate.jsx'
import { TeamHubShell } from './TeamHubShell.jsx'
import { TeamShelf } from './TeamShelf.jsx'
import { loadTeamIdentity } from './loadTeamIdentity.js'

// STUB. Issue 05 fills this in (standings, batting/pitching ranks, leaders,
// day-of-week record, comeback wins) with its own loadNumbers.js beside this
// file — see RosterTab.jsx for the shape every tab shares.
export function NumbersTab({ id, asOf, sportId }) {
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
      active="numbers"
    >
      <TeamShelf teamId={teamId} title="Numbers">
        {() => <p className="hint">Nothing here yet.</p>}
      </TeamShelf>
    </TeamHubShell>
  )
}
