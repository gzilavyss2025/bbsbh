// Shared statistical-tier bucketing: standard deviations from a pool's own
// mean, not an even split (a neat top-third/middle-third/bottom-third cut
// puts values a hair apart in different tiers whenever a pool clusters
// tightly — see api/umpires.js's original note on plate-umpire accuracy,
// which motivated this). "Elite"/"Below Average" mark a full SD or more from
// the mean; "Good"/"Average" split the rest at the mean itself. Used by both
// umpire plate-accuracy rankings and Game Score rankings — any future ranked
// pool should reuse this rather than reinventing equal-thirds buckets.
export const TIER_LABELS = {
  elite: 'Elite',
  good: 'Good',
  average: 'Average',
  below: 'Below Average',
}

export function tierForZ(z) {
  if (z >= 1) return 'elite'
  if (z >= 0) return 'good'
  if (z >= -1) return 'average'
  return 'below'
}

// The pitcher/hitter LEAN scale. Same z-score-against-the-pool principle as
// tierForZ, but deliberately NOT reusing it: that scale is one-directional
// (higher is better) and has nowhere to put a middle, while this one is
// two-directional — neither end is good or bad, and "an average umpire" has to
// be a band of its own rather than the seam between two.
//
// `z` is signed toward HITTERS: positive means this umpire's missed calls hand
// runs to the batting team. api/umpires.js's umpireLeanFor derives it, and its
// header records why it must be z-scored rather than cut at fixed values — the
// league mean is about +0.18 runs/game to hitters, NOT zero, so absolute
// thresholds would file a perfectly ordinary umpire as hitter-friendly.
export const LEAN_TIER_LABELS = {
  veryPitcher: 'Very pitcher friendly',
  pitcher: 'Pitcher friendly',
  neutral: 'Neutral',
  hitter: 'Hitter friendly',
  veryHitter: 'Very hitter friendly',
}

// Band order, pitcher pole first — the scale's render order, so the component
// never hard-codes it.
export const LEAN_TIERS = ['veryPitcher', 'pitcher', 'neutral', 'hitter', 'veryHitter']

const LEAN_STRONG = 1 // a full SD from the mean — "very"
const LEAN_SLIGHT = 0.35 // inside this either way is the neutral band

export function leanTierForZ(z) {
  if (z <= -LEAN_STRONG) return 'veryPitcher'
  if (z <= -LEAN_SLIGHT) return 'pitcher'
  if (z < LEAN_SLIGHT) return 'neutral'
  if (z < LEAN_STRONG) return 'hitter'
  return 'veryHitter'
}

// The band edges, in z, that leanTierForZ cuts at — the outer two clamped, so
// an extreme umpire sits at the very end of the scale rather than off it.
const LEAN_BOUNDS = [-2, -LEAN_STRONG, -LEAN_SLIGHT, LEAN_SLIGHT, LEAN_STRONG, 2]

// Where the scale's caret sits, as a 0..1 fraction down five EQUAL-height
// bands. The card draws equal rows (the reference graphic's own geometry), so
// the continuous reading has to live inside a row rather than in row widths:
// this locates z within its own band, then places it that far into that band's
// row. Piecewise-linear across the scale as a whole, which is the trade equal
// rows force — but every claim the card makes is true under it, and the caret
// can never point at a row other than the one the label highlights.
//
// That last property is why this derives its band from leanTierForZ instead of
// re-deriving one from LEAN_BOUNDS: a caret disagreeing with its own highlighted
// band is the one bug this geometry could have, and asking the same function
// twice makes it unreachable.
export function leanCaretFraction(z) {
  const i = LEAN_TIERS.indexOf(leanTierForZ(z))
  const lo = LEAN_BOUNDS[i]
  const hi = LEAN_BOUNDS[i + 1]
  const clamped = Math.max(lo, Math.min(hi, z))
  const within = hi > lo ? (clamped - lo) / (hi - lo) : 0.5
  return (i + within) / LEAN_TIERS.length
}

// Population mean + standard deviation of a numeric array (n, not n-1 — the
// pool IS the whole population being ranked, not a sample of a larger one).
export function meanAndSd(values) {
  const n = values.length
  const mean = n ? values.reduce((sum, v) => sum + v, 0) / n : 0
  const sd = n ? Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n) : 0
  return { mean, sd, n }
}
