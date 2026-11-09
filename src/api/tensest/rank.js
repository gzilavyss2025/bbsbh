// Rank a list of tense plays and keep every row whose rank is at most `size`. Rows
// that share a leverage index share a rank (1, 1, 3), the way a leaderboard counts,
// so a list can run a few rows past its size rather than cut a tie in half. Used by
// the page (slices.js) and the generator (scripts/lib/tensest/tensest.mjs).
// Highest first; the game and play order only make the output stable.
const byTense = (a, b) => b.li - a.li || a.pk - b.pk || a.i - b.i

export function rankTop(rows, size) {
  const sorted = [...rows].sort(byTense)
  const out = []
  let rank = 0
  let prev = null
  for (let k = 0; k < sorted.length; k += 1) {
    if (sorted[k].li !== prev) {
      rank = k + 1
      prev = sorted[k].li
    }
    if (rank > size) break
    out.push({ ...sorted[k], rank })
  }
  return out
}

