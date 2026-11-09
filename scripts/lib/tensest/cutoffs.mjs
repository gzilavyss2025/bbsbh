// Season leverage cutoffs for the tension meter: where each of its 10 bars starts.
//
// gen-tensest.mjs is incremental (it reads only new games), so it cannot re-sort
// every play of the season. It keeps a histogram instead: plays counted per 0.01 of
// leverage index, 0.00 to 9.99 (MLB caps the feed at 9.99), 1,000 counts in
// scripts/data/tensest-state.json. New games fold in; the cutoffs come from it.
//
// The bands are narrow at the top so a full meter is rare: bar 10 is the season's
// top 1% (about 0.7 plays a game), bar 1 the bottom 20%. Chosen with Gary from a
// 298-game 2026 sample (#2939).

export const BUCKETS = 1000
export const BAR_PCTS = [20, 40, 55, 70, 80, 88, 93, 97, 99]

export const emptyHist = () => new Array(BUCKETS).fill(0)

// A state file's histogram, or null when it is missing or not one (a full rebuild).
export const histOrNull = (h) =>
  Array.isArray(h) && h.length === BUCKETS && h.every((n) => Number.isInteger(n) && n >= 0) ? h : null

// The histogram with one game's winProbability plays added. A play with no
// leverageIndex (every game's first) is skipped.
export function foldHist(hist, plays) {
  const out = [...hist]
  for (const p of plays ?? []) {
    const li = p?.leverageIndex
    if (typeof li !== 'number' || !Number.isFinite(li) || li < 0) continue
    out[Math.min(BUCKETS - 1, Math.floor(li * 100 + 1e-6))] += 1
  }
  return out
}

// The LI of the play at share `p` of the season, sorted low to high: the bucket
// holding play number floor(p × plays).
export function quantile(hist, p) {
  const n = hist.reduce((a, b) => a + b, 0)
  const k = Math.min(n - 1, Math.floor(p * n + 1e-9))
  let seen = 0
  for (let b = 0; b < BUCKETS; b += 1) {
    seen += hist[b]
    if (seen > k) return b / 100
  }
  return null
}

// What tensest.json publishes: the play count, the bands and each band's LI edge.
export function cutoffsFromHist(hist) {
  const plays = hist.reduce((a, b) => a + b, 0)
  if (plays === 0) return null
  return { plays, pcts: BAR_PCTS, li: BAR_PCTS.map((p) => quantile(hist, p / 100)) }
}
