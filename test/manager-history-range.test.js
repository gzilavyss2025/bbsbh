// gen-manager-history.mjs's range merge (scripts/lib/records/manager-history-merge.mjs)
// and the coverage the shipped shards claim. The nightly --current-only run and
// a hand-run --from/--to backfill both go through the same merge.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readdir, readFile } from 'node:fs/promises'
import { mergeSeasonRange, mergeCoverage, sharedCoverage, mergeNeedsResearch } from '../scripts/lib/records/manager-history-merge.mjs'
import { MANAGER_HISTORY_FIRST_SEASON } from '../src/lib/records/managerHistory.js'

const stint = (season, teamId = 158) => ({ teamId, season, job: 'Manager', jobId: 'MNGR' })

test('mergeSeasonRange swaps the swept seasons and keeps the rest', () => {
  const existing = { 1: [stint(2001), stint(2002)], 2: [stint(2001, 142)] }
  const fresh = { 1: [stint(1995)], 3: [stint(1996, 142)] }
  const out = mergeSeasonRange(existing, fresh, 1990, 1999)
  assert.deepEqual(out[1].map((s) => s.season), [1995, 2001, 2002])
  assert.deepEqual(out[2].map((s) => s.season), [2001])
  assert.deepEqual(out[3].map((s) => s.season), [1996])
})

test('mergeSeasonRange drops a swept-range row the fresh sweep no longer returns', () => {
  const existing = { 1: [stint(1995), stint(2001)] }
  const out = mergeSeasonRange(existing, {}, 1990, 1999)
  assert.deepEqual(out[1].map((s) => s.season), [2001])
})

test('mergeSeasonRange omits a person left with no stints', () => {
  const out = mergeSeasonRange({ 1: [stint(1995)] }, {}, 1990, 1999)
  assert.equal(1 in out, false)
})

test('mergeCoverage widens the stored range and never shrinks it', () => {
  assert.deepEqual(mergeCoverage({ seasons: [2000, 2026] }, 1990, 1999).seasons, [1990, 2026])
  assert.deepEqual(mergeCoverage({ seasons: [1990, 2026] }, 2026, 2026).seasons, [1990, 2026])
  assert.deepEqual(mergeCoverage(undefined, 2026, 2026).seasons, [2026, 2026])
})

test('mergeCoverage refuses a slice that leaves a gap', () => {
  assert.throws(() => mergeCoverage({ seasons: [2000, 2026] }, 1950, 1960), /gap/)
})

test('every shipped shard claims the first season, and no stint predates it', async () => {
  const dir = new URL('../public/data/manager-history/', import.meta.url)
  for (const f of (await readdir(dir)).filter((n) => n.endsWith('.json'))) {
    const shard = JSON.parse(await readFile(new URL(f, dir), 'utf8'))
    assert.equal(shard.coverage.seasons[0], MANAGER_HISTORY_FIRST_SEASON, f)
    for (const stints of Object.values(shard.byPersonId)) {
      for (const s of stints) assert.ok(s.season >= MANAGER_HISTORY_FIRST_SEASON, f)
    }
  }
})

test('sharedCoverage returns the one range, and throws when shards disagree', () => {
  const a = { seasons: [1969, 2026], mode: 'backfill' }
  assert.deepEqual(sharedCoverage([a, { ...a }, undefined]), a)
  assert.throws(() => sharedCoverage([a, { seasons: [1990, 2026] }]), /disagree/)
})

test('mergeNeedsResearch re-measures the swept range and keeps the rest', () => {
  const q = [
    { teamId: 1, season: 1990 },
    { teamId: 2, season: 2000 },
    { teamId: 3, season: 2001 },
    { teamId: 4, season: 2020 },
  ]
  const out = mergeNeedsResearch(q, [{ teamId: 3, season: 2001 }], [{ teamId: 4, season: 2020 }], 2000, 2002)
  assert.deepEqual(out, [
    { teamId: 1, season: 1990 },
    { teamId: 3, season: 2001 },
  ])
})
