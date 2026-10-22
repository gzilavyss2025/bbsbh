// The nightly run of gen-awards-history.mjs refreshes ONE season (the one in play)
// and carries every other season forward from the committed file, rather than
// re-fetching five seasons of recipients and stat lines each night. `fresh` holds
// only the refreshed seasons. A family-year is replaced only when the fresh run
// brought rows for it: an empty answer (a 404, an empty 200, a hiccup) keeps what
// is committed, so a night can add winners but never wipe them (scripts/CLAUDE.md:
// skip the write when a season returns no data). `keep` is the rolling window of
// seasons the file covers; `order` is the canonical family order (the labels, as
// the Trophy Case lists them).
export function mergeSeasons({ prev, fresh, keep, order }) {
  const keepSet = new Set(keep.map(String))
  const prevBy = new Map(prev.map((f) => [f.key, f]))
  const freshBy = new Map(fresh.map((f) => [f.key, f]))
  return order
    .map((key) => {
      const years = {}
      for (const [year, recipients] of Object.entries(prevBy.get(key)?.years ?? {})) {
        if (keepSet.has(year)) years[year] = recipients
      }
      for (const [year, recipients] of Object.entries(freshBy.get(key)?.years ?? {})) {
        if (recipients.length > 0) years[year] = recipients
      }
      return { key, label: key, years }
    })
    .filter((f) => Object.keys(f.years).length > 0)
}
