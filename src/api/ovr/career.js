// Career blend for OVR (docs/ovr-rating.md, "Career rating"; #1717). Pure: one
// percentile per metric per season in, one blended percentile per metric out.
// No fetch, no React. The caller passes the current season (savant-percentiles.json)
// and the stored ones (savantHistory.js), only for seasons the player has a row in.
import { clamp } from '../../lib/math/number.js'

export const CONSTANTS = {
  // Spec, "Recency decay": Marcel-style 5/4/3 on the newest three seasons, then
  // a smaller tail for any older one. All start values.
  W: [5, 4, 3],
  TAIL: 2,
}

// Age shift, percentile points per year of age (age at season t, moving to t+1),
// for ages 20..40: the smooth, centred fit in .scratch/ovr/age-shift/age-shift-smooth.csv
// (findings-age-shift.md, section 4). Relative to peers, not absolute change.
// Sprint speed and fastball velocity ONLY: the other metrics gain nothing the
// noise does not hide (section 7), so they get no table.
const SHIFT_FROM_AGE = 20
const SHIFT_TO_AGE = 40
const SHIFT = {
  sprintSpeed: [2.45, 2.08, 1.73, 1.39, 1.07, 0.76, 0.46, 0.18, -0.09, -0.35, -0.59, -0.81, -1.02, -1.22, -1.4, -1.57, -1.73, -1.87, -1.99, -2.11, -2.2],
  fbVelo: [6.4, 5.47, 4.57, 3.72, 2.91, 2.13, 1.4, 0.7, 0.04, -0.57, -1.15, -1.69, -2.19, -2.65, -3.07, -3.45, -3.79, -4.1, -4.36, -4.58, -4.77],
}

// Weight of the i-th newest season (0 = newest).
export const recency = (i) => CONSTANTS.W[i] ?? CONSTANTS.TAIL

// Points to add to a `metric` percentile from `year` so it reads at the age the
// player has in `now`: the table summed over each year of age from then to now.
// An age outside 20..40 takes the nearest end. No birth year, no shift.
function shiftBetween(metric, year, now, birthYear) {
  const table = SHIFT[metric]
  if (!table || birthYear == null) return 0
  let sum = 0
  for (let y = year; y < now; y++) {
    sum += table[clamp(y - birthYear, SHIFT_FROM_AGE, SHIFT_TO_AGE) - SHIFT_FROM_AGE]
  }
  return sum
}

// seasons: { [year]: { [metric]: percentile | null } }. Newest year first gets
// W[0]; a year past W's length gets TAIL. A null cell drops out and the other
// seasons' weights renormalize for that metric alone. The shifted value is not
// clipped to 0..100 (the fit did not clip either).
export function blendCareer(seasons, birthYear) {
  const years = Object.keys(seasons).map(Number).sort((a, b) => b - a)
  const sum = {}
  const wsum = {}
  years.forEach((year, i) => {
    const w = recency(i)
    for (const [metric, pct] of Object.entries(seasons[year])) {
      if (pct == null) continue
      sum[metric] = (sum[metric] ?? 0) + w * (pct + shiftBetween(metric, year, years[0], birthYear))
      wsum[metric] = (wsum[metric] ?? 0) + w
    }
  })
  return Object.fromEntries(Object.keys(sum).map((m) => [m, sum[m] / wsum[m]]))
}
