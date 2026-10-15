import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { loadMinors } from '../../data/loadMinors.js'
import { MinorsBody } from '../../MinorsTab.jsx'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'

// Farm: today's Minors tab, as it is.
const count = (m) => m.prospects.length
export default function Farm({ team, asOf, onReady, onCount }) {
  const minors = useBandData(() => loadMinors(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount, count })
  return (
    <>
      <AsyncStatus loading={minors.loading} error={minors.error} hasData={minors.data != null} errorMessage="Couldn’t load the farm system. Try again." />
      {minors.data && <MinorsBody minors={minors.data} />}
    </>
  )
}
