// Quick check for adversarial review: how much does each org's row count in
// org-regression-v2 actually reflect distinct PLAYERS vs. one player
// contributing multiple durations (multiple levels)? OLS treats every row as
// an independent observation; if a handful of players account for a large
// share of an org's rows, the naive SEs understate the true uncertainty.
import { readFile } from 'node:fs/promises'
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
const orgMap = new Map()
const jobs = []
for (const sportId of SPORT_IDS) for (const season of SEASONS) jobs.push({ sportId, season })
let cursor = 0
async function worker() {
  while (cursor < jobs.length) {
    const { sportId, season } = jobs[cursor++]
    const data = await getJson(`/api/v1/teams?sportId=${sportId}&season=${season}`)
    for (const t of data.teams ?? []) {
      if (!t.parentOrgId) continue
      orgMap.set(`${t.id}:${season}`, { orgId: t.parentOrgId, orgName: t.parentOrgName || '' })
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker))

const playersById = new Map(Object.entries(raw.players).map(([id, p]) => [Number(id), p]))
const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }
function orgForDuration(playerId, level, season) {
  const p = playersById.get(playerId)
  if (!p) return null
  const sportId = LEVEL_SPORT[level]
  const rows = p.milb.filter((r) => r.sportId === sportId)
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) if (Math.abs(r.season - season) < Math.abs(best.season - season)) best = r
  return orgMap.get(`${best.teamId}:${best.season}`) || null
}

const orgRows = new Map() // orgId (numeric, stable across renames) -> { name, ids }
for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId)) continue
  if (d.days <= 0) continue
  const org = orgForDuration(d.playerId, d.level, d.season)
  if (!org) continue
  if (!orgRows.has(org.orgId)) orgRows.set(org.orgId, { name: org.orgName, ids: [] })
  orgRows.get(org.orgId).ids.push(d.playerId)
}

console.log('org: total rows, distinct players, rows/player ratio')
const summary = [...orgRows.values()]
  .map(({ name, ids }) => ({ name, rows: ids.length, players: new Set(ids).size }))
  .sort((a, b) => b.rows / b.players - a.rows / a.players)
for (const s of summary) console.log(`${s.name.padEnd(26)} rows=${s.rows} players=${s.players} ratio=${(s.rows / s.players).toFixed(2)}`)
const totalRows = summary.reduce((s, x) => s + x.rows, 0)
const totalPlayers = summary.reduce((s, x) => s + x.players, 0)
console.log(`\noverall: ${totalRows} rows across ${totalPlayers} (org,player) pairs, ratio=${(totalRows / totalPlayers).toFixed(2)}`)
for (const n of ['Tampa Bay Rays', 'Washington Nationals']) {
  const s = summary.find((x) => x.name === n)
  console.log(`${n}: ${s.rows} rows from ${s.players} distinct players`)
}
