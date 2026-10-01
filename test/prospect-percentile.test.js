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
  snapshotRow,
  movementSince,
} from '../scripts/lib/prospectPercentile.mjs'
import { combineToPool } from '../src/api/statsLevels.js'
import { tenureFact } from '../src/api/levelTenure.js'

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

// --------------------------------------------------------------------------
// snapshotRow — #1279. Both benchmarks (the percentile population and the
// level-tenure median) cover ONE level, so a prospect's row reads his line at
// that level, not his season summed over every level he played.
// Owen Ayers (689196), 2026 — real lines. Shipped: 538 PA, 165%, .929, 91st.
// --------------------------------------------------------------------------
const ayersSplit = (sportId, stat) => ({
  player: { id: 689196, fullName: 'Owen Ayers' },
  sport: { id: sportId },
  team: { id: 100 + sportId },
  position: { abbreviation: 'C' },
  stat,
})
const AYERS_SPLITS = [
  ayersSplit(11, { plateAppearances: 208, atBats: 174, hits: 43, doubles: 10, triples: 0, homeRuns: 3, baseOnBalls: 32, hitByPitch: 1, sacFlies: 1, totalBases: 62, strikeOuts: 45 }),
  ayersSplit(12, { plateAppearances: 278, atBats: 230, hits: 70, doubles: 16, triples: 1, homeRuns: 16, baseOnBalls: 42, hitByPitch: 4, sacFlies: 2, totalBases: 136, strikeOuts: 69 }),
  ayersSplit(13, { plateAppearances: 52, atBats: 43, hits: 16, doubles: 3, triples: 0, homeRuns: 6, baseOnBalls: 8, hitByPitch: 1, sacFlies: 0, totalBases: 37, strikeOuts: 11 }),
]
// 100 qualified AAA hitters: 38 below .721, 53 more below .929, 9 above.
const AAA_OPS = [...Array(38).fill(0.6), ...Array(53).fill(0.8), ...Array(9).fill(0.95)]
const AAA_BENCHMARK = { levels: { AAA: { hitting: { unit: 'pa', n: 355, median: 327, p75: 529, p90: 806 } } } }

test('snapshotRow reads a three-level prospect at his AAA line only (Owen Ayers)', () => {
  const [ayers] = combineToPool(AYERS_SPLITS, [])
  const { group, payload } = snapshotRow(ayers, new Map([[populationKey(11, 'hitting'), AAA_OPS]]))
  assert.equal(group, 'hitting')
  assert.equal(payload.sportId, 11)
  assert.equal(payload.sampleSize, 208) // not 538
  assert.equal(payload.percentile, 38) // .721 — not the 91st a summed .929 earns
  assert.equal(payload.populationSize, 100)
  assert.equal(tenureFact(AAA_BENCHMARK, payload.sportId, group, payload.sampleSize).pct, 64) // not 165
})

test('snapshotRow: a promotion 30 PA ago leaves him unqualified at the new level, with that level\'s count', () => {
  const splits = [
    ayersSplit(12, { ...AYERS_SPLITS[1].stat }),
    ayersSplit(11, { ...AYERS_SPLITS[0].stat, plateAppearances: 30 }),
  ]
  const [p] = combineToPool(splits, [])
  const { payload } = snapshotRow(p, new Map([[populationKey(11, 'hitting'), AAA_OPS]]))
  assert.deepEqual([payload.sportId, payload.sampleSize, payload.qualified, payload.percentile], [11, 30, false, null])
})

// #1357. The population holds MLB's printed strings, and the player is in it.
// His own line, summed by sumPitching/sumHitting, is a full-precision float. A
// float a hair better than his printed value counted HIS OWN entry as worse:
// +1 on 50 of 660 real rows (Justin Campbell, AAA: ERA 2.0769..., MLB "2.08",
// stored 93, right answer 92).
const levelSplit = (id, sportId, stat, position) => ({
  player: { id }, sport: { id: sportId }, team: { id: 900 + sportId }, position: { abbreviation: position }, stat,
})

test('snapshotRow ranks a pitcher on his ERA as MLB prints it, so his own entry is not "worse" (#1357)', () => {
  // 6 ER in 78 outs: 2.076923..., which MLB prints as "2.08".
  const campbell = levelSplit(1, 11, { earnedRuns: 6, outs: 78, era: '2.08' }, 'P')
  const others = [['1.50', 2], ['3.00', 3], ['4.00', 4]].map(([era, id]) => levelSplit(id, 11, { era, outs: 90 }, 'P'))
  const populations = buildPopulations([], [campbell, ...others])
  const [p] = combineToPool([], [campbell])
  // Worse than 2.08: 3.00 and 4.00, 2 of 4. The float also beat his own 2.08: 75.
  assert.equal(snapshotRow(p, populations).payload.percentile, 50)
})

test('snapshotRow ranks a hitter on his OPS as MLB prints it, not the float sum (#1357)', () => {
  // OBP .298 + SLG .280 sums to 0.5780000000000001; MLB prints ".578".
  const line = { plateAppearances: 168, atBats: 150, hits: 32, baseOnBalls: 18, totalBases: 42, ops: '.578' }
  const hitter = levelSplit(1, 12, line, 'SS')
  const others = [['.500', 2], ['.700', 3], ['.800', 4]].map(([ops, id]) => levelSplit(id, 12, { ops, plateAppearances: 200 }, 'SS'))
  const populations = buildPopulations([hitter, ...others], [])
  const [p] = combineToPool([hitter], [])
  assert.equal(p.hitting.ops, 0.5780000000000001) // the float the bug ranked
  // Worse than .578: .500 only, 1 of 4. The float also beat his own .578: 50.
  assert.equal(snapshotRow(p, populations).payload.percentile, 25)
})

test('snapshotRow is null for a player with no line in either group', () => {
  assert.equal(snapshotRow({ position: 'C', hitting: null, pitching: null }, new Map()), null)
})

// A row written before #1279 summed every level. Diffing it against a level-only
// row would print a method change as a move (Ayers: 91 then 38 = "down 53").
test('movementSince compares two rows that both read one level', () => {
  const prior = { date: '2026-09-16', payload: { percentile: 50, atLevel: true } }
  assert.deepEqual(movementSince({ percentile: 62, atLevel: true }, prior), { delta: 12, sinceDate: '2026-09-16' })
})

test('movementSince is null against a row from before the one-level rule', () => {
  const prior = { date: '2026-09-16', payload: { percentile: 91 } }
  assert.equal(movementSince({ percentile: 38, atLevel: true }, prior), null)
})

test('movementSince is null with no prior row or an unranked side', () => {
  assert.equal(movementSince({ percentile: 38, atLevel: true }, undefined), null)
  assert.equal(movementSince({ percentile: null, atLevel: true }, { date: 'd', payload: { percentile: 4, atLevel: true } }), null)
  assert.equal(movementSince({ percentile: 4, atLevel: true }, { date: 'd', payload: { percentile: null, atLevel: true } }), null)
})
