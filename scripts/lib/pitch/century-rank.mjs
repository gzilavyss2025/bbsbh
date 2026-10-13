// Competition ranking (1, 2, 2, 4) over one level's century-club counts —
// ties share a place and the next man skips, the way a leaderboard reads.
// `counts` is [id, count] pairs ALREADY filtered to the cohort being ranked;
// `of` is that cohort's size, so the rank a card renders and the denominator
// beside it always describe the same population. Pure, exported for tests.
export function centuryRankMap(counts) {
  const sorted = [...counts].sort((a, b) => b[1] - a[1])
  const of = sorted.length
  const ranks = new Map()
  let lastCount = null
  let lastRank = 0
  sorted.forEach(([id, count], i) => {
    const rank = count === lastCount ? lastRank : i + 1
    lastCount = count
    lastRank = rank
    ranks.set(id, { rank, of })
  })
  return ranks
}
