// A season line's percentile within its own level (MLB, AAA, AA, A+, A, Rk),
// for the trade card's "By level" sort. Pure. The nightly generator
// (scripts/trade/gen-level-lines.mjs) reduces each level's qualified OPS and
// ERA values to 101 cut points with `cutPoints`; the page ranks a line against
// them with `percentileFromCuts`. The floor matches prospect-trend's: 40 PA,
// 30 outs (scripts/lib/prospectPercentile.mjs).

import { SPORT_LABEL } from '../teams/levels.js'
import { percentileOf } from '../../api/hotcold/rule.js'

// The six levels with a season to rank against, labelled as the rest of the app labels them.
export const LEVEL_OF_SPORT = Object.fromEntries([1, 11, 12, 13, 14, 16].map((id) => [id, SPORT_LABEL[id]]))

// values: a level's qualified metric values. Returns 101 numbers, the value
// at each whole percentile of the sorted list (0 = lowest, 100 = highest).
export function cutPoints(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!v.length) return null
  return Array.from({ length: 101 }, (_, i) => v[Math.min(v.length - 1, Math.round((i / 100) * (v.length - 1)))])
}

// The share of the level a value beats, 0-100, oriented so higher is better
// for both stats: a high OPS and a low ERA both rank high. Null without cuts.
// The placing is the hot/cold rule's (percentileOf): it interpolates between
// cut points and answers the middle of a tie.
export function percentileFromCuts(value, cuts, higherIsBetter) {
  const p = percentileOf(value, cuts)
  if (p == null) return null
  // Capped at 99: a line can lead its level, but "100th" reads as an error.
  return Math.max(0, Math.min(99, Math.round(higherIsBetter ? p : 100 - p)))
}
