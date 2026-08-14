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

// Where the scale's caret sits, as a 0..1 fraction down five EQUAL-height
// bands: the CENTRE of the band z falls in. Five settings, five spots.
//
// It used to place z continuously WITHIN its band, but the outer bands clamp
// (an extreme umpire's z runs past any fixed edge), so a strong-leaning
// umpire's caret sat on the scale's very edge — half the triangle above the
// first row, or cut off below the last — visibly misaligned with the boxed
// label beside it. Centring on the band keeps the caret and the highlight in
// exact register at every one of the five settings.
//
// Derives its band from leanTierForZ rather than from the bound values: a
// caret disagreeing with its own highlighted band is the one bug this
// geometry could have, and asking the same function twice makes it
// unreachable.
export function leanCaretFraction(z) {
  const i = LEAN_TIERS.indexOf(leanTierForZ(z))
  return (i + 0.5) / LEAN_TIERS.length
}

// Population mean + standard deviation of a numeric array (n, not n-1 — the
// pool IS the whole population being ranked, not a sample of a larger one).
export function meanAndSd(values) {
  const n = values.length
  const mean = n ? values.reduce((sum, v) => sum + v, 0) / n : 0
  const sd = n ? Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n) : 0
  return { mean, sd, n }
}
