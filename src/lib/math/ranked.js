// Pure row ranking, shared by the Around the game readers. No imports, no game state.

// Rank a list of already-shaped rows on one numeric field, best first (or
// last, for a field whose good end is low). Ties SHARE the best rank, the same
// convention attendance.js and comebackWins.js already use, and a row with no
// value ranks null rather than last — it has not earned a place either way.
export function ranked(rows, field, { lowIsBest = false } = {}) {
  const usable = rows.filter((r) => r[field] != null)
  return rows.map((r) => {
    if (r[field] == null) return { ...r, rank: null, tied: false }
    const ahead = usable.filter((o) =>
      lowIsBest ? o[field] < r[field] : o[field] > r[field],
    ).length
    const tied = usable.filter((o) => o[field] === r[field]).length > 1
    return { ...r, rank: ahead + 1, tied }
  })
}
