// Draft OVR exactly as docs/ovr-rating.md (main, PR #1684) describes it. Throwaway research code:
// the real module is the later build step. Every constant below is a spec starting value.
export const SPEC = {
  mid: 60, // percentile 50 -> 60
  sd: 12, // points per standard deviation
  cap: 99,
  floor: 20,
  hitterBuckets: {
    contact: ['xwoba', 'squaredUp'],
    power: ['ev', 'hardHit', 'brl', 'batSpeed'],
    discipline: ['chase'],
    speed: ['sprintSpeed'],
  },
  hitterWeights: { power: 25, contact: 25, discipline: 15, speed: 15, fielding: 20 },
  pitcherBuckets: {
    stuff: ['whiff', 'k', 'fbVelo', 'hardHit'],
    results: ['xera'],
    control: ['bb'],
  },
  pitcherWeights: { stuff: 40, results: 35, control: 25 },
}

// Inverse normal CDF (Acklam's rational approximation, relative error < 1.2e-9).
export function probit(p) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const lo = 0.02425
  if (p < lo) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  if (p > 1 - lo) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  const q = p - 0.5, r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

// Savant percentile (0-100, already "higher is better" for every key; verified by sign of
// corr(percentile, raw) in findings) -> rating.
export function toRating(pct, spec = SPEC) {
  if (pct == null) return null
  if (pct <= 0) return spec.floor
  if (pct >= 100) return spec.cap
  return Math.max(spec.floor, Math.min(spec.cap, spec.mid + spec.sd * probit(pct / 100)))
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length

// bucket -> mean rating of its metrics that exist; null when none exist.
export function bucketRatings(pcts, buckets, spec = SPEC) {
  const out = {}
  for (const [name, keys] of Object.entries(buckets)) {
    const rs = keys.map((k) => toRating(pcts?.[k], spec)).filter((r) => r != null)
    out[name] = rs.length ? mean(rs) : null
  }
  return out
}

// Weighted mean over the buckets that exist; a missing bucket's weight is shared across the rest
// (the spec's rule), which is the same as dividing by the weights actually present.
export function rollUp(buckets, weights) {
  let num = 0, den = 0
  for (const [k, w] of Object.entries(weights)) {
    if (buckets[k] == null) continue
    num += w * buckets[k]
    den += w
  }
  return den ? num / den : null
}

export const hitterOvr = (pcts, spec = SPEC) => {
  const b = bucketRatings(pcts, spec.hitterBuckets, spec)
  return { buckets: b, ovr: rollUp(b, spec.hitterWeights) }
}
export const pitcherOvr = (pcts, spec = SPEC) => {
  const b = bucketRatings(pcts, spec.pitcherBuckets, spec)
  return { buckets: b, ovr: rollUp(b, spec.pitcherWeights) }
}
