// The nightly run of gen-awards-history.mjs refreshes ONE season (the one in play)
// and carries every other season forward from the committed file, rather than
// re-fetching five seasons of recipients and stat lines each night. `fresh` holds
// only the refreshed seasons; a refreshed season's old rows are dropped first, so
// an award MLB pulls back (or a season that came back empty) does not linger.
// `keep` is the rolling window of seasons the file covers; `order` is the
// canonical family order (the labels, as the Trophy Case lists them).
export function mergeSeasons({ prev, fresh, refreshed, keep, order }) {
  const refreshedSet = new Set(refreshed.map(String))
  const keepSet = new Set(keep.map(String))
  const prevBy = new Map(prev.map((f) => [f.key, f]))
  const freshBy = new Map(fresh.map((f) => [f.key, f]))
  return order
    .map((key) => {
      const years = {}
      for (const [year, recipients] of Object.entries(prevBy.get(key)?.years ?? {})) {
        if (keepSet.has(year) && !refreshedSet.has(year)) years[year] = recipients
      }
      Object.assign(years, freshBy.get(key)?.years ?? {})
      return { key, label: key, years }
    })
    .filter((f) => Object.keys(f.years).length > 0)
}
