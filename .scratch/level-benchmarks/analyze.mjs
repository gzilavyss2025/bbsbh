// Research spike: reconstruct level-by-level MiLB progression from raw.json
// and report PA/IP-at-level-before-promotion distributions, by level and by
// draft pedigree tier.
//
// Reconstruction rule (documented, not hidden): sort each player's pre-debut
// MiLB season/level rows chronologically (season ascending; same-season
// multi-level rows ordered by ascending level rank — AAA=4 > AA=3 > High-A=2
// > A=1 — since a same-season promotion is overwhelmingly the common case and
// this is validated against the transaction wire below). Walk the sequence
// accumulating PA/outs per level; a level closes out (becomes one data point)
// the moment a HIGHER-ranked level is reached. A level row appearing again
// AFTER the player has already advanced past it (a rehab/option return) is
// dropped — first ascent only. The final level closes out on debut ("promoted
// to MLB").
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ipToOuts } from '../../src/api/rehab-policy.js'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))

const LEVEL_RANK = { 14: 1, 13: 2, 12: 3, 11: 4 }
const LEVEL_NAME = { 14: 'A', 13: 'High-A', 12: 'AA', 11: 'AAA' }

function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

function statValue(group, stat) {
  if (group === 'pitching') {
    return { pa: null, outs: ipToOuts(stat.inningsPitched), bf: num(stat.battersFaced), ip: stat.inningsPitched }
  }
  return { pa: num(stat.plateAppearances) || num(stat.atBats) + num(stat.baseOnBalls) + num(stat.hitByPitch) + num(stat.sacFlies) + num(stat.sacBunts), outs: null, bf: null, ip: null }
}

// One player's first-ascent level segments: [{ level, pa, outs, bf, seasons: [min,max] }]
function reconstruct(player) {
  const debutYear = Number(player.debutDate.slice(0, 4))
  const bySegment = new Map() // `${season}:${sportId}` -> merged stat
  for (const row of player.milb) {
    if (row.season > debutYear) continue // clearly post-debut (option/rehab), never pre-debut signal
    const key = `${row.season}:${row.sportId}`
    const v = statValue(player.group, row.stat)
    const cur = bySegment.get(key)
    if (cur) {
      cur.pa += v.pa || 0
      cur.outs += v.outs || 0
      cur.bf += v.bf || 0
    } else {
      bySegment.set(key, { season: row.season, sportId: row.sportId, pa: v.pa || 0, outs: v.outs || 0, bf: v.bf || 0 })
    }
  }
  const segments = [...bySegment.values()].sort((a, b) => {
    if (a.season !== b.season) return a.season - b.season
    return LEVEL_RANK[a.sportId] - LEVEL_RANK[b.sportId]
  })

  const results = []
  let currentRank = 0
  let currentSportId = null
  let acc = null
  for (const seg of segments) {
    const rank = LEVEL_RANK[seg.sportId]
    if (rank < currentRank) continue // return trip after already advancing past it — drop
    if (rank === currentRank) {
      acc.pa += seg.pa
      acc.outs += seg.outs
      acc.bf += seg.bf
      acc.lastSeason = seg.season
      continue
    }
    // genuine advance (or the very first level)
    if (acc) results.push(acc)
    acc = { sportId: seg.sportId, level: LEVEL_NAME[seg.sportId], pa: seg.pa, outs: seg.outs, bf: seg.bf, firstSeason: seg.season, lastSeason: seg.season }
    currentRank = rank
    currentSportId = seg.sportId
  }
  if (acc) results.push(acc)
  return results
}

// --- pedigree tiering ---------------------------------------------------
function draftTier(ped) {
  if (!ped?.draftRound) return "No draft record (int'l/other)"
  const r = String(ped.draftRound)
  // Competitive-balance/supplemental codes: A-round sits between rounds 1-2
  // (top-of-draft money), B-round between 2-3 — bucketed with their nearest
  // real round rather than given their own thin tier.
  if (r === '1' || r === '1C' || r === 'CB-A' || r === 'C-A') return 'Round 1'
  if (r === '2C' || r === 'CB-B') return 'Rounds 2-5'
  const n = Number(r)
  if (!Number.isFinite(n)) return 'Round 1'
  if (n >= 2 && n <= 5) return 'Rounds 2-5'
  if (n >= 6 && n <= 10) return 'Rounds 6-10'
  return 'Round 11+'
}

function schoolType(ped) {
  if (!ped?.draftSchool) return ped?.draftRound ? 'Unknown' : 'International/no draft'
  return /\bHS\b/i.test(ped.draftSchool) ? 'Prep (HS)' : 'College'
}

// --- stats ---------------------------------------------------------------
function percentile(sorted, p) {
  if (!sorted.length) return null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    n: sorted.length,
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
  }
}

// --- main ------------------------------------------------------------------
const playersArr = Object.entries(raw.players).map(([id, p]) => ({ id: Number(id), ...p }))
const usable = playersArr.filter((p) => p.group === 'hitting' || p.group === 'pitching')
console.log(`players: ${playersArr.length} total, ${usable.length} usable (excludes two-way/no-position)`)

const allSegments = [] // one row per (player, level)
for (const p of usable) {
  const segs = reconstruct(p)
  for (const s of segs) {
    allSegments.push({ playerId: p.id, name: p.ped?.name, group: p.group, draftTier: draftTier(p.ped), schoolType: schoolType(p.ped), ...s })
  }
}
console.log(`level-stints reconstructed: ${allSegments.length}`)

// Validate the same-season ordering heuristic against the transaction wire,
// on every player who actually had 2+ distinct levels IN ONE SEASON (the only
// case where the heuristic does any work) — not a sample, the whole set,
// since the transaction dumps are cheap once fetched per season.
async function validateOrdering() {
  const ambiguous = [] // players with 2+ distinct levels within one PRE-DEBUT season
  for (const p of usable) {
    const debutYear = Number(p.debutDate.slice(0, 4))
    const teamToSport = new Map(p.milb.map((r) => [r.teamId, r.sportId]))
    const bySeason = new Map()
    for (const row of p.milb) {
      if (row.season > debutYear) continue // post-debut shuttling never feeds the reconstruction — irrelevant noise
      if (!bySeason.has(row.season)) bySeason.set(row.season, new Set())
      bySeason.get(row.season).add(row.sportId)
    }
    for (const [season, sportIds] of bySeason) {
      if (sportIds.size > 1) ambiguous.push({ playerId: p.id, name: p.ped?.name, season, sportIds: [...sportIds], teamToSport })
    }
  }
  console.log(`same-season multi-level cases needing order validation: ${ambiguous.length}`)
  if (!ambiguous.length) return { checked: 0, agree: 0, unresolved: 0, disagree: [] }

  const seasons = [...new Set(ambiguous.map((a) => a.season))].sort()
  const dumpsBySeason = new Map()
  const cachePath = join(here, 'txn-cache.json')
  let cache = {}
  try {
    cache = JSON.parse(await readFile(cachePath, 'utf8'))
  } catch {
    /* first run */
  }
  for (const season of seasons) {
    if (cache[season]) {
      dumpsBySeason.set(season, cache[season])
      continue
    }
    console.log(`  fetching ${season} full-season transaction dump for validation...`)
    const data = await getJson(`/api/v1/transactions?startDate=${season}-01-01&endDate=${season}-12-31`)
    const slim = (data.transactions ?? []).map((t) => ({
      person: t.person ? { id: t.person.id } : null,
      toTeam: t.toTeam ? { id: t.toTeam.id } : null,
      typeCode: t.typeCode,
      date: t.date,
      effectiveDate: t.effectiveDate,
    }))
    dumpsBySeason.set(season, slim)
    cache[season] = slim
  }
  await writeFile(cachePath, JSON.stringify(cache))

  let agree = 0
  let unresolved = 0
  const disagree = []
  for (const a of ambiguous) {
    const txns = dumpsBySeason.get(a.season).filter((t) => t.person?.id === a.playerId)
    const asg = txns
      .filter((t) => t.typeCode === 'ASG' && a.teamToSport.has(t.toTeam?.id))
      .map((t) => ({ date: t.effectiveDate || t.date, sportId: a.teamToSport.get(t.toTeam.id) }))
      .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
    // dedup consecutive same-level rows (re-assignment to the same club logs a
    // fresh ASG row without a real level change)
    const seq = []
    for (const row of asg) if (seq[seq.length - 1] !== row.sportId) seq.push(row.sportId)
    if (seq.length < 2) {
      unresolved++
      continue
    }
    const ranks = seq.map((sid) => LEVEL_RANK[sid])
    const nonDecreasing = ranks.every((r, i) => i === 0 || r >= ranks[i - 1])
    if (nonDecreasing) agree++
    else disagree.push({ ...a, teamToSport: undefined, txnSportIdOrder: seq })
  }
  return { checked: ambiguous.length, agree, unresolved, disagree }
}

const validation = await validateOrdering()

// --- report ------------------------------------------------------------------
const byLevel = new Map()
for (const s of allSegments) {
  const key = s.level
  if (!byLevel.has(key)) byLevel.set(key, { hitting: [], pitching: [] })
  const bucket = byLevel.get(key)[s.group]
  bucket.push(s)
}

const report = { levels: {}, pedigree: {}, generatedAt: new Date().toISOString(), cohortSize: usable.length }
for (const level of ['A', 'High-A', 'AA', 'AAA']) {
  const b = byLevel.get(level) || { hitting: [], pitching: [] }
  report.levels[level] = {
    hittingPA: summarize(b.hitting.map((s) => s.pa)),
    pitchingIP: summarize(b.pitching.map((s) => s.outs / 3)),
    pitchingBF: summarize(b.pitching.map((s) => s.bf)),
  }
}

// pedigree cut: hitting PA and pitching outs by (level, draftTier)
const tiers = [...new Set(allSegments.map((s) => s.draftTier))]
for (const level of ['A', 'High-A', 'AA', 'AAA']) {
  report.pedigree[level] = {}
  for (const tier of tiers) {
    const hitPA = allSegments.filter((s) => s.level === level && s.group === 'hitting' && s.draftTier === tier).map((s) => s.pa)
    const pitOuts = allSegments.filter((s) => s.level === level && s.group === 'pitching' && s.draftTier === tier).map((s) => s.outs / 3)
    report.pedigree[level][tier] = { hittingPA: summarize(hitPA), pitchingIP: summarize(pitOuts) }
  }
}

// school-type cut (Prep/HS vs College), Round-1-and-2-5 only where the sample
// is thick enough to mean anything
report.schoolType = {}
for (const level of ['A', 'High-A', 'AA', 'AAA']) {
  report.schoolType[level] = {}
  for (const type of ['Prep (HS)', 'College']) {
    const hitPA = allSegments.filter((s) => s.level === level && s.group === 'hitting' && s.schoolType === type).map((s) => s.pa)
    const pitOuts = allSegments.filter((s) => s.level === level && s.group === 'pitching' && s.schoolType === type).map((s) => s.outs / 3)
    report.schoolType[level][type] = { hittingPA: summarize(hitPA), pitchingIP: summarize(pitOuts) }
  }
}

report.validation = validation

await writeFile(join(here, 'findings.json'), JSON.stringify(report, null, 2))

console.log('\n=== PA-at-level before promotion (hitters) ===')
for (const level of ['A', 'High-A', 'AA', 'AAA']) {
  const s = report.levels[level].hittingPA
  console.log(`${level}: n=${s.n}  p10=${s.p10?.toFixed(0)}  p25=${s.p25?.toFixed(0)}  median=${s.median?.toFixed(0)}  p75=${s.p75?.toFixed(0)}  p90=${s.p90?.toFixed(0)}`)
}
console.log('\n=== IP-at-level before promotion (pitchers) ===')
for (const level of ['A', 'High-A', 'AA', 'AAA']) {
  const s = report.levels[level].pitchingIP
  console.log(`${level}: n=${s.n}  p10=${s.p10?.toFixed(1)}  p25=${s.p25?.toFixed(1)}  median=${s.median?.toFixed(1)}  p75=${s.p75?.toFixed(1)}  p90=${s.p90?.toFixed(1)}`)
}
console.log(`\nvalidation: ${validation.checked} same-season multi-level cases; ${validation.disagree.length} have resolvable txn rows (see findings.json for raw samples)`)
console.log('\nwrote findings.json')
