// The primer's leaders ledger: one category's rows. `entries` come ranked and
// capped from loadSeriesStats (src/api/postseasonSeries.js). Three or fewer
// players all show, high to low. More than three show the leader only.
export function leaderRows(entries = []) {
  return entries.length <= 3 ? [...entries].sort((a, b) => b.value - a.value) : entries.slice(0, 1)
}
