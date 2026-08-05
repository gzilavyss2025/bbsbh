// Regression coverage for PlayDiamond.jsx's outLegBases — the pure geometry
// that decides how much of the base path draws solid and which two ADJACENT
// bases anchor a caught-on-the-bases runner's half-stroke. A runner thrown
// out two-plus bases past where he last stood safely (2nd, out at home) must
// still be drawn rounding every base he legally touched first — anchoring the
// half-stroke on (reached, outAt) directly, instead of the adjacent pair right
// before outAt, drew a straight chord through the diamond's dead center,
// reading as "thrown out at the pitcher's mound" (a real bug, reported
// live against gamePk 817477's bottom 4th: Alberto Hernandez forced to
// 2nd on a walk, then thrown out at home on Walker Janek's single).
import assert from 'node:assert/strict'
import test from 'node:test'
import { outLegBases } from '../src/components/scoring/playDiamondGeometry.js'

test('no out — traveled is just how far he was credited safe, no leg anchors', () => {
  assert.deepEqual(outLegBases(2, null), { traveled: 2, legA: null, legB: null })
})

test('thrown out at the very next base (adjacent) — unchanged from before: half-stroke spans reached to outAt directly', () => {
  // Safe at 1st, thrown out advancing to 2nd.
  assert.deepEqual(outLegBases(1, 2), { traveled: 1, legA: 1, legB: 2 })
})

test('thrown out TWO bases past where he last stood safely — rounds the base in between, half-stroke anchored on the adjacent pair before the out, not a chord through the middle', () => {
  // Safe at 2nd (forced up on a walk), thrown out at home on a single —
  // gamePk 817477's Alberto Hernandez. He legally touched 3rd first.
  assert.deepEqual(outLegBases(2, 4), { traveled: 3, legA: 3, legB: 4 })
})

test('thrown out THREE bases past where he last stood — rounds every base up to the one just before home', () => {
  // Safe at 1st, gunned down at home trying to score from first on a double.
  assert.deepEqual(outLegBases(1, 4), { traveled: 3, legA: 3, legB: 4 })
})

test('picked off / doubled off a base he already stood on (outAt <= reached) — solid path untouched, tick caps right at the base itself', () => {
  assert.deepEqual(outLegBases(3, 1), { traveled: 3, legA: 0, legB: 1 })
})
