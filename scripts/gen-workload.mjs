// Regenerates public/data/workload.json — the Pitcher Workload feature's data
// layer. For every pitcher on all 30 MLB active rosters: his last 12 appearances
// (date + pitch count + start flag), season totals, and a role classification
// (SP/RP); plus league baselines (mean/SD of rolling pitch loads by role) and a
// winning- vs. losing-record team cohort split. The app reads it via
// src/api/workload.js (workloadFor / availabilityFor / workloadVsBaseline).
//
// This is a nightly FULL REBUILD (no SQLite — everything re-derives from the
// gameLog splits, which are cheap: one stats call per pitcher). Runs on the
// cron in .github/workflows/update-nightly-data.yml, NOT at request time.
//
// Spoiler class: spoiler-FREE. Every value is backward-looking over COMPLETED
// appearances (pitch counts, dates, season totals) — same footing as WAR /
// milestones. No score-revealing number is produced, so callers need no SealBox.
//
// MLB only (sportId=1). MiLB pitchers are simply absent from the file, so the
// reader returns null and callers hide the surface (graceful-degradation
// convention). The W1+W5 engines from .scratch/metric-engines/pitch-workload.md
// (raw rolling buckets + ESPN-threshold availability board) drive the shape;
// baselines also serve pitching-health.md's P3 own-baseline engine.
//
// Run by hand: node scripts/gen-workload.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'workload.json')
const BASE = 'https://statsapi.mlb.com'
const SEASON = 2026

// Number of most-recent appearances stored per pitcher (feeds the 1/3/10 buckets
// in the reader with headroom, and the availability board's day-window scans).
const APPS_KEPT = 12

// Qualifying floors for a pitcher to count toward the league baselines.
const RP_MIN_APPS = 8
const SP_MIN_STARTS = 5

const todayIso = () => new Date().toISOString().slice(0, 10)

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)

// Innings pitched ("104.1" = 104 ⅓) -> outs, so season IP sums correctly.
const ipToOuts = (ip) => {
  const [whole, frac = '0'] = String(ip ?? '0').split('.')
  return num(whole) * 3 + num(frac[0])
}

async function getJson(path) {
  // Retry once on any failure (network blip / transient statsapi 5xx).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(BASE + path)
      if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
      return await res.json()
    } catch (err) {
      if (attempt === 1) throw err
    }
  }
}

// Run an async mapper across items with a small concurrency cap, results in
// order (be polite to statsapi). Mirrors gen-vs-team-splits.mjs's helper.
async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await mapper(items[i], i)
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// --- mean / standard deviation (population) ----------------------------------
function meanSd(values) {
  const n = values.length
  if (!n) return { mean: null, sd: null, n: 0 }
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  return { mean: round1(mean), sd: round1(Math.sqrt(variance)), n }
}
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10)

// Whole-day index for a 'YYYY-MM-DD' date (UTC midnight / 86400s).
const dayIndex = (s) => Math.floor(Date.parse(s + 'T00:00:00Z') / 86400000)

// --- MLB team catalog + standings-derived record cohort ----------------------
async function fetchMlbTeams() {
  const data = await getJson('/api/v1/teams?sportId=1&activeStatus=Y')
  return (data.teams ?? [])
    .filter((t) => t.active && t.id)
    .map((t) => ({ id: t.id, name: t.name ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// teamId -> 'winning' | 'losing' (W >= L is 'winning', per spec). One standings
// call for both leagues. On failure every team falls through as unknown (null).
async function fetchTeamRecords() {
  const map = new Map()
  let data
  try {
    data = await getJson(`/api/v1/standings?leagueId=103,104&season=${SEASON}`)
  } catch {
    return map
  }
  for (const rec of data.records ?? []) {
    for (const t of rec.teamRecords ?? []) {
      const id = t.team?.id
      if (!id) continue
      map.set(id, num(t.wins) >= num(t.losses) ? 'winning' : 'losing')
    }
  }
  return map
}

// A club's ACTIVE roster, pitchers only (position code '1'; two-way players ride
// along on the TWP abbreviation — cheap and complete).
async function fetchActivePitchers(teamId) {
  const data = await getJson(`/api/v1/teams/${teamId}/roster/Active`)
  return (data.roster ?? [])
    .filter((r) => r.person?.id)
    .filter((r) => r.position?.code === '1' || r.position?.abbreviation === 'TWP')
    .map((r) => ({ id: r.person.id, name: r.person.fullName ?? '' }))
}

// --- per-pitcher gameLog -> apps + season totals + role ----------------------
async function buildPitcher(personId) {
  const data = await getJson(
    `/api/v1/people/${personId}/stats?stats=gameLog&group=pitching&season=${SEASON}`,
  )
  // Splits arrive oldest-first; regular season only (gameType 'R').
  const splits = (data.stats?.[0]?.splits ?? []).filter((s) => s.gameType === 'R' && s.date)

  const season = { g: 0, gs: 0, pitches: 0, outs: 0, bf: 0, strikes: 0 }
  const allApps = []
  for (const s of splits) {
    const st = s.stat ?? {}
    const gs = num(st.gamesStarted)
    season.g += num(st.gamesPlayed) || 1
    season.gs += gs
    season.pitches += num(st.numberOfPitches)
    season.outs += ipToOuts(st.inningsPitched)
    season.bf += num(st.battersFaced)
    season.strikes += num(st.strikes)
    const app = { d: s.date, p: num(st.numberOfPitches) }
    if (gs) app.gs = 1
    allApps.push(app)
  }

  // Most-recent-first, last APPS_KEPT.
  const apps = allApps.slice(-APPS_KEPT).reverse()

  // Role: SP if starts/appearances >= 0.5 with >= 3 appearances; below that
  // sample, infer from whether he's been starting at all.
  let role
  if (season.g >= 3) {
    role = season.gs / season.g >= 0.5 ? 'SP' : 'RP'
  } else if (season.g > 0) {
    role = season.gs >= 1 && season.gs / season.g >= 0.5 ? 'SP' : 'RP'
  } else {
    role = 'RP' // no appearances yet — bullpen is the safe default
  }

  return { apps, season, role }
}

// --- baseline aggregation ----------------------------------------------------
// For a set of pitcher records, the mean/SD of: (a) pitches over last 10 apps,
// (b) pitches over last 3 apps, (c) appearances in the last 7 days (relative to
// asOf). Only pitchers meeting the role floor contribute.
function computeBaselines(pitchers, asOf) {
  const asOfIdx = dayIndex(asOf)
  const acc = {
    SP: { last10: [], last3: [], app7: [] },
    RP: { last10: [], last3: [], app7: [] },
  }
  for (const p of pitchers) {
    const qualifies =
      p.role === 'SP' ? p.season.gs >= SP_MIN_STARTS : p.season.g >= RP_MIN_APPS
    if (!qualifies) continue
    const apps = p.apps // already most-recent-first
    const sum = (n) => apps.slice(0, n).reduce((a, x) => a + x.p, 0)
    const app7 = apps.filter((x) => {
      const i = dayIndex(x.d)
      return i >= asOfIdx - 7 && i < asOfIdx
    }).length
    acc[p.role].last10.push(sum(10))
    acc[p.role].last3.push(sum(3))
    acc[p.role].app7.push(app7)
  }
  const shape = (b) => ({ last10: meanSd(b.last10), last3: meanSd(b.last3), app7: meanSd(b.app7) })
  return { SP: shape(acc.SP), RP: shape(acc.RP) }
}

// --- main --------------------------------------------------------------------
const asOf = todayIso()
const teams = await fetchMlbTeams()
const records = await fetchTeamRecords()
const teamIds = teams.map((t) => t.id)

// Pitchers per team (concurrency across the 30 roster calls).
const rosters = await mapConcurrent(teamIds, 6, (id) =>
  fetchActivePitchers(id).then((roster) => ({ teamId: id, roster })),
)
const meta = new Map() // personId -> { teamId, name }
for (const r of rosters) {
  if (!r) continue
  for (const p of r.roster) {
    if (!meta.has(p.id)) meta.set(p.id, { teamId: r.teamId, name: p.name })
  }
}

const ids = [...meta.keys()]
const built = await mapConcurrent(ids, 6, (id) => buildPitcher(id))

const pitchers = {}
const records_list = [] // parallel to build order, for baseline computation
ids.forEach((id, i) => {
  const b = built[i]
  if (!b) return // pitcher whose log failed — skip and continue (degrade)
  const m = meta.get(id)
  const rec = { name: m.name, teamId: m.teamId, role: b.role, apps: b.apps, season: b.season }
  pitchers[id] = rec
  records_list.push(rec)
})

// League baselines across all qualifying pitchers.
const baselines = computeBaselines(records_list, asOf)

// Cohorts: the same role means/SDs, split by team record.
const winners = records_list.filter((p) => records.get(p.teamId) === 'winning')
const losers = records_list.filter((p) => records.get(p.teamId) === 'losing')
const cohorts = {
  winning: computeBaselines(winners, asOf),
  losing: computeBaselines(losers, asOf),
}

await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ season: SEASON, asOf, pitchers, baselines, cohorts }),
)

const sizeKb = (JSON.stringify({ season: SEASON, asOf, pitchers, baselines, cohorts }).length / 1024).toFixed(1)
console.log(
  `wrote ${out} (${Object.keys(pitchers).length} pitchers across ${teams.length} teams, ${sizeKb}KB)`,
)
console.log(
  `baselines RP last10 mean=${baselines.RP.last10.mean} sd=${baselines.RP.last10.sd} (n=${baselines.RP.last10.n}); SP last10 mean=${baselines.SP.last10.mean} sd=${baselines.SP.last10.sd} (n=${baselines.SP.last10.n})`,
)
