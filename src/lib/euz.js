// Per-game "Estimated Umpire Zone" (EUZ) consistency — pure JS, no Node-only
// APIs, so this runs in BOTH scripts/gen-umpire-accuracy.mjs (Node, nightly
// season aggregate) and the live reveal-only box-score selector (browser).
// See .scratch/umpire-accuracy/consistency-favor-scope.md §1 for the design.
//
// UmpScorecards fits two 2D kernel density estimates per game — strike(x,z)
// over that game's called-strike locations, ball(x,z) over called-ball
// locations — then combines them via Bayes' theorem with that game's own
// strike/ball rate as the prior, and calls the EUZ the 50% contour of the
// result. We don't need the contour (that's only for their public zone-map
// graphic): consistency only needs prob_strike evaluated AT each called
// pitch's own (pX, pZ), which collapses the Bayes formula to a clean ratio —
// see the derivation below.
//
// DERIVATION (why no bandwidth/normalization constants survive). A Gaussian
// KDE's density at a point is (1/n)·Σ K(point - sample_i)·(normalization
// constant depending only on the shared bandwidth). With ONE bandwidth
// shared across both classes (computed from the WHOLE game's pitches, not
// per-class — see gameBandwidth below), that normalization constant and the
// 1/n both cancel between numerator and denominator once combined with the
// Bayes prior (P(strike) = n_strike/n_total, same n cancellation): the
// result is exactly the ratio of raw (unnormalized) kernel sums:
//   prob_strike(x,z) = Σ_strike K(x,z) / [Σ_strike K(x,z) + Σ_ball K(x,z)]
// So the implementation below never computes a real probability density —
// just a plain sum of Gaussian bumps per class, which is all the ratio needs.

// Below this many called pitches in a game, there isn't enough signal to
// establish "his zone" at all (a Silverman bandwidth degenerates with too
// few points) — same null-degrade convention as every other thin-sample
// guard in this codebase (MIN_RANK_GAMES, RE24_FALLBACK_MIN_N, …).
export const MIN_CONSISTENCY_SAMPLE = 40

// A tiny nonzero floor for a degenerate axis (every pitch at the exact same
// coordinate, essentially impossible with real data but guards divide-by-zero).
const MIN_BANDWIDTH = 0.05 // ~0.6 inches, in feet

// Silverman's rule of thumb, per axis: 1.06 · σ · n^(-1/5).
function silverman(values) {
  const n = values.length
  if (n < 2) return MIN_BANDWIDTH
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)
  const sd = Math.sqrt(variance)
  return sd ? Math.max(1.06 * sd * Math.pow(n, -0.2), MIN_BANDWIDTH) : MIN_BANDWIDTH
}

// One shared (bwX, bwZ) bandwidth pair for the whole game, computed from ALL
// its called pitches on each axis independently (a tighter-zone game gets a
// narrower kernel than a wild one) — shared across both classes, which is
// what makes the derivation above cancel cleanly.
export function gameBandwidth(pitches) {
  return {
    bwX: silverman(pitches.map((p) => p.pX)),
    bwZ: silverman(pitches.map((p) => p.pZ)),
  }
}

// `pitches`: [{ pX, pZ, strikeCall }] for one game's called judgments only
// (the same set gen-umpire-accuracy.mjs already isolates — details.code 'C'
// or 'B'/'*B'). Returns { consistent, called } or null below
// MIN_CONSISTENCY_SAMPLE. Leave-one-out: a pitch's own location never
// contributes to its own density sum, or it would trivially agree with
// whatever it was actually called.
export function estimateGameConsistency(pitches) {
  const called = pitches.length
  if (called < MIN_CONSISTENCY_SAMPLE) return null
  const { bwX, bwZ } = gameBandwidth(pitches)

  let consistent = 0
  for (let i = 0; i < pitches.length; i++) {
    const pi = pitches[i]
    let strikeDensity = 0
    let ballDensity = 0
    for (let j = 0; j < pitches.length; j++) {
      if (j === i) continue
      const pj = pitches[j]
      const dx = (pi.pX - pj.pX) / bwX
      const dz = (pi.pZ - pj.pZ) / bwZ
      const k = Math.exp(-0.5 * (dx * dx + dz * dz))
      if (pj.strikeCall) strikeDensity += k
      else ballDensity += k
    }
    const total = strikeDensity + ballDensity
    const probStrike = total > 0 ? strikeDensity / total : 0.5
    const predictedStrike = probStrike > 0.5
    if (predictedStrike === pi.strikeCall) consistent++
  }
  return { consistent, called }
}
