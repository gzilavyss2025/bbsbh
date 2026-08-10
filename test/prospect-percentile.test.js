// Coverage for the pure percentile math behind gen-prospect-trend.mjs —
// qualification cutoffs, ascending vs. descending rank, and the population
// edge cases (empty, single-member).
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MIN_PLATE_APPEARANCES,
  MIN_OUTS,
  meetsPlayingTimeFloor,
  qualifiedMetrics,
  percentileRank,
  primaryGroupFor,
} from '../scripts/lib/prospectPercentile.mjs'

const hitSplit = (ops, plateAppearances) => ({ stat: { ops, plateAppearances } })
const pitSplit = (era, outs) => ({ stat: { era, outs } })

// --------------------------------------------------------------------------
// meetsPlayingTimeFloor — same check applies to a raw split's stat object
// AND combineToPool's summed line, since both use the same field names.
// --------------------------------------------------------------------------
test('meetsPlayingTimeFloor gates hitting on PA and pitching on outs', () => {
  assert.equal(meetsPlayingTimeFloor('hitting', { plateAppearances: MIN_PLATE_APPEARANCES }), true)
  assert.equal(meetsPlayingTimeFloor('hitting', { plateAppearances: MIN_PLATE_APPEARANCES - 1 }), false)
  assert.equal(meetsPlayingTimeFloor('pitching', { outs: MIN_OUTS }), true)
  assert.equal(meetsPlayingTimeFloor('pitching', { outs: MIN_OUTS - 1 }), false)
})

test('meetsPlayingTimeFloor is false for a missing stat object', () => {
  assert.equal(meetsPlayingTimeFloor('hitting', null), false)
})

// --------------------------------------------------------------------------
// qualifiedMetrics
// --------------------------------------------------------------------------
test('qualifiedMetrics keeps hitting splits at or above the PA floor', () => {
  const splits = [
    hitSplit(0.9, MIN_PLATE_APPEARANCES), // exactly at the floor — kept
    hitSplit(0.7, MIN_PLATE_APPEARANCES - 1), // one short — dropped
    hitSplit(1.1, 200),
  ]
  assert.deepEqual(qualifiedMetrics(splits, 'hitting'), [0.9, 1.1])
})

test('qualifiedMetrics keeps pitching splits at or above the outs floor', () => {
  const splits = [
    pitSplit(3.5, MIN_OUTS), // exactly at the floor — kept
    pitSplit(2.0, MIN_OUTS - 1), // one short — dropped
    pitSplit(4.2, 90),
  ]
  assert.deepEqual(qualifiedMetrics(splits, 'pitching'), [3.5, 4.2])
})

test('qualifiedMetrics skips a split with no stat block or a non-finite metric, without throwing', () => {
  const splits = [
    { stat: null },
    {},
    { stat: { ops: 'DNP', plateAppearances: 200 } },
    hitSplit(0.8, 100),
  ]
  assert.deepEqual(qualifiedMetrics(splits, 'hitting'), [0.8])
})

test('qualifiedMetrics returns [] for a missing/empty splits array', () => {
  assert.deepEqual(qualifiedMetrics(null, 'hitting'), [])
  assert.deepEqual(qualifiedMetrics([], 'pitching'), [])
})

// --------------------------------------------------------------------------
// percentileRank
// --------------------------------------------------------------------------
test('percentileRank ranks higher-is-better (OPS) by share of the population strictly below it', () => {
  const population = [0.6, 0.7, 0.8, 0.9, 1.0] // 5 hitters
  assert.equal(percentileRank(0.8, population, true), 40) // 2 of 5 below
  assert.equal(percentileRank(0.6, population, true), 0) // nobody below the worst line
  assert.equal(percentileRank(1.0, population, true), 80) // 4 of 5 below the best line
})

test('percentileRank ranks lower-is-better (ERA) by share of the population strictly above it', () => {
  const population = [2.5, 3.0, 3.5, 4.0, 4.5] // 5 pitchers
  assert.equal(percentileRank(3.5, population, false), 40) // 2 of 5 worse (higher ERA)
  assert.equal(percentileRank(4.5, population, false), 0) // nobody worse than the highest ERA
  assert.equal(percentileRank(2.5, population, false), 80) // 4 of 5 worse than the best ERA
})

test('percentileRank returns null for an empty population or a non-finite value', () => {
  assert.equal(percentileRank(0.9, [], true), null)
  assert.equal(percentileRank(NaN, [0.5, 0.6], true), null)
})

test('percentileRank on a single-member population', () => {
  assert.equal(percentileRank(0.9, [0.9], true), 0) // beats no one else
})

// --------------------------------------------------------------------------
// primaryGroupFor
// --------------------------------------------------------------------------
test('primaryGroupFor picks the group a player actually has a line in', () => {
  assert.equal(primaryGroupFor('SS', true, false), 'hitting')
  assert.equal(primaryGroupFor('RHP', false, true), 'pitching')
  assert.equal(primaryGroupFor('OF', false, false), null)
})

test('primaryGroupFor breaks a two-way player by position', () => {
  assert.equal(primaryGroupFor('LHP', true, true), 'pitching')
  assert.equal(primaryGroupFor('1B', true, true), 'hitting')
})
