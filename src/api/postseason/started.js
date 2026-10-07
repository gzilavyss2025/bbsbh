import { fetchSeasonMeta } from '../schedule.js'
import { isoToday } from '../../lib/dates.js'

// Has `season`'s postseason started (or finished)? The gate for any gameType=P
// stats read (#1651): before the season row's postSeasonStartDate that read
// can only come back empty. Reads the row fetchSeasonMeta already fetches,
// never a date table; a missing row answers false, so a failed read drops the
// October line, not the page.
export async function postseasonStarted(season) {
  const start = (await fetchSeasonMeta(season))?.postSeasonStartDate
  return Boolean(start) && isoToday() >= start
}
