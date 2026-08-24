// Regenerates public/data/level-tenure-benchmark.json — for each full-season
// MiLB level, how much playing time a typical prospect accumulates there
// before promotion. Feeds the Prospect Card's "X% of a typical stay" fact
// (src/api/levelTenure.js, src/components/playerstats/ProspectCard.jsx).
//
// No public dataset like this exists — the closest published figures are
// career-AGGREGATE (summed across every level) or cover one narrow cohort
// with real gaps. This is built from scratch; the full research spike behind
// it — cohort design tradeoffs, an ordering-ambiguity finding and its
// robustness check, and everything NOT shipped in this v1 (pedigree cuts,
// calendar-day duration, org variance, seasonal timing) — is
// docs/level-tenure-benchmark.md. Read that before changing the cohort
// window or the reconstruction rule below.
//
// THE COHORT. Every MLB debutant whose career crossed the REAL rookie
// threshold (public/data/rookies.json's own `rookieUntil` — 130 AB or 50 IP,
// cumulative), reused rather than reinvented so a cup-of-coffee call-up never
// counts as a graduation. The debut window slides with `today`: the most
// recent DEBUT_WINDOW_YEARS classes ending YEARS_TO_RESOLVE years ago, so a
// re-run naturally rolls forward instead of going stale. At today's date that
// reproduces the research spike's own 2019-2023 window exactly.
//
// THE RECONSTRUCTION. One data point per player per level: everything he
// accumulated there, first time through, from arrival to the moment he moved
// to a higher level or the majors. Built from yearByYear splits (sportIds
// 11/12/13/14 — rookie/complex (16) excluded, the same scope the Farm Index
// and gen-milb-history.mjs use) sorted chronologically, with same-season
// multi-level ties broken by ascending level rank. That tie-break is a
// documented assumption, not a certainty — docs/level-tenure-benchmark.md's
// "Reconstruction" section is the transaction-wire validation this generator
// does NOT re-run every invocation (thousands of extra calls for a robustness
// check whose answer — single-digit median movement — is already measured
// and stable; re-verify by hand if the cohort window shifts a lot).
//
// NOT ON THE NIGHTLY CRON — hand-run, same category as gen-milb-history.mjs.
// The benchmark is a slowly-moving historical statistic; a fresh debut class
// resolves its rookieUntil roughly once a year, not once a night. Re-run by
// hand periodically to roll the window forward.
//
// Run by hand: node scripts/gen-level-tenure-benchmark.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ipToOuts } from '../src/api/rehab-policy.js'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'

const here = dirname(fileURLToPath(import.meta.url))
const rookiesPath = join(here, '..', 'public', 'data', 'rookies.json')
const out = join(here, '..', 'public', 'data', 'level-tenure-benchmark.json')

const MILB_SPORT_IDS = [11, 12, 13, 14]
const LEVEL_RANK = { 14: 1, 13: 2, 12: 3, 11: 4 }
const LEVEL_NAME = { 14: 'A', 13: 'High-A', 12: 'AA', 11: 'AAA' }
const DEBUT_WINDOW_YEARS = 5
const YEARS_TO_RESOLVE = 3 // give a debut class time for rookieUntil to settle
const CONCURRENCY = 10

const debutYearMax = new Date().getUTCFullYear() - YEARS_TO_RESOLVE
const debutYearMin = debutYearMax - (DEBUT_WINDOW_YEARS - 1)

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

// --- cohort: real MLB graduates in the sliding debut window -----------------
async function loadCohort() {
  const rookies = await readJsonOr(rookiesPath, null)
  if (!rookies) throw new Error(`${rookiesPath} missing — run gen-rookies.mjs first`)
  const out = []
  for (const [id, p] of Object.entries(rookies.players)) {
    const y = Number((p.debutDate || '').slice(0, 4))
    if (y >= debutYearMin && y <= debutYearMax && p.rookieUntil) {
      out.push({ id: Number(id), debutDate: p.debutDate })
    }
  }
  return out
}

// --- position group, batched (100 ids/call) ---------------------------------
function groupFor(posAbbr) {
  if (!posAbbr) return null
  if (posAbbr === 'TWP') return null // two-way — out of scope for v1, same as the research spike
  return posAbbr === 'P' ? 'pitching' : 'hitting'
}

async function fetchGroups(ids) {
  const byId = new Map()
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const data = await getJson(`/api/v1/people?personIds=${chunk.join(',')}`)
    for (const p of data.people ?? []) byId.set(p.id, groupFor(p.primaryPosition?.abbreviation))
  }
  return byId
}

// --- one player's MiLB yearByYear, across the four full-season levels -------
async function fetchYearByYear(personId, group) {
  const rows = []
  for (const sportId of MILB_SPORT_IDS) {
    try {
      const data = await getJson(
        `/api/v1/people/${personId}/stats?stats=yearByYear&group=${group}&sportId=${sportId}`,
      )
      for (const block of data.stats ?? []) {
        for (const split of block.splits ?? []) {
          if (!split.team?.id || !Number.isInteger(Number(split.season))) continue
          rows.push({ season: Number(split.season), sportId, stat: split.stat ?? {} })
        }
      }
    } catch {
      // a level he never played is a 200 with no splits — this is a real failure, skipped
    }
  }
  return rows
}

function statValue(group, stat) {
  if (group === 'pitching') return { pa: 0, outs: ipToOuts(stat.inningsPitched) }
  const pa = num(stat.plateAppearances) || num(stat.atBats) + num(stat.baseOnBalls) + num(stat.hitByPitch) + num(stat.sacFlies) + num(stat.sacBunts)
  return { pa, outs: 0 }
}

// First-ascent reconstruction: see this file's header for the rule. Returns
// one { level, group, pa, outs } per level the player passed through before
// his MLB debut.
function reconstruct(debutDate, group, milbRows) {
  const debutYear = Number(debutDate.slice(0, 4))
  const bySegment = new Map()
  for (const row of milbRows) {
    if (row.season > debutYear) continue
    const key = `${row.season}:${row.sportId}`
    const v = statValue(group, row.stat)
    const cur = bySegment.get(key)
    if (cur) {
      cur.pa += v.pa
      cur.outs += v.outs
    } else {
      bySegment.set(key, { season: row.season, sportId: row.sportId, pa: v.pa, outs: v.outs })
    }
  }
  const segments = [...bySegment.values()].sort((a, b) =>
    a.season !== b.season ? a.season - b.season : LEVEL_RANK[a.sportId] - LEVEL_RANK[b.sportId],
  )
  const results = []
  let currentRank = 0
  let acc = null
  for (const seg of segments) {
    const rank = LEVEL_RANK[seg.sportId]
    if (rank < currentRank) continue // a return trip after already advancing past it — drop
    if (rank === currentRank) {
      acc.pa += seg.pa
      acc.outs += seg.outs
      continue
    }
    if (acc) results.push(acc)
    acc = { level: LEVEL_NAME[seg.sportId], group, pa: seg.pa, outs: seg.outs }
    currentRank = rank
  }
  if (acc) results.push(acc)
  return results
}

// --- percentile summary ------------------------------------------------------
function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}
function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return null
  return {
    n: sorted.length,
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
  }
}
function round(v) {
  return v == null ? null : Math.round(v)
}

async function main() {
  const cohort = await loadCohort()
  console.log(`cohort: ${cohort.length} players (debut ${debutYearMin}-${debutYearMax}, real graduation)`)
  if (!cohort.length) throw new Error('empty cohort — check the debut window against rookies.json coverage')

  const groups = await fetchGroups(cohort.map((p) => p.id))

  const segments = [] // flat list across the whole cohort
  let done = 0
  await mapConcurrent(cohort, CONCURRENCY, async (p) => {
    const group = groups.get(p.id)
    if (group) {
      const milb = await fetchYearByYear(p.id, group)
      segments.push(...reconstruct(p.debutDate, group, milb))
    }
    done++
    if (done % 100 === 0) console.log(`  ${done}/${cohort.length}`)
  })

  const levels = {}
  for (const level of ['A', 'High-A', 'AA', 'AAA']) {
    const hitPa = segments.filter((s) => s.level === level && s.group === 'hitting').map((s) => s.pa)
    const pitOuts = segments.filter((s) => s.level === level && s.group === 'pitching').map((s) => s.outs)
    const hit = summarize(hitPa)
    const pit = summarize(pitOuts)
    levels[level] = {
      hitting: hit && { unit: 'pa', n: hit.n, p10: round(hit.p10), p25: round(hit.p25), median: round(hit.median), p75: round(hit.p75), p90: round(hit.p90) },
      pitching: pit && { unit: 'outs', n: pit.n, p10: round(pit.p10), p25: round(pit.p25), median: round(pit.median), p75: round(pit.p75), p90: round(pit.p90) },
    }
  }

  const file = {
    _hint:
      'GENERATED by scripts/gen-level-tenure-benchmark.mjs — hand-run, not on the nightly cron. ' +
      'Read docs/level-tenure-benchmark.md before changing the cohort window or the reconstruction ' +
      'rule; src/api/levelTenure.js is the reader.',
    generatedAt: new Date().toISOString(),
    cohort: { debutYearMin, debutYearMax, playerCount: cohort.length },
    levels,
  }
  await writeJsonAtomic(out, file, 2)
  console.log(`wrote ${out}: ${Object.values(levels).reduce((sum, l) => sum + (l.hitting?.n ?? 0) + (l.pitching?.n ?? 0), 0)} level-stints across ${cohort.length} players`)
}

main().catch((err) => {
  console.error('gen-level-tenure-benchmark failed:', err)
  process.exit(1)
})
