// Diagnostic for the "who can fill affiliate gaps" question: which specific
// (teamId, season) pairs does our org resolution actually MISS, and how many
// cohort players does each one cost us? Turns "go research minor league
// history" into a small, prioritized worklist.
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
const SEASONS = Array.from({ length: 2023 - 2005 + 1 }, (_, i) => 2005 + i).filter((y) => y !== 2020)
const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }

async function buildHistoricalOrgMap() {
  const map = new Map()
  const jobs = []
  for (const sportId of SPORT_IDS) for (const season of SEASONS) jobs.push({ sportId, season })
  let cursor = 0
  async function worker() {
    while (cursor < jobs.length) {
      const { sportId, season } = jobs[cursor++]
      const data = await getJson(`/api/v1/teams?sportId=${sportId}&season=${season}`)
      for (const t of data.teams ?? []) {
        map.set(`${t.id}:${season}`, { orgId: t.parentOrgId ?? null, orgName: t.parentOrgName || '', teamName: t.name || '' })
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return map
}

console.log('sweeping historical team map (52 calls)...')
const orgMap = await buildHistoricalOrgMap()

const playersById = new Map(Object.entries(raw.players).map(([id, p]) => [Number(id), p]))
function bestRow(playerId, level, seasonGuess) {
  const p = playersById.get(playerId)
  if (!p) return null
  const sportId = LEVEL_SPORT[level]
  const rows = p.milb.filter((r) => r.sportId === sportId)
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) if (Math.abs(r.season - seasonGuess) < Math.abs(best.season - seasonGuess)) best = r
  return best
}

// gap key: `${teamId}:${season}` -> { teamName, playersCost: Set }
const gaps = new Map()
let totalDurations = 0, missingOrg = 0, teamNotInMap = 0

for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId)) continue
  totalDurations++
  const seasonGuess = Number((dates.allPromotionDates.find((pp) => pp.playerId === d.playerId)?.date || '2020').slice(0, 4))
  const row = bestRow(d.playerId, d.level, seasonGuess)
  if (!row) continue
  const key = `${row.teamId}:${row.season}`
  const entry = orgMap.get(key)
  if (!entry) {
    teamNotInMap++
    if (!gaps.has(key)) gaps.set(key, { teamName: row.teamName, season: row.season, level: d.level, players: new Set(), reason: 'team not in season sweep at all' })
    gaps.get(key).players.add(d.playerId)
    continue
  }
  if (!entry.orgId) {
    missingOrg++
    if (!gaps.has(key)) gaps.set(key, { teamName: entry.teamName || row.teamName, season: row.season, level: d.level, players: new Set(), reason: 'no parentOrgId on record' })
    gaps.get(key).players.add(d.playerId)
  }
}

const rows = [...gaps.entries()]
  .map(([key, g]) => ({ key, teamName: g.teamName, season: g.season, level: g.level, n: g.players.size, reason: g.reason }))
  .sort((a, b) => b.n - a.n)

console.log(`\ndurations checked: ${totalDurations}, missing org: ${missingOrg}, team not in sweep: ${teamNotInMap}`)
console.log(`distinct (team, season) gaps: ${rows.length}\n`)
console.log('=== top gaps by cohort players affected ===')
for (const r of rows.slice(0, 40)) {
  console.log(`${String(r.teamName).padEnd(30)} ${r.season}  ${r.level.padEnd(6)}  n=${r.n}  (${r.reason})  [teamId ${r.key.split(':')[0]}]`)
}

await writeFile(join(here, 'org-gaps.json'), JSON.stringify(rows, null, 2))
console.log('\nwrote org-gaps.json')
