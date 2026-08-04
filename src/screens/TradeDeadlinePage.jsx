import { useEffect } from 'react'
import { SEASONS } from '../api/tradeDeadline.js'
import { useNav } from '../lib/nav.js'
import { tradeDeadlineSeasonPath } from '../lib/route.js'

// '/trade-deadline' has no landing page of its own anymore — it's just an
// alias for the most recent season (browsing older years happens via
// TradeDeadlineSeasonPage's own SeasonNav pill row), so this immediately
// normalizes the URL to that season via replaceState, the same
// out-of-range-URL normalize InningViewer's edge-inning clamp uses.
export function TradeDeadlinePage() {
  const navigate = useNav()
  const latestYear = Math.max(...SEASONS.map((s) => s.year))

  useEffect(() => {
    navigate(tradeDeadlineSeasonPath(latestYear), { replace: true })
  }, [navigate, latestYear])

  return null
}
