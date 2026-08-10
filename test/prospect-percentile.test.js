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
  qualifiedPlayerIds,
  percentileRank,
  primaryGroupFor,
  buildPopulations,
  populationKey,
} from '../scripts/lib/prospectPercentile.mjs'

const hitSplit = (ops, plateAppearances, id) => ({ stat: { ops, plateAppearances }, player: { id } })
const pitSplit = (era, outs, id) => ({ stat: { era, outs }, player: { id } })

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

// --------------------------------------------------------------------------
// qualifiedPlayerIds — same floor as qualifiedMetrics, but for the age
// benchmark: who cleared it, not what their metric was.
// --------------------------------------------------------------------------
test('qualifiedPlayerIds keeps only ids that clear the floor', () => {
  const splits = [
    hitSplit(0.9, MIN_PLATE_APPEARANCES, 1),
    hitSplit(0.7, MIN_PLATE_APPEARANCES - 1, 2),
    hitSplit(1.1, 200, 3),
  ]
  assert.deepEqual(qualifiedPlayerIds(splits, 'hitting'), [1, 3])
})

test('qualifiedPlayerIds skips a split with no player id', () => {
  const splits = [{ stat: { plateAppearances: 200 } }, hitSplit(0.8, 100, 4)]
  assert.deepEqual(qualifiedPlayerIds(splits, 'hitting'), [4])
})

test('qualifiedPlayerIds returns [] for a missing/empty splits array', () => {
  assert.deepEqual(qualifiedPlayerIds(null, 'hitting'), [])
  assert.deepEqual(qualifiedPlayerIds([], 'pitching'), [])
})

// --------------------------------------------------------------------------
// buildPopulations / populationKey — one qualified-metric population per
// (sportId, group), shared by the nightly generator and its backfill.
// --------------------------------------------------------------------------
test('buildPopulations groups qualified metrics by sportId and group', () => {
  const hit = [
    { ...hitSplit(0.9, MIN_PLATE_APPEARANCES, 1), sport: { id: 11 } },
    { ...hitSplit(0.5, MIN_PLATE_APPEARANCES - 1, 2), sport: { id: 11 } }, // dropped — under floor
    { ...hitSplit(0.8, MIN_PLATE_APPEARANCES, 3), sport: { id: 12 } },
  ]
  const pit = [{ ...pitSplit(3.0, MIN_OUTS, 4), sport: { id: 11 } }]
  const populations = buildPopulations(hit, pit)
  assert.deepEqual(populations.get(populationKey(11, 'hitting')), [0.9])
  assert.deepEqual(populations.get(populationKey(12, 'hitting')), [0.8])
  assert.deepEqual(populations.get(populationKey(11, 'pitching')), [3.0])
  assert.equal(populations.get(populationKey(14, 'hitting')), undefined)
})

test('buildPopulations skips a split with no sport.id', () => {
  const hit = [{ ...hitSplit(0.9, MIN_PLATE_APPEARANCES, 1) }] // no sport field
  const populations = buildPopulations(hit, [])
  assert.equal(populations.size, 0)
})
