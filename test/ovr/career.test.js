// OVR step 4 (#1717, docs/ovr-rating.md "Career rating"): the pure blend of
// Savant percentile seasons into one percentile per metric.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blendCareer, CONSTANTS } from '../../src/api/ovr/career.js'

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)
const { W, TAIL } = CONSTANTS

test('a one-season player gets that season back, unshifted', () => {
  const out = blendCareer({ 2026: { xwoba: 71, sprintSpeed: 40, fbVelo: null } }, 1999)
  assert.deepEqual(out, { xwoba: 71, sprintSpeed: 40 })
})

test('the newest season weighs most, the tail least', () => {
  const s = (v) => ({ xwoba: v })
  const out = blendCareer({ 2026: s(100), 2025: s(0), 2024: s(0), 2023: s(0) }, 1999)
  near(out.xwoba, (100 * W[0]) / (W[0] + W[1] + W[2] + TAIL))
  assert.ok(W[0] > W[1] && W[1] > W[2] && W[2] > TAIL)
})

test('a missing cell drops out and the weights renormalize for that metric only', () => {
  const out = blendCareer(
    { 2026: { xwoba: 90, batSpeed: null }, 2025: { xwoba: 50, batSpeed: 60 }, 2024: { xwoba: 10, batSpeed: 20 } },
    1999,
  )
  near(out.xwoba, (90 * W[0] + 50 * W[1] + 10 * W[2]) / (W[0] + W[1] + W[2]))
  near(out.batSpeed, (60 * W[1] + 20 * W[2]) / (W[1] + W[2]))
})

test('a metric with no cell in any season is absent', () => {
  assert.deepEqual(blendCareer({ 2026: { xwoba: null }, 2025: {} }, 1999), {})
})

test('a season the player lacks does not move the weights: 3 seasons -> 5/4/3, no tail', () => {
  const out = blendCareer({ 2025: { k: 90 }, 2024: { k: 50 }, 2023: { k: 10 } }, 1999)
  near(out.k, (90 * W[0] + 50 * W[1] + 10 * W[2]) / (W[0] + W[1] + W[2]))
})

test('the age shift touches sprintSpeed and fbVelo and no other metric', () => {
  const old = { xwoba: 50, ev: 50, k: 50, sprintSpeed: 50, fbVelo: 50 }
  const out = blendCareer({ 2026: { ...old, sprintSpeed: 50, fbVelo: 50 }, 2025: old }, 2004) // age 21 -> 22
  assert.equal(out.xwoba, 50)
  assert.equal(out.ev, 50)
  assert.equal(out.k, 50)
  assert.ok(out.sprintSpeed > 50, 'young: the older season is moved up')
  assert.ok(out.fbVelo > 50)
})

test('the shift is the table value at the older season age, summed year by year', () => {
  // Born 1999: age 26 in 2025 -> 27 in 2026. One step, table at 26: sprint +0.46, fbVelo +1.4.
  const out = blendCareer({ 2026: { sprintSpeed: 50, fbVelo: 50 }, 2025: { sprintSpeed: 50, fbVelo: 50 } }, 1999)
  near(out.sprintSpeed, 50 + (0.46 * W[1]) / (W[0] + W[1]))
  near(out.fbVelo, 50 + (1.4 * W[1]) / (W[0] + W[1]))
  // Two steps: 2024 (age 25) -> 2026: table at 25 + table at 26.
  const two = blendCareer({ 2026: { fbVelo: 50 }, 2024: { fbVelo: 50 } }, 1999)
  near(two.fbVelo, 50 + ((2.13 + 1.4) * W[1]) / (W[0] + W[1]))
})

test('an older player shifts down; the newest season never shifts', () => {
  const out = blendCareer({ 2026: { sprintSpeed: 50 }, 2025: { sprintSpeed: 50 } }, 1988) // age 37 -> 38
  assert.ok(out.sprintSpeed < 50)
  assert.equal(blendCareer({ 2026: { fbVelo: 77 } }, 1988).fbVelo, 77)
})

test('no birth year: no shift, no crash', () => {
  const s = { sprintSpeed: 50 }
  assert.equal(blendCareer({ 2026: s, 2025: s }, null).sprintSpeed, 50)
})

test('an age outside the table uses its nearest end', () => {
  const young = blendCareer({ 2026: { fbVelo: 50 }, 2025: { fbVelo: 50 } }, 2010) // age 15 -> 16
  const edge = blendCareer({ 2026: { fbVelo: 50 }, 2025: { fbVelo: 50 } }, 2005) // age 20 -> 21
  near(young.fbVelo, edge.fbVelo)
})

test('no seasons: empty', () => {
  assert.deepEqual(blendCareer({}, 1999), {})
})
