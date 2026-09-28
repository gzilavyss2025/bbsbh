// One address, /postseason/{id}, for both series pages (Gary, 2026-09-28).
// seriesPageFor (src/lib/route.js) picks the page: the finished page for a
// history id with no `?d=`, the live page otherwise. A failed history read
// opens the live page, which reads the bracket and needs no history.
import { useAsync } from '../../hooks/useAsync.js'
import { historySeriesIds, loadPostseasonHistory } from '../../api/postseasonHistory.js'
import { seriesPageFor } from '../../lib/route.js'
import { AsyncGate } from '../../components/ui/AsyncGate.jsx'
import { PostseasonSeriesPage } from '../PostseasonSeriesPage.jsx'
import { LiveSeriesPage } from './LiveSeriesPage.jsx'

export function SeriesRoute({ seriesId, asOf }) {
  // A dated address is always the live page: no history read needed.
  const history = useAsync(() => (asOf ? Promise.resolve(null) : loadPostseasonHistory()), [asOf])
  const gate = AsyncGate({
    loading: history.loading,
    error: null,
    data: history.loading ? null : true,
    screenClass: 'psseries',
    noun: 'series',
    onBack: () => window.history.back(),
  })
  if (gate) return gate
  return seriesPageFor(seriesId, asOf, historySeriesIds(history.data)) === 'finished' ? (
    <PostseasonSeriesPage seriesId={seriesId} />
  ) : (
    <LiveSeriesPage seriesId={seriesId} asOf={asOf} />
  )
}
