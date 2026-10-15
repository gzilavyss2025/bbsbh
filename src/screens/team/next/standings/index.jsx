import { loadStandings } from '../../data/loadNumbers.js'
import { NumbersBody } from '../../NumbersTab.jsx'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'

// Standings: the Standings share of today's Numbers tab (NumbersBody part="standings"), on its
// own loader, so the first screen does not buy the Ranks reads. The standings and the
// schedule come through SHARED, so the header and the other bands do not buy them again.
const NOOP = () => {}
export default function Standings({ team, asOf, sportId, onReady }) {
  const numbers = useBandData(() => loadStandings(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount: NOOP })
  return (
    <div className="tnext__square">
      {/* The band's head. The shared page-head look is row 7's; until then the band draws its own. */}
      <h2 className="tnext__bandhead">Standings</h2>
      <NumbersBody numbers={numbers} team={team} asOf={asOf} sportId={sportId} part="standings" />
    </div>
  )
}
