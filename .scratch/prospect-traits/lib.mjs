// Shared cohort builder for the prospect-traits spike. Five questions run off
// one player table, so the table is built once here rather than five slightly
// different ways in five scripts — the last pass through this research learned
// that lesson the expensive way.
//
// EVERY RULE HERE IS BORROWED, NOT INVENTED. The level reconstruction is
// analyze.mjs's `reconstruct()` verbatim; the draft tiering is its `draftTier`;
// the corrected draft round is homegrown-lib.mjs's `draftInfo()`, which exists
// because raw.json's own ped.draftRound reads drafts[0] and so records Aaron
// Judge as a 31st-round pick. Re-deriving any of them would risk a third
// slightly-different answer to a question already settled twice.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ipToOuts } from '../../src/api/rehab-policy.js'

export const here = dirname(fileURLToPath(import.meta.url))
export const bench = join(here, '..', 'level-benchmarks')
const repo = join(here, '..', '..')

export const LEVEL_RANK = { 14: 1, 13: 2, 12: 3, 11: 4 }
export const LEVEL_NAME = { 14: 'A', 13: 'High-A', 12: 'AA', 11: 'AAA' }
export const LEVELS = ['A', 'High-A', 'AA', 'AAA']
// The six-level ranking, for entry level and total-time questions that have to
// count the complex leagues raw.json cannot see.
export const RANK6 = { 16: 0, 15: 1, 14: 2, 13: 3, 12: 4, 11: 5 }
export const NAME6 = { 16: 'Rookie/Complex', 15: 'Short-A', 14: 'A', 13: 'High-A', 12: 'AA', 11: 'AAA' }

const j = async (p) => JSON.parse(await readFile(p, 'utf8'))

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

function statValue(group, stat) {
  if (group === 'pitching') {
    return { pa: 0, outs: ipToOuts(stat.inningsPitched), bf: num(stat.battersFaced) }
  }
  const pa =
    num(stat.plateAppearances) ||
    num(stat.atBats) + num(stat.baseOnBalls) + num(stat.hitByPitch) + num(stat.sacFlies) + num(stat.sacBunts)
  return { pa, outs: 0, bf: 0 }
}

// analyze.mjs's reconstruct(), plus the per-level rate stats this spike needs
// (a level's OPS / K rate is a trait; the original only kept volume).
function reconstruct(player) {
  const debutYear = Number(player.debutDate.slice(0, 4))
  const bySegment = new Map()
  for (const row of player.milb) {
    if (row.season > debutYear) continue
    const key = `${row.season}:${row.sportId}`
    const v = statValue(player.group, row.stat)
    const cur = bySegment.get(key) ?? {
      season: row.season,
      sportId: row.sportId,
      pa: 0,
      outs: 0,
      bf: 0,
      raw: {},
    }
    cur.pa += v.pa
    cur.outs += v.outs
    cur.bf += v.bf
    for (const [k, val] of Object.entries(row.stat)) {
      if (typeof val === 'number') cur.raw[k] = (cur.raw[k] ?? 0) + val
    }
    bySegment.set(key, cur)
  }
  const segments = [...bySegment.values()].sort((a, b) =>
    a.season !== b.season ? a.season - b.season : LEVEL_RANK[a.sportId] - LEVEL_RANK[b.sportId],
  )
  const results = []
  let currentRank = 0
  let acc = null
  for (const seg of segments) {
    const rank = LEVEL_RANK[seg.sportId]
    if (rank < currentRank) continue
    if (rank === currentRank) {
      acc.pa += seg.pa
      acc.outs += seg.outs
      acc.bf += seg.bf
      acc.lastSeason = seg.season
      acc.seasonCount++
      for (const [k, v] of Object.entries(seg.raw)) acc.raw[k] = (acc.raw[k] ?? 0) + v
      continue
    }
    if (acc) results.push(acc)
    acc = {
      sportId: seg.sportId,
      level: LEVEL_NAME[seg.sportId],
      pa: seg.pa,
      outs: seg.outs,
      bf: seg.bf,
      firstSeason: seg.season,
      lastSeason: seg.season,
      seasonCount: 1,
      raw: { ...seg.raw },
    }
    currentRank = rank
  }
  if (acc) results.push(acc)
  return results
}

// analyze.mjs's tiering, on the CORRECTED round.
export function draftTier(round) {
  if (!round) return "No draft record (int'l/other)"
  const r = String(round)
  if (r === '1' || r === '1C' || r === 'CB-A' || r === 'C-A') return 'Round 1'
  if (r === '2C' || r === 'CB-B') return 'Rounds 2-5'
  const n = Number(r)
  if (!Number.isFinite(n)) return 'Round 1'
  if (n >= 2 && n <= 5) return 'Rounds 2-5'
  if (n >= 6 && n <= 10) return 'Rounds 6-10'
  return 'Round 11+'
}

// homegrown-lib.mjs's draftInfo(): prefer the drafts[] row whose year matches
// person.draftYear, NOT drafts[0] — an earlier unsigned draft otherwise wins.
function correctedRound(entry) {
  if (!entry) return null
  const drafts = entry.drafts ?? []
  if (!drafts.length) return null
  const signed = drafts.find((d) => String(d.year) === String(entry.draftYear)) ?? drafts[drafts.length - 1]
  return signed?.pickRound ?? null
}

function correctedSchool(entry) {
  if (!entry) return null
  const drafts = entry.drafts ?? []
  if (!drafts.length) return null
  const signed = drafts.find((d) => String(d.year) === String(entry.draftYear)) ?? drafts[drafts.length - 1]
  return signed?.school?.name ?? null
}

// "6' 2\"" -> 74. Returns null on anything that does not parse, rather than a
// plausible-looking zero.
export function parseHeight(s) {
  if (!s) return null
  const m = /^(\d+)'\s*(\d+)?/.exec(String(s).trim())
  if (!m) return null
  return Number(m[1]) * 12 + Number(m[2] ?? 0)
}

export function yearsBetween(fromISO, toISO) {
  if (!fromISO || !toISO) return null
  return (new Date(toISO) - new Date(fromISO)) / (365.2425 * 24 * 3600 * 1000)
}

export async function buildCohort() {
  const raw = await j(join(bench, 'raw.json'))
  const bio = await j(join(here, 'bio.json'))
  const draftCache = await j(join(bench, 'draft-cache.json'))
  const sixLevel = await j(join(bench, 'milb-cohort-cache.json'))
  const homegrown = await j(join(bench, 'homegrown-cohort.json'))
  const dates = await j(join(bench, 'dates.json'))

  // Wire-resolved durations, keyed by player. dates.json's allDurations is
  // already post-debut-filtered (the resolver fix in the hump entry).
  const durByPlayer = new Map()
  for (const d of dates.allDurations) {
    if (!durByPlayer.has(d.playerId)) durByPlayer.set(d.playerId, [])
    durByPlayer.get(d.playerId).push(d)
  }

  const players = []
  for (const [idStr, p] of Object.entries(raw.players)) {
    const id = Number(idStr)
    if (p.group !== 'hitting' && p.group !== 'pitching') continue
    const b = bio[id] ?? {}
    const dc = draftCache[id]
    const round = correctedRound(dc)
    // draft-cache.json carries no school name, so prep-vs-college falls back to
    // raw.json's ped.draftSchool — which reads drafts[0] and therefore names the
    // HIGH SCHOOL of anyone drafted out of high school and then again out of
    // college. `draftAge` below is the honest version of the same question and
    // is what the analysis leans on; schoolType is kept only for continuity
    // with analyze.mjs's published tiering.
    const school = correctedSchool(dc) ?? p.ped?.draftSchool ?? null
    const debutDate = p.debutDate
    const debutYear = Number(debutDate.slice(0, 4))

    // Six-level view: every MiLB team-season, including the complex leagues
    // raw.json never sweeps. This is where "first professional season" and
    // "years in the minors" come from — no transaction log anywhere near it.
    const six = (sixLevel[id] ?? []).filter((r) => r.season <= debutYear)
    const firstProSeason = six.length ? Math.min(...six.map((r) => r.season)) : null
    const proSeasons = new Set(six.map((r) => r.season))
    const entry = homegrown.resolved?.[id] ?? null

    const segs = reconstruct(p)
    const byLevel = {}
    for (const s of segs) byLevel[s.level] = s

    players.push({
      id,
      name: b.name ?? p.ped?.name ?? '',
      group: p.group,
      pos: b.pos ?? p.ped?.posAbbr ?? null,
      bats: b.bats ?? null,
      throws: b.throws ?? null,
      heightIn: parseHeight(b.height),
      weightLb: b.weight ?? null,
      birthDate: b.birthDate ?? p.ped?.birthDate ?? null,
      birthCountry: b.birthCountry ?? p.ped?.birthCountry ?? null,
      debutDate,
      debutYear,
      debutMonth: Number(debutDate.slice(5, 7)),
      rookieUntil: p.rookieUntil ?? null,
      rookieSeason: p.rookieUntil ? Number(p.rookieUntil.slice(0, 4)) : debutYear,
      draftYear: dc?.draftYear ?? null,
      draftRound: round,
      draftTier: draftTier(round),
      draftAge:
        dc?.draftYear && (b.birthDate ?? p.ped?.birthDate)
          ? Number(dc.draftYear) - Number(String(b.birthDate ?? p.ped?.birthDate).slice(0, 4))
          : null,
      schoolType: school ? (/\bHS\b/i.test(school) ? 'Prep (HS)' : 'College') : round ? 'Unknown' : 'International/no draft',
      entryOrgId: entry?.orgId ?? null,
      entryLevel: entry ? NAME6[entry.sportId] ?? null : null,
      entrySportId: entry?.sportId ?? null,
      firstProSeason,
      proSeasonCount: proSeasons.size,
      // Wire-free time-in-the-minors: calendar years from first professional
      // season to debut season. Immune to every transaction-log trap in the
      // standing notes, at the cost of being granular only to the season.
      seasonsToDebut: firstProSeason == null ? null : debutYear - firstProSeason,
      ageAtDebut: yearsBetween(b.birthDate ?? p.ped?.birthDate, debutDate),
      segs,
      byLevel,
      durations: durByPlayer.get(id) ?? [],
      milb: p.milb,
    })
  }
  return players
}

// --- summary helpers ---------------------------------------------------------
export function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export function summarize(values) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b)
  const n = sorted.length
  const mean = n ? sorted.reduce((a, b) => a + b, 0) / n : null
  const sd = n > 1 ? Math.sqrt(sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null
  return {
    n,
    mean,
    sd,
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
  }
}

export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)

export function fmt(x, d = 2) {
  return x == null || !Number.isFinite(x) ? '—' : x.toFixed(d)
}

export async function repoJson(rel) {
  return j(join(repo, rel))
}
