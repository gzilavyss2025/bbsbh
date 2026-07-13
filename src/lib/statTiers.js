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

// Population mean + standard deviation of a numeric array (n, not n-1 — the
// pool IS the whole population being ranked, not a sample of a larger one).
export function meanAndSd(values) {
  const n = values.length
  const mean = n ? values.reduce((sum, v) => sum + v, 0) / n : 0
  const sd = n ? Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n) : 0
  return { mean, sd, n }
}
