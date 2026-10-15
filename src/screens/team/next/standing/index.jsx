import { loadStanding } from '../../data/loadNumbers.js'
import { NumbersBody } from '../../NumbersTab.jsx'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'

// Standing: the Standing share of today's Numbers tab (NumbersBody part="standing"), on its
// own loader, so the first screen does not buy the Ranks reads. The standings and the
// schedule come through SHARED, so the header and the other bands do not buy them again.
const NOOP = () => {}
export default function Standing({ team, asOf, sportId, onReady }) {
  const numbers = useBandData(() => loadStanding(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount: NOOP })
  return <NumbersBody numbers={numbers} team={team} asOf={asOf} sportId={sportId} part="standing" />
}
