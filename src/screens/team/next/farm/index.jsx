import { useEffect, useState } from 'react'
import { hasSeen, markSeen, viewKey } from '../../../../lib/motion/inViewOnce.js'
import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { loadMinors } from '../../data/loadMinors.js'
import { MinorsBody } from '../../MinorsTab.jsx'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'
import '../../../../styles/team-next/farm.css'

// Farm: today's Minors tab (MinorsBody, its four cards) on its own loader, re-skinned to the
// stamped card by farm.css (row 6d, #1107). The badge is the prospect count, as the old band
// had it. Motion plays once per page visit (docs/motion.md, "The one-shot gate").
const count = (m) => m.prospects.length
export default function Farm({ team, asOf, onReady, onCount }) {
  const minors = useBandData(() => loadMinors(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount, count })
  const seenKey = viewKey(team.id, 'team-farm')
  const [still] = useState(() => hasSeen(seenKey))
  useEffect(() => {
    markSeen(seenKey)
  }, [seenKey])
  return (
    <div className={`tnext__farm${still ? ' tnext__farm--still' : ''}`}>
      <h2 className="tnext__bandhead">Farm</h2>
      <AsyncStatus loading={minors.loading} error={minors.error} hasData={minors.data != null} errorMessage="Couldn’t load the farm system. Try again." />
      {minors.data && <MinorsBody minors={minors.data} />}
    </div>
  )
}
