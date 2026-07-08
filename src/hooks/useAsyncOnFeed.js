import { useAsync } from './useAsync.js'

// A useAsync call gated on the feed existing, but keyed on stable ids rather
// than the feed object itself — for data DERIVED from the feed (generated
// weather, a probable starter's season line, win probability, pitcher roles)
// that doesn't change mid-game, so a live Refresh (which mints a new feed
// object) must not refetch it. `extraKeys` are the stable ids the fetch
// actually depends on (gamePk, team ids); `Boolean(feed)` is appended
// automatically so the fetch fires once the feed lands and never re-fires on
// a later feed update alone.
export function useAsyncOnFeed(feed, fn, extraKeys = []) {
  return useAsync(
    () => (feed ? fn(feed) : Promise.resolve(null)),
    [...extraKeys, Boolean(feed)],
  )
}
