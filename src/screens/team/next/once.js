import { DIRECT } from '../data/sources.js'

// Share one in-flight load between bands that need it, so the page buys it once. Keyed by
// the caller; `forgetLoads` runs when the page unmounts, so a return visit fetches fresh.
// A failed load is forgotten at once.
const loads = new Map()

export function once(key, load) {
  if (!loads.has(key)) loads.set(key, load().catch((e) => (loads.delete(key), Promise.reject(e))))
  return loads.get(key)
}

export const forgetLoads = () => loads.clear()

// The page's loader sources (data/sources.js): the shared reads, each bought once per
// argument list while the page is open.
export const SHARED = Object.fromEntries(
  Object.entries(DIRECT).map(([name, fetch]) => [
    name,
    (...args) => once(`${name}:${JSON.stringify(args)}`, () => fetch(...args)),
  ]),
)
