// Follow-up to org-and-timing.mjs: that script printed AA/AAA median days-at-level
// by org but threw away A/High-A and never computed a spread — only a point
// estimate. This script reuses its historical team->org sweep (real
// season-by-season parentOrgId, not the current-affiliate approximation) and
// produces a per-org, per-level MOVEMENT WINDOW (p25/median/p75, not just a
// median) across all four levels, which is what a per-team "estimated
// movement range" engine actually needs.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const dates = JSON.parse(await readFile(join(here, 'dates.json'), 'utf8'))
const findings = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
const disputedIds = new Set(findings.validation.disagree.map((d) => d.playerId))

const SPORT_IDS = [11, 12, 13, 14]
// 2005 floor: statsapi's own affiliate data is documented unreliable before
// then (docs/api/static-data.md) — matches pull.mjs's widened DEBUT_YEAR_MIN.
const SEASONS = Array.from({ length: 2023 - 2005 + 1 }, (_, i) => 2005 + i).filter((y) => y !== 2020)

async function buildHistoricalOrgMap() {
  const map = new Map() // `${teamId}:${season}` -> {orgId, orgName}
  const jobs = []
  for (const sportId of SPORT_IDS) for (const season of SEASONS) jobs.push({ sportId, season })
  let cursor = 0
  async function worker() {
    while (cursor < jobs.length) {
      const { sportId, season } = jobs[cursor++]
      const data = await getJson(`/api/v1/teams?sportId=${sportId}&season=${season}`)
      for (const t of data.teams ?? []) {
        if (!t.parentOrgId) continue
        map.set(`${t.id}:${season}`, { orgId: t.parentOrgId, orgName: t.parentOrgName || '' })
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return map
}

console.log('sweeping historical team->org map (52 calls)...')
const orgMap = await buildHistoricalOrgMap()
console.log(`org map: ${orgMap.size} (team,season) entries`)

const playersById = new Map(Object.entries(raw.players).map(([id, p]) => [Number(id), p]))
const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }

function orgForDuration(playerId, level, seasonGuess) {
  const p = playersById.get(playerId)
  if (!p) return null
  const sportId = LEVEL_SPORT[level]
  const rows = p.milb.filter((r) => r.sportId === sportId)
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) if (Math.abs(r.season - seasonGuess) < Math.abs(best.season - seasonGuess)) best = r
  return orgMap.get(`${best.teamId}:${best.season}`) || null
}

const byOrgLevel = new Map() // `${orgId}:${level}` -> { name, days: [] }
for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId)) continue
  const seasonGuess = Number((dates.allPromotionDates.find((pp) => pp.playerId === d.playerId)?.date || '2020').slice(0, 4))
  const org = orgForDuration(d.playerId, d.level, seasonGuess)
  if (!org) continue
  const key = `${org.orgId}:${d.level}`
  if (!byOrgLevel.has(key)) byOrgLevel.set(key, { name: org.orgName, days: [] })
  byOrgLevel.get(key).days.push(d.days)
}

function percentile(sorted, p) {
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}
function window(days) {
  const s = [...days].sort((a, b) => a - b)
  return { n: s.length, p25: Math.round(percentile(s, 0.25)), median: Math.round(percentile(s, 0.5)), p75: Math.round(percentile(s, 0.75)) }
}

const MIN_N = 8
const LEVELS = ['A', 'High-A', 'AA', 'AAA']
const report = {}
for (const level of LEVELS) {
  const rows = [...byOrgLevel.entries()]
    .filter(([k, v]) => k.endsWith(`:${level}`) && v.days.length >= MIN_N)
    .map(([, v]) => ({ name: v.name, ...window(v.days) }))
    .sort((a, b) => a.median - b.median)
  report[level] = rows
  console.log(`\n=== ${level}: days-at-level by org, p25/median/p75 (n>=${MIN_N}) ===`)
  for (const r of rows) console.log(`${r.name.padEnd(26)} n=${r.n}  ${r.p25}-${r.p75}d (median ${r.median})`)
  const covered = rows.length
  console.log(`orgs meeting n>=${MIN_N} at ${level}: ${covered}/30`)
}

// spread check: how much does an org's own window overlap the global window at
// that level? If windows mostly overlap, org identity adds little beyond the
// v1 global number.
console.log('\n=== overlap check: org p25-p75 vs global p25-p75, by level ===')
for (const level of LEVELS) {
  const allDays = dates.allDurations.filter((d) => d.level === level && !disputedIds.has(d.playerId)).map((d) => d.days)
  const g = window(allDays)
  const rows = report[level]
  const nonOverlapping = rows.filter((r) => r.p75 < g.p25 || r.p25 > g.p75).length
  console.log(`${level.padEnd(7)} global ${g.p25}-${g.p75}d (n=${g.n})  |  ${nonOverlapping}/${rows.length} orgs fully outside the global window`)
}

await writeFile(join(here, 'team-windows.json'), JSON.stringify({ minN: MIN_N, byLevel: report }, null, 2))
console.log('\nwrote team-windows.json')
