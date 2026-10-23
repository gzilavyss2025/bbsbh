import { useViewOnce } from '../../../../hooks/motion/useViewOnce.js'
import { AsyncStatus } from '../../../../components/ui/AsyncGate.jsx'
import { loadMinors } from '../../data/loadMinors.js'
import { MinorsBody } from './MinorsBody.jsx'
import { SHARED } from '../once.js'
import { useBandData } from '../useBandData.js'
import '../../../../styles/team-next/farm.css'

// Farm: the Minors cards (MinorsBody) on their own loader, re-skinned to the
// stamped card by farm.css (row 6d, #1107). The badge is the prospect count, as the old band
// had it. Motion plays once per page visit (docs/motion.md, "The one-shot gate").
// A past season draws the Affiliates card (and a MiLB club's affiliation history) and nothing that
// knows only today, so its badge counts the cards drawn rather than prospects (#2593).
const count = (m) =>
  m.pastSeason ? Number(m.affiliateCards.length > 0) + Number(m.isMilb && m.affiliationHistory.length > 0) : m.prospects.length
export default function Farm({ team, asOf, onReady, onCount }) {
  const minors = useBandData(() => loadMinors(team.id, asOf, SHARED), [team.id, asOf], { onReady, onCount, count })
  const still = useViewOnce(team.id, 'team-farm')
  return (
    <div className={`tnext__farm${still ? ' tnext__farm--still' : ''}`}>
      <h2 className="tnext__bandhead">Farm</h2>
      <AsyncStatus loading={minors.loading} error={minors.error} hasData={minors.data != null} errorMessage="Couldn’t load the farm system. Try again." />
      {minors.data && <MinorsBody minors={minors.data} />}
    </div>
  )
}
