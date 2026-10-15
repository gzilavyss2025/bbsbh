import { loadRanks } from '../../data/loadNumbers.js'
import { NumbersBody } from '../../NumbersTab.jsx'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'

// Ranks: the rank tables and the leaders ledger, the Ranks share of the Numbers tab, on its
// own loader. The club's /stats lines come through SHARED, which Farm reads too.
const NOOP = () => {}
export default function Ranks({ team, asOf, sportId, onReady }) {
  const numbers = useBandData(() => loadRanks(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount: NOOP })
  return <NumbersBody numbers={numbers} team={team} asOf={asOf} sportId={sportId} part="ranks" />
}
