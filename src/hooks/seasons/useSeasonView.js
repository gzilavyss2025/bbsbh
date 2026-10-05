import { useMemo } from 'react'
import { seasonIndexOf } from '../../api/staticJson.js'
import { resolveSeasonView } from '../../lib/seasons/view.js'
import { useAsync } from '../useAsync.js'

// A season view's season (#1202): the store's seasons.json, resolved against
// what the address asked for (`seasonYear`, `vs` from lib/route.js). Null
// until the index lands; then `{ seasons, current, shown, vs, label }` — see
// lib/seasons/view.js. A page fetches `shown` (and `vs`, to compare) with the
// store's own reader, which takes the same `{ seasonYear }`.
export function useSeasonView(store, { seasonYear, vs } = {}) {
  const { data: index } = useAsync(() => seasonIndexOf(store), [store])
  return useMemo(
    () => (index ? resolveSeasonView(index, { seasonYear, vs }) : null),
    [index, seasonYear, vs],
  )
}
