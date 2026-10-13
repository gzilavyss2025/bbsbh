import { useEffect } from 'react'
import { useAsync } from '../../../../../hooks/useAsync.js'

// One card of the tbd module: loads its own data, then draws it. While it loads it holds
// its height. When the data has nothing (`has` says so), or the load failed, it draws
// nothing and tells the module through `hide`, so the slot can go when every card has.
export function Part({ id, hide, load, deps, has = Boolean, children }) {
  const { data, loading } = useAsync(load, deps)
  const none = !loading && !has(data)
  useEffect(() => {
    if (none) hide(id)
  }, [none, hide, id])
  if (none) return null
  return <div className={loading ? 'tbd__part tbd__part--wait' : 'tbd__part'}>{!loading && children(data)}</div>
}
