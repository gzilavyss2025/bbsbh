import { useState } from 'react'
import { useAsync } from '../useAsync.js'
import { useSeasonView } from './useSeasonView.js'

// The block every season page repeated (#1484): the resolved view, the shown
// season's fetch, the compare season's fetch, and the compare mode.
//
// `fetcher({ seasonYear })` is the store's own reader. Both fetches wait for
// the view (`view != null`), so a page cannot ask for a season before the
// index says which one it is. `deps` are the page's own inputs to `fetcher`
// (a umpire id, say) — they re-run both fetches, like useAsync's deps.
// `compare: false` skips the vs fetch for a page that builds its own.
//
// Returns `{ view, data, prev, loading, error, mode, setMode }`; `loading` is
// true until the view and the shown season's data have both landed.
export function useSeasonData(store, fetcher, { seasonYear, vs, deps = [], compare = true } = {}) {
  const view = useSeasonView(store, { seasonYear, vs })
  const shown = view?.shown
  const now = useAsync(
    () => (view ? fetcher({ seasonYear: shown }) : Promise.resolve(null)),
    [...deps, view != null, shown],
  )
  const then = useAsync(
    () => (compare && view?.vs ? fetcher({ seasonYear: view.vs }) : Promise.resolve(null)),
    [...deps, compare, view?.vs],
  )
  const [mode, setMode] = useState('change')
  return {
    view,
    data: now.data,
    prev: then.data,
    loading: !view || now.loading,
    error: now.error,
    mode,
    setMode,
  }
}
