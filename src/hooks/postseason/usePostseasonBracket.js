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
// THE CUTOFF IS CAPPED AT TODAY, so a future slate date can never ask for
// today's results. Slice 1 adds the shared cap helper in src/lib/postseason/;
// until that lands on the base branch, bracketCutoff below does the same job
// and should be swapped for it.
//
// Scores Unlocked does NOT apply (Gary's decision, 2026-09-28): this hook
// never reads the switch, and it writes nothing to storage. The state is the
// same with the switch on or off. test/postseason/bracket-hook.test.js pins both.

import { useAsync } from '../useAsync.js'
import { loadPostseasonBracket } from '../../api/postseason/fetch.js'
import { toApiDate } from '../../lib/dates.js'

export function bracketCutoff(date, today = toApiDate(new Date())) {
  if (!date) return null
  return date > today ? today : date
}

export function usePostseasonBracket(cutoffDate, { season } = {}) {
  const cutoff = bracketCutoff(cutoffDate)
  const year = season ?? (cutoff ? Number(cutoff.slice(0, 4)) : null)
  const { data, loading, error } = useAsync(
    (signal) => (cutoff && year ? loadPostseasonBracket(cutoff, year, { signal }) : Promise.resolve(null)),
    [cutoff, year],
  )
  return { bracket: cutoff ? data : null, loading: Boolean(cutoff) && loading, error, cutoff }
}
