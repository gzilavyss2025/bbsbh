// A season line's percentile within its own level (MLB, AAA, AA, A+, A, Rk),
// for the trade card's "By level" sort. Pure. The nightly generator
// (scripts/trade/gen-level-lines.mjs) reduces each level's qualified OPS and
// ERA values to 101 cut points with `cutPoints`; the page ranks a line against
// them with `percentileFromCuts`. The floor matches prospect-trend's: 40 PA,
// 30 outs (scripts/lib/prospectPercentile.mjs).

export const LEVEL_OF_SPORT = { 1: 'MLB', 11: 'AAA', 12: 'AA', 13: 'A+', 14: 'A', 16: 'Rk' }

// values: a level's qualified metric values. Returns 101 numbers, the value
// at each whole percentile of the sorted list (0 = lowest, 100 = highest).
export function cutPoints(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!v.length) return null
  return Array.from({ length: 101 }, (_, i) => v[Math.min(v.length - 1, Math.round((i / 100) * (v.length - 1)))])
}

// The share of the level a value beats, 0-100, oriented so higher is better
// for both stats: a high OPS and a low ERA both rank high. Null without cuts.
export function percentileFromCuts(value, cuts, higherIsBetter) {
  if (!Number.isFinite(value) || !cuts?.length) return null
  const below = cuts.filter((c) => c < value).length
  const above = cuts.filter((c) => c > value).length
  const pct = higherIsBetter ? below : above
  // Capped at 99: a line can lead its level, but "100th" reads as an error.
  return Math.max(0, Math.min(99, Math.round((pct / cuts.length) * 100)))
}

// "93rd", "1st", "12th".
export function ordinal(n) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'
  return `${n}${s}`
}
