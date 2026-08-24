// Fetching + pure selectors over bbsbh's own level-tenure benchmark
// (public/data/level-tenure-benchmark.json, gen-level-tenure-benchmark.mjs) —
// how much playing time a typical prospect accumulates at a MiLB level
// before promotion. Season-aggregate, historical-cohort data, same footing
// as prospectTrend.js; complements it rather than replacing it — that module
// says how well a prospect is hitting/pitching, this one says how long he's
// been AT the level relative to a typical stay. See
// docs/level-tenure-benchmark.md for the cohort and reconstruction rule.

import { staticJson } from './staticJson.js'

const EMPTY_SNAPSHOT = { levels: {} }

export const fetchLevelTenure = staticJson('/data/level-tenure-benchmark.json', {
  fallback: EMPTY_SNAPSHOT,
})

// sportId -> the benchmark's level key (11 AAA / 12 AA / 13 High-A / 14 A —
// same numbering src/lib/teams.js's SPORT_IDS uses).
const LEVEL_NAME = { 11: 'AAA', 12: 'AA', 13: 'High-A', 14: 'A' }

// The benchmark checkpoint for one (level, group), or null when the snapshot
// hasn't loaded / has no data for it (a level the generator's cohort never
// touched, or the file hasn't run yet).
export function benchmarkFor(snapshot, sportId, group) {
  const level = LEVEL_NAME[sportId]
  if (!level) return null
  const entry = snapshot?.levels?.[level]?.[group]
  return entry ?? null
}

// The Prospect Card's tenure fact: how far a player's CURRENT sample (PA for
// a hitter, OUTS for a pitcher — the same units prospectTrend.js's
// `sampleSize` already carries, so callers pass entry.sampleSize straight
// through with no conversion) sits relative to a typical stay at this level,
// expressed as a percent of the MEDIAN — the framing this feature exists to
// answer ("roughly X% through a typical stay"), not a percentile of the
// population (that's the performance card's job, not this one's).
//
// Returns null below the benchmark's own floor (no data for this level/group)
// or when sampleSize isn't a real number yet.
export function tenureFact(snapshot, sportId, group, sampleSize) {
  const benchmark = benchmarkFor(snapshot, sportId, group)
  if (!benchmark || !Number.isFinite(sampleSize) || !benchmark.median) return null
  return {
    sampleSize,
    median: benchmark.median,
    p75: benchmark.p75,
    p90: benchmark.p90,
    pct: Math.round((sampleSize / benchmark.median) * 100),
    n: benchmark.n,
    unit: benchmark.unit, // 'pa' | 'outs'
  }
}
