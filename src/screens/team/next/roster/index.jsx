import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { loadRoster } from '../../data/loadRoster.js'
import { RosterBody } from '../../RosterTab.jsx'
import { useBandData } from '../useBandData.js'

// Roster: today's Roster tab, as it is.
const count = (r) => r.position.length + r.pitchers.length
export default function Roster({ team, asOf, sportId, onReady, onCount }) {
  const roster = useBandData(() => loadRoster(team.id, asOf), [team.id, asOf], { onReady, onCount, count })
  return (
    <>
      <AsyncStatus loading={roster.loading} error={roster.error} hasData={roster.data != null} errorMessage="Couldn’t load the roster. Try again." />
      {roster.data && <RosterBody teamId={team.id} roster={roster.data} sportId={sportId} />}
    </>
  )
}
