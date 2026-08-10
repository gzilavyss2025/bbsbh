// Coverage for the pure combine/sum helpers in src/api/statsLevels.js —
// sumHitting/sumPitching (rate stats recomputed from summed components, not
// averaged) and combineToPool's raw hittingSplits/pitchingSplits passthrough,
// which prospects.js's resolveCurrentLevels relies on to re-partition a
// player's splits by level (MLB vs. every MiLB level combined) for the
// /prospects "Line" column's (MLB)/(MiLB) split.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sumHitting, sumPitching, combineToPool } from '../src/api/statsLevels.js'

const hitStat = (atBats, hits, homeRuns, rbi) => ({
  stat: { atBats, hits, homeRuns, rbi, baseOnBalls: 0, hitByPitch: 0, strikeOuts: 0, sacFlies: 0, totalBases: hits },
})
const pitStat = (outs, earnedRuns, strikeOuts) => ({
  stat: { outs, earnedRuns, strikeOuts, baseOnBalls: 0, hits: 0, atBats: 0, numberOfPitches: 0 },
})

test('sumHitting recomputes AVG from summed hits/atBats rather than averaging per-split rates', () => {
  const t = sumHitting([hitStat(100, 30, 5, 20), hitStat(50, 20, 3, 10)])
  assert.equal(t.atBats, 150)
  assert.equal(t.hits, 50)
  assert.equal(t.homeRuns, 8)
  assert.equal(t.rbi, 30)
  assert.equal(t.avg, 50 / 150)
})

test('sumHitting degrades to a zero line for an empty splits array, not NaN', () => {
  const t = sumHitting([])
  assert.equal(t.avg, 0)
  assert.equal(t.homeRuns, 0)
})

test('sumPitching recomputes ERA from summed earnedRuns/outs and derives the IP display string', () => {
  const t = sumPitching([pitStat(60, 10, 25), pitStat(90, 12, 40)])
  assert.equal(t.outs, 150)
  assert.equal(t.inningsPitched, '50.0')
  assert.equal(t.earnedRuns, 22)
  assert.equal(t.era, (22 * 9) / 50)
  assert.equal(t.strikeOuts, 65)
})

test('combineToPool keeps each player\'s raw hitting/pitching splits alongside the summed line', () => {
  const hitting = [
    { player: { id: 1, fullName: 'A' }, sport: { id: 1 }, team: { id: 100 }, ...hitStat(100, 30, 5, 20) },
    { player: { id: 1, fullName: 'A' }, sport: { id: 11 }, team: { id: 200 }, ...hitStat(50, 20, 3, 10) },
  ]
  const [row] = combineToPool(hitting, [])
  assert.equal(row.id, 1)
  assert.equal(row.hittingSplits.length, 2)
  assert.deepEqual(row.hittingSplits.map((s) => s.sport.id), [1, 11])
  assert.equal(row.pitchingSplits.length, 0)
  // The summed line still folds both splits together...
  assert.equal(row.hitting.hits, 50)
  // ...but the raw splits are what let a caller re-partition by level instead
  // of only ever seeing the combined total.
  const mlbOnly = row.hittingSplits.filter((s) => s.sport.id === 1)
  assert.equal(sumHitting(mlbOnly).hits, 30)
})

test('combineToPool gives an empty hittingSplits/pitchingSplits array, not null, for a group with no lines', () => {
  const pitching = [{ player: { id: 2, fullName: 'B' }, sport: { id: 1 }, team: { id: 100 }, ...pitStat(60, 10, 25) }]
  const [row] = combineToPool([], pitching)
  assert.deepEqual(row.hittingSplits, [])
  assert.equal(row.hitting, null)
  assert.equal(row.pitchingSplits.length, 1)
})
