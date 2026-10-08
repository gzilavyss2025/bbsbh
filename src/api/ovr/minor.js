// OVR for a minor leaguer, and the minor-league half of the career blend
// (docs/ovr-rating.md, "OVR for a minor leaguer" and "Career rating"; #1721).
// Pure: level-relative OPS or ERA percentiles in, one rating out. No fetch, no React.
// Levels are sportIds, the keys of LEVEL_WEIGHT (milbSeasons.js).
import { recency } from './career.js'
import { CONSTANTS } from './rating.js'
import { FULL_WEIGHT_OUTS, FULL_WEIGHT_PA, LEVEL_WEIGHT } from '../milbSeasons.js'

// Spec, "One band for every level" (decided). Floor 20 at every level (decided).
export const CEILING = { 11: 58, 12: 55, 13: 45, 14: 39, 16: 30 }

// A player with this many MLB seasons is established: his minor-league rows do not enter
// his rating. Decided by Gary (2026-10-08, #1803): with all rows, 26% of established
// hitters moved by more than 2 points. The rows cover thin MLB history, nothing more.
export const ESTABLISHED_SEASONS = 3

export function minorRating(percentile, level) {
  const ceiling = CEILING[level]
  if (ceiling == null) return null
  return CONSTANTS.FLOOR + ((ceiling - CONSTANTS.FLOOR) * percentile) / 100
}

// rows: [{ season, sport, group, n, pct }] (n is PA or outs); mlb: { ovr, years } | null,
// the MLB rating and the seasons it rests on. Each minor-league row weighs
// recency x level x playing time; each MLB season weighs its recency, so one MLB rating
// stands for all of them. A row under the playing-time floor (pct null) is dropped, and
// so is a row from a season the MLB rating already covers, so a season counts once.
// GUESS: the spec is silent on mixing the two, so ratings are averaged on the OVR
// scale and recency is the rank among every season the player has, as in career.js.
export function careerOvr(mlb, rows) {
  const covered = new Set(mlb?.years)
  const rated = rows.filter((r) => r.pct != null && CEILING[r.sport] != null && !covered.has(r.season))
  if (!rated.length) return mlb?.ovr ?? null
  const years = [...new Set([...(mlb?.years ?? []), ...rated.map((r) => r.season)])].sort((a, b) => b - a)
  const rec = (y) => recency(years.indexOf(y))
  let sum = 0
  let weight = 0
  for (const y of mlb?.years ?? []) {
    sum += rec(y) * mlb.ovr
    weight += rec(y)
  }
  for (const r of rated) {
    const full = r.group === 'pitching' ? FULL_WEIGHT_OUTS : FULL_WEIGHT_PA
    const w = rec(r.season) * LEVEL_WEIGHT[r.sport] * Math.min(1, r.n / full)
    sum += w * minorRating(r.pct, r.sport)
    weight += w
  }
  return weight ? sum / weight : null
}
