import '../../../../styles/70-contracts-grid.css'
import { loadContracts } from '../../data/loadContracts.js'
import { ContractsBody } from '../../ContractsTab.jsx'
import { useBandData } from '../useBandData.js'

// Money: today's Contracts tab, as it is. Not keyed on `asOf`, like the tab: a season's book.
const NOOP = () => {}
export default function Money({ team, onReady }) {
  const contracts = useBandData(() => loadContracts(team.id), [team.id], { onReady, onCount: NOOP })
  return <ContractsBody contracts={contracts} />
}
