import { loadNumbers } from '../../data/loadNumbers.js'
import { NumbersBody } from '../../NumbersTab.jsx'
import { once } from '../once.js'
import { useBandData } from '../useBandData.js'

// Ranks: the rank tables and the leaders ledger, the Ranks share of the Numbers tab.
const NOOP = () => {}
export default function Ranks({ team, asOf, sportId, onReady }) {
  const numbers = useBandData(() => once(`numbers:${team.id}:${asOf ?? ''}`, () => loadNumbers(team.id, asOf)), [team.id, asOf], {
    onReady,
    onCount: NOOP,
  })
  return <NumbersBody numbers={numbers} team={team} asOf={asOf} sportId={sportId} part="ranks" />
}
