// usePostseasonBracket(cutoffDate) — the postseason bracket heading into a
// date, for the slate's bracket, the slate cards' series line, the live series
// page and the offseason Season record row (#1224, slices 4-7).
//
//   const { bracket, loading, error, cutoff } = usePostseasonBracket(slateDate)
//
// `bracket` is deriveBracket's return (docs/api/postseason.md), or null while
// loading, on no postseason rows, or when `cutoffDate` is null (pass null to
// skip the reads on a date outside the postseason window). `season` defaults
// to the cutoff's year; the offseason row passes it for a January date.
//
// THE CUTOFF IS CAPPED AT TODAY, so a future date can never ask for today's
// results. bracketCutoff uses the slate's own cap (capSlateDate, ADR-0087)
// with NO season row, which is that helper's fail-closed branch: every future
// date caps, in the postseason window or out of it. The slate passes a date
// after today through outside the window; the bracket never may, because its
// results read runs to the day before the cutoff.
//
// Scores Unlocked does NOT apply (Gary's decision, 2026-09-28): this hook
// never reads the switch, and it writes nothing to storage. The state is the
// same with the switch on or off. test/postseason/bracket-hook.test.js pins both.

import { useAsync } from '../useAsync.js'
import { loadPostseasonBracket } from '../../api/postseason/fetch.js'
import { toApiDate } from '../../lib/dates.js'
import { capSlateDate } from '../../lib/postseason/capSlateDate.js'

export function bracketCutoff(date, today = toApiDate(new Date())) {
  if (!date) return null
  return capSlateDate(date, today, null)
}

// useAsync keeps the last result for one render after its deps change. So a
// slate paged from 10-06 back to 10-05 would draw the bracket heading into
// 10-06 on 10-05's slate: a later result on an earlier date. Hand a bracket
// back only when it was built for THIS cutoff.
export function bracketFor(data, cutoff) {
  return cutoff && data?.cutoff === cutoff ? data : null
}

export function usePostseasonBracket(cutoffDate, { season } = {}) {
  const cutoff = bracketCutoff(cutoffDate)
  const year = season ?? (cutoff ? Number(cutoff.slice(0, 4)) : null)
  const { data, loading, error } = useAsync(
    (signal) => (cutoff && year ? loadPostseasonBracket(cutoff, year, { signal }) : Promise.resolve(null)),
    [cutoff, year],
  )
  return { bracket: bracketFor(data, cutoff), loading: Boolean(cutoff) && loading, error, cutoff }
}
