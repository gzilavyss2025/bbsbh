// Median math for the Statcast percentile strip's league-baseline figure
// (scripts/lib/savant.mjs, consumed by scripts/gen-savant-percentiles.mjs).
// Pure, so the intersection rule and the sample floor are pinned here rather
// than eyeballed against a live Savant response.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { median, medianRates } from '../scripts/lib/savant.mjs'

// -------------------------------------------------------------------- median

test('median of an odd-length list is the middle value', () => {
  assert.equal(median([1, 3, 2]), 2)
})

test('median of an even-length list averages the two middle values', () => {
  assert.equal(median([1, 2, 3, 4]), 2.5)
})

test('median rounds to one decimal regardless of the list length parity', () => {
  // An odd-length median comes straight off a raw Savant column (many
  // decimals); an even-length one is an arithmetic average. Both must land
  // on the same one-decimal storage precision, not two different ones.
  assert.equal(median([72.13707063]), 72.1)
  assert.equal(median([72.13707063, 72.24999]), 72.2)
})

test('median of an empty list is null, not zero or NaN', () => {
  assert.equal(median([]), null)
})

test('median is unaffected by input order', () => {
  assert.equal(median([5, 1, 4, 2, 3]), median([1, 2, 3, 4, 5]))
})

// --------------------------------------------------------------- medianRates

test('medianRates only counts ids present in BOTH maps for a key', () => {
  // id 3 has a percentile but no raw value for xwoba; id 4 has a raw value
  // but no percentile. Neither belongs in the population the median is
  // drawn from — only 1 and 2 do.
  const pct = { 1: { xwoba: 90 }, 2: { xwoba: 10 }, 3: { xwoba: 50 } }
  const raw = { 1: { xwoba: 0.4 }, 2: { xwoba: 0.2 }, 4: { xwoba: 0.9 } }
  const out = medianRates(pct, raw, ['xwoba'], 2)
  assert.equal(out.xwoba, 0.3)
})

test('a metric under the floor is left out entirely, not printed thin', () => {
  const pct = { 1: { ev: 90 }, 2: { ev: 10 } }
  const raw = { 1: { ev: 95 }, 2: { ev: 85 } }
  const out = medianRates(pct, raw, ['ev'], 3)
  assert.ok(!('ev' in out))
})

test('a metric at or above the floor is included', () => {
  const pct = { 1: { ev: 90 }, 2: { ev: 10 }, 3: { ev: 50 } }
  const raw = { 1: { ev: 95 }, 2: { ev: 85 }, 3: { ev: 90 } }
  const out = medianRates(pct, raw, ['ev'], 3)
  assert.equal(out.ev, 90)
})

test('each key is checked against its own intersection, independently', () => {
  // xwoba has three qualifying ids; ev has only one (id 2 is missing its raw
  // ev value) — a shared floor of 2 should keep xwoba and drop ev.
  const pct = { 1: { xwoba: 90, ev: 90 }, 2: { xwoba: 10, ev: 10 }, 3: { xwoba: 50, ev: 50 } }
  const raw = { 1: { xwoba: 0.4, ev: 95 }, 2: { xwoba: 0.2 }, 3: { xwoba: 0.3 } }
  const out = medianRates(pct, raw, ['xwoba', 'ev'], 2)
  assert.ok('xwoba' in out)
  assert.ok(!('ev' in out))
})

test('a null value in either map excludes that id, not just a missing key', () => {
  const pct = { 1: { ev: 90 }, 2: { ev: null }, 3: { ev: 50 } }
  const raw = { 1: { ev: 90 }, 2: { ev: 999 }, 3: { ev: 80 } }
  const out = medianRates(pct, raw, ['ev'], 2)
  // Only ids 1 and 3 qualify (id 2's percentile is explicitly null, so its
  // wildly-off raw value of 999 must never enter the average) — median of
  // 90 and 80.
  assert.equal(out.ev, 85)
})
