// OVR for an MLB player (docs/ovr-rating.md, "OVR for an MLB player"; #1715).
// Pure: Savant percentiles in, bucket bars and one OVR out. No fetch, no React,
// no I/O, and no war.json: the caller turns `fld` into a percentile itself.
import { clamp } from '../../lib/math/number.js'

// Every tunable lives here. "Spec" = docs/ovr-rating.md; "start value" = the
// spec says to tune it.
export const CONSTANTS = {
  // Spec, "Percentile to rating": start values. 50th percentile -> 60, one
  // standard deviation -> 12 points, floored at 20, capped at 99.
  MID: 60,
  SD: 12,
  FLOOR: 20,
  CAP: 99,
  // Percentile 0 and 100 have an infinite z. Clamp to this many percentile
  // points from each end: z = +-3.72, so 0 rates 20 (floor) and 100 rates 99
  // (cap). My choice; the spec names none.
  PCT_EPSILON: 0.01,
  // Spec, "Attribute buckets", "Roll-up weights (decided)", "Minimum data
  // (decided)" and "Roll-up spread (decided)". `stretch` is a start value,
  // measured on the old weights (spec). `required` buckets must all have a bar.
  hitter: {
    buckets: {
      contact: ['xwoba', 'squaredUp'],
      power: ['ev', 'hardHit', 'brl', 'batSpeed'],
      speed: ['sprintSpeed'],
      fielding: ['fld'],
    },
    weights: { power: 22, contact: 33, speed: 17, fielding: 28 },
    stretch: 2.0,
    required: ['contact', 'power'],
  },
  pitcher: {
    buckets: {
      stuff: ['whiff', 'k', 'fbVelo', 'hardHit'],
      results: ['xera'],
      control: ['bb'],
    },
    weights: { stuff: 30, results: 45, control: 25 },
    stretch: 1.5,
    required: ['stuff', 'results', 'control'],
  },
}

// Inverse of the standard normal CDF, p in (0, 1). Acklam's rational
// approximation, relative error about 1e-9.
const A = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
const B = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
const C = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
const D = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
export function inverseNormalCdf(p) {
  const tail = (q) =>
    (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) /
    ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1)
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)))
  if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log(1 - p)))
  const q = p - 0.5
  const r = q * q
  return (
    ((((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q) /
    (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1)
  )
}

// A 0-100 percentile as a bell-curve rating, 20 to 99.
export function percentileToRating(p) {
  const { MID, SD, FLOOR, CAP, PCT_EPSILON } = CONSTANTS
  const z = inverseNormalCdf(clamp(p, PCT_EPSILON, 100 - PCT_EPSILON) / 100)
  return clamp(MID + SD * z, FLOOR, CAP)
}

function rate(pcts, { buckets, weights, stretch, required }) {
  const bars = {}
  let wSum = 0
  let wTotal = 0
  for (const [bucket, keys] of Object.entries(buckets)) {
    // Number.isFinite(null) is false: a null or missing metric is skipped.
    const rated = keys.map((k) => pcts?.[k]).filter(Number.isFinite).map(percentileToRating)
    if (!rated.length) continue
    bars[bucket] = rated.reduce((s, r) => s + r, 0) / rated.length
    wSum += weights[bucket] * bars[bucket]
    wTotal += weights[bucket]
  }
  if (required.some((b) => !(b in bars))) return null
  const { MID, FLOOR, CAP } = CONSTANTS
  const rollup = wSum / wTotal // a missing bucket's weight is shared by dividing by what is present
  // The spec is silent on the floor after the stretch: I keep it (assumption).
  return { ovr: clamp(MID + stretch * (rollup - MID), FLOOR, CAP), bars, rollup }
}

// pcts: { xwoba, squaredUp, ev, hardHit, brl, batSpeed, sprintSpeed, fld }
export const rateHitter = (pcts) => rate(pcts, CONSTANTS.hitter)

// pcts: { whiff, k, fbVelo, hardHit, xera, bb }
export const ratePitcher = (pcts) => rate(pcts, CONSTANTS.pitcher)
