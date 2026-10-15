// Share one in-flight load between two bands that need it (Standing and Ranks both read the
// Numbers loader), so the page buys it once. Keyed by the caller; `forgetLoads` runs when
// the page unmounts, so a return visit fetches fresh. A failed load is forgotten at once.
const loads = new Map()

export function once(key, load) {
  if (!loads.has(key)) loads.set(key, load().catch((e) => (loads.delete(key), Promise.reject(e))))
  return loads.get(key)
}

export const forgetLoads = () => loads.clear()
