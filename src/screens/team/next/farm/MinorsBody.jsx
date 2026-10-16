import { CareerTimeline } from '../../../../components/player/CareerTimeline.jsx'
import { AffiliatesCard } from '../../modules/minors/AffiliatesCard.jsx'
import { ProspectsCard } from '../../modules/minors/ProspectsCard.jsx'
import { HorizonCard } from '../../modules/minors/HorizonCard.jsx'
import { DepthChartCard } from '../../modules/minors/DepthChartCard.jsx'

// The Farm band's four cards (affiliation history, affiliates, Horizon, prospects, Depth
// Chart), in reading order. Horizon sits right after Affiliates on purpose: Affiliates is
// the rearview (last night's recaps), Horizon is what's next.
export function MinorsBody({ minors }) {
  const { isMilb, affiliateCards, prospects, affiliationHistory, horizon, depthChart } = minors

  const showAffiliates = affiliateCards.length > 0
  const showProspects = prospects.length > 0
  const showHistory = isMilb && affiliationHistory.length > 0
  const showHorizon = horizon.promotionWatch.length > 0 || horizon.milestones.length > 0
  const showDepthChart = depthChart.positions.length > 0

  return (
    <>
      {showHistory && <CareerTimeline entries={affiliationHistory} title="Affiliation history" headLook="label" />}

      {showAffiliates && <AffiliatesCard affiliates={affiliateCards} />}

      {showHorizon && <HorizonCard horizon={horizon} />}

      {showProspects && (
        // showAllProspects locked true: the tab has room for the whole org
        // list, so this drops ProspectsCard's ten-row preview cap and its
        // "Show all" button (which only renders when showAllProspects is
        // false) without editing the shared module.
        <ProspectsCard prospects={prospects} showAllProspects onShowAll={() => {}} />
      )}

      {showDepthChart && <DepthChartCard depthChart={depthChart} />}
    </>
  )
}
