import { useEffect } from 'react'
import { useAsync } from '../../../hooks/useAsync.js'

// A band's data hook: `useAsync` plus the two reports every band owes the page. `onReady`
// fires once the load has settled (the band drops its height hold); `onCount` gets the
// jump-bar badge once data is in, from `count(data)`. A band that mounts runs this and
// nothing before it is near (Band.jsx mounts the module only then).
export function useBandData(load, deps, { onReady, onCount, count }) {
  const r = useAsync(load, deps)
  useEffect(() => {
    if (r.data || r.error) onReady()
  }, [r.data, r.error, onReady])
  useEffect(() => {
    if (r.data && count) onCount(count(r.data))
  }, [r.data, count, onCount])
  return r
}
