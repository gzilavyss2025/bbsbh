// Pure math for gen-prospect-trend.mjs: turns a level's raw season splits
// (statsapi's `stats?stats=season&group=...&sportId=...` shape — the same
// roster-independent splits src/api/statsLevels.js already fetches for the
// combined minors leaderboard) into a qualified population and a percentile
// rank within it. No I/O, no fetch — see scripts/CLAUDE.md's "testable
// helper" convention (lib/roster.mjs is the worked example).
//
// Deliberately NOT a Major League Equivalency: no external level-translation
// coefficients are hardcoded here. A hitter's percentile answers "how does
// his OPS compare to every other qualified hitter at his level this season,"
// nothing about an MLB-context translation — see docs/adr (prospect-level
// percentile decision) for why that scope was chosen over a traditional MLE.

import { sumHitting, sumPitching } from '../../src/api/statsLevels.js'

// Playing-time floors below which one hot/cold week can swing a percentile
// wildly — a just-promoted or recently-injured prospect falls out entirely
// rather than showing a noisy 99th-percentile-on-6-PAs badge.
export const MIN_PLATE_APPEARANCES = 40
export const MIN_OUTS = 30 // 10 innings

// OPS for a hitting split, ERA for a pitching split — both already present on
// statsapi's raw stat object, so nothing here invents a new formula.
function metricFor(group, stat) {
  return Number(group === 'hitting' ? stat.ops : stat.era)
}

// Same field names (`plateAppearances`/`outs`) on both a raw statsapi split's
// `stat` object and combineToPool's summed hitting/pitching line, so this one
// check covers a whole level's population (via qualifiedMetrics below) AND a
// single prospect's own line (gen-prospect-trend.mjs, gating whether HE
// qualifies for a percentile at all, separately from whether the population
// he'd be ranked against is big enough).
export function meetsPlayingTimeFloor(group, stat) {
  if (!stat) return false
  return group === 'hitting'
    ? Number(stat.plateAppearances) >= MIN_PLATE_APPEARANCES
    : Number(stat.outs) >= MIN_OUTS
}

// Filters a level's raw splits to players with a finite metric and enough
// playing time to rank meaningfully. Returns the metric values only (the
// population percentileRank needs), not the full split objects.
export function qualifiedMetrics(splits, group) {
  const values = []
  for (const sp of splits ?? []) {
    const stat = sp?.stat
    if (!stat) continue
    const metric = metricFor(group, stat)
    if (Number.isFinite(metric) && meetsPlayingTimeFloor(group, stat)) values.push(metric)
  }
  return values
}

// Same filter as qualifiedMetrics, but returns player ids instead of metric
// values — used to gather the population an age benchmark is averaged over,
// where the metric itself (OPS/ERA) doesn't matter, only who cleared the
// floor.
export function qualifiedPlayerIds(splits, group) {
  const ids = []
  for (const sp of splits ?? []) {
    const stat = sp?.stat
    const id = sp?.player?.id
    if (!stat || !id) continue
    if (meetsPlayingTimeFloor(group, stat)) ids.push(id)
  }
  return ids
}

// One percentile population per (sportId, group) — every qualified player
// (prospect or not) who logged time at that level in the splits given. Shared
// by gen-prospect-trend.mjs (today's population) and
// gen-prospect-trend-backfill.mjs (a past checkpoint's population) — same
// grouping either way, only the splits fed in differ (season-to-date vs.
// byDateRange-bounded).
export function populationKey(sportId, group) {
  return `${sportId}:${group}`
}

export function buildPopulations(hitSplits, pitSplits) {
  const populations = new Map()
  for (const [splits, group] of [
    [hitSplits, 'hitting'],
    [pitSplits, 'pitching'],
  ]) {
    const bySport = new Map()
    for (const sp of splits) {
      const sportId = sp.sport?.id
      if (!sportId) continue
      if (!bySport.has(sportId)) bySport.set(sportId, [])
      bySport.get(sportId).push(sp)
    }
    for (const [sportId, sportSplits] of bySport) {
      populations.set(populationKey(sportId, group), qualifiedMetrics(sportSplits, group))
    }
  }
  return populations
}

// value's percentile rank within population (0-100, rounded). `higherIsBetter`
// is true for OPS, false for ERA. A value not present in — or better than
// every member of — an empty population returns null rather than a
// fabricated 0/100. Self-inclusion in `population` doesn't change the
// result: counting values strictly worse than `value` is unaffected by
// whether `value` itself is also a population member.
export function percentileRank(value, population, higherIsBetter) {
  if (!Number.isFinite(value) || !population.length) return null
  const worseCount = higherIsBetter
    ? population.filter((v) => v < value).length
    : population.filter((v) => v > value).length
  return Math.round((worseCount / population.length) * 100)
}

// Which of a PoolPlayer's two stat lines (from combineToPool in
// src/api/statsLevels.js) to rank him on. Almost every prospect has exactly
// one; the rare two-way player is broken by position, same convention
// fetch-top-prospects.mjs's dedupeByPlayer uses.
export function primaryGroupFor(position, hasHitting, hasPitching) {
  if (hasHitting && !hasPitching) return 'hitting'
  if (hasPitching && !hasHitting) return 'pitching'
  if (!hasHitting && !hasPitching) return null
  return /P$/.test(position || '') ? 'pitching' : 'hitting'
}

// One snapshot row for a PoolPlayer, shared by gen-prospect-trend.mjs and its
// backfill. The percentile population and the level-tenure median each cover
// ONE level, so the row reads his line at his highest level in this group, not
// `p.hitting`/`p.pitching` (combineToPool's sum over every level: Owen Ayers
// is 538 PA, 165% of a stay, 91st; AAA alone is 208 PA, 64%, 38th — #1279).
// Null when he has no line in his primary group. `atLevel` marks the rule, so
// movementSince can tell these rows from the summed ones written before it.
export function snapshotRow(p, populations) {
  const group = primaryGroupFor(p.position, Boolean(p.hitting), Boolean(p.pitching))
  if (!group) return null
  const hitting = group === 'hitting'
  const splits = (hitting ? p.hittingSplits : p.pitchingSplits).filter((s) => s.sport?.id)
  if (!splits.length) return null
  const sportId = Math.min(...splits.map((s) => s.sport.id)) // a LOWER id is a HIGHER level
  const levelSplits = splits.filter((s) => s.sport.id === sportId)
  const line = hitting ? sumHitting(levelSplits) : sumPitching(levelSplits)
  const qualified = meetsPlayingTimeFloor(group, line)
  const population = populations.get(populationKey(sportId, group)) ?? []
  const metric = Number(hitting ? line.ops : line.era)
  const percentile = qualified ? percentileRank(metric, population, hitting) : null
  const sampleSize = Number(hitting ? line.plateAppearances : line.outs) || 0
  return { group, payload: { sportId, percentile, qualified, sampleSize, populationSize: population.length, atLevel: true } }
}

// A row's movement against an earlier snapshot (`prior`: { date, payload }).
// Null unless both rows read one level: a row from before #1279 summed every
// level, so the gap would be a change of method, not of play (Owen Ayers: 91,
// then 38 the night the rule shipped).
export function movementSince(payload, prior) {
  if (!payload.atLevel || !prior?.payload.atLevel) return null
  if (payload.percentile == null || prior.payload.percentile == null) return null
  return { delta: payload.percentile - prior.payload.percentile, sinceDate: prior.date }
}
