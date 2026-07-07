import { useEffect, useState } from 'react'

// Delays reflecting a fast-changing value (search-box keystrokes) by `ms`, so
// a network-backed search fires once typing pauses instead of on every key.
export function useDebouncedValue(value, ms = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}
