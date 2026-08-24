import { test } from 'node:test'
import assert from 'node:assert/strict'
import { benchmarkFor, tenureFact } from '../src/api/levelTenure.js'

const SNAPSHOT = {
  levels: {
    AAA: { hitting: { unit: 'pa', n: 355, p10: 83, p25: 180, median: 327, p75: 529, p90: 806 }, pitching: null },
    AA: { hitting: { unit: 'pa', n: 366, p10: 180, p25: 267, median: 410, p75: 553, p90: 693 }, pitching: { unit: 'outs', n: 437, p10: 60, p25: 109, median: 205, p75: 316, p90: 444 } },
  },
}

test('benchmarkFor resolves sportId 11/12/13/14 to their level keys', () => {
  assert.deepEqual(benchmarkFor(SNAPSHOT, 11, 'hitting'), SNAPSHOT.levels.AAA.hitting)
  assert.deepEqual(benchmarkFor(SNAPSHOT, 12, 'pitching'), SNAPSHOT.levels.AA.pitching)
})

test('benchmarkFor is null for a level the snapshot has no data for', () => {
  assert.equal(benchmarkFor(SNAPSHOT, 11, 'pitching'), null)
})

test('benchmarkFor is null for an unrecognised sportId or an empty/missing snapshot', () => {
  assert.equal(benchmarkFor(SNAPSHOT, 1, 'hitting'), null)
  assert.equal(benchmarkFor(null, 12, 'hitting'), null)
  assert.equal(benchmarkFor({}, 12, 'hitting'), null)
})

test('tenureFact expresses the current sample as a percent of the benchmark median', () => {
  const fact = tenureFact(SNAPSHOT, 12, 'hitting', 205)
  assert.equal(fact.pct, 50) // 205 / 410 median
  assert.equal(fact.sampleSize, 205)
  assert.equal(fact.median, 410)
  assert.equal(fact.unit, 'pa')
  assert.equal(fact.n, 366)
})

test('tenureFact rounds the percent rather than printing false precision', () => {
  const fact = tenureFact(SNAPSHOT, 11, 'hitting', 100)
  assert.equal(fact.pct, 31) // 100 / 327 = 30.58...
})

test('tenureFact can exceed 100% — a sample already past the typical stay', () => {
  const fact = tenureFact(SNAPSHOT, 12, 'pitching', 250)
  assert.equal(fact.pct, 122) // 250 / 205
})

test('tenureFact is null with no benchmark for that level/group', () => {
  assert.equal(tenureFact(SNAPSHOT, 11, 'pitching', 60), null)
})

test('tenureFact is null for a non-finite sample size', () => {
  assert.equal(tenureFact(SNAPSHOT, 12, 'hitting', null), null)
  assert.equal(tenureFact(SNAPSHOT, 12, 'hitting', NaN), null)
})
