import { fetchSeasonMeta } from '../api/schedule/fetch.js'
import { useAsync } from './useAsync.js'
import { milestoneProjectionPaused } from '../lib/time/seasonPhase.js'
import { baseballToday } from '../lib/time/standingsDates.js'

// The slate's offseason gate moved to lib/slate/phase.js and the slate-day loader (#3035).
// True while the postseason is on: Milestone Watch hides its ETAs then (#1438).
// Decided at render time from today's date and the season row, so the nightly
// file does not change. False until the row arrives, and false if it fails.
// `enabled` false (a card with nothing to show) makes no request.
export function useMilestonesPaused(enabled = true) {
  const today = baseballToday()
  const year = Number(today.slice(0, 4))
  const { data } = useAsync(() => (enabled ? fetchSeasonMeta(year) : null), [year, enabled])
  return milestoneProjectionPaused(today, data)
}
