// Bonus cut: does level-skipping vary by organization? Approximate — uses the
// CURRENT (2026) affiliates.json map, restricted to cohort segments from 2021
// onward (post-reorg era, when affiliate identity has been stable), so a
// pre-2021 team assignment can't be mis-joined to today's parent. A level
// "skip" = no High-A or no AA segment between A and AAA in a player's
// reconstructed progression.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ipToOuts } from '../../src/api/rehab-policy.js'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const affiliates = JSON.parse(await readFile(join(here, '..', '..', 'public', 'data', 'affiliates.json'), 'utf8'))

const teamToOrg = new Map()
const orgName = new Map()
for (const [orgId, clubs] of Object.entries(affiliates.byOrgId)) {
  for (const c of clubs) teamToOrg.set(c.id, Number(orgId))
}
// org display names: pull from teams-static if present, else fall back to id
let teamsStatic = null
try {
  teamsStatic = JSON.parse(await readFile(join(here, '..', '..', 'public', 'data', 'teams.json'), 'utf8'))
} catch {}
if (teamsStatic) for (const t of teamsStatic.bySportId?.['1'] ?? []) if (t.id) orgName.set(t.id, t.name)

const LEVEL_RANK = { 14: 1, 13: 2, 12: 3, 11: 4 }
const LEVEL_NAME = { 14: 'A', 13: 'High-A', 12: 'AA', 11: 'AAA' }

function reconstructWithOrg(player) {
  const debutYear = Number(player.debutDate.slice(0, 4))
  const rows = player.milb.filter((r) => r.season <= debutYear && r.season >= 2021)
  if (!rows.length) return null
  const bySegment = new Map()
  for (const row of rows) {
    const key = `${row.season}:${row.sportId}`
    const cur = bySegment.get(key)
    if (cur) cur.teamIds.add(row.teamId)
    else bySegment.set(key, { season: row.season, sportId: row.sportId, teamIds: new Set([row.teamId]) })
  }
  const segments = [...bySegment.values()].sort((a, b) => a.season !== b.season ? a.season - b.season : LEVEL_RANK[a.sportId] - LEVEL_RANK[b.sportId])
  const levelsReached = []
  let currentRank = 0
  for (const seg of segments) {
    const rank = LEVEL_RANK[seg.sportId]
    if (rank < currentRank) continue
    if (rank === currentRank) continue
    levelsReached.push(seg.sportId)
    currentRank = rank
  }
  return levelsReached
}

const playersArr = Object.entries(raw.players).map(([id, p]) => ({ id: Number(id), ...p })).filter((p) => p.group === 'hitting' || p.group === 'pitching')

const byOrg = new Map() // orgId -> { total, skippedAA, skippedHighA }
for (const p of playersArr) {
  const levels = reconstructWithOrg(p)
  if (!levels || levels.length < 2) continue
  // resolve org from the LAST (highest) team he was with pre-debut, in 2021+
  const lastRow = [...p.milb].filter((r) => r.season <= Number(p.debutDate.slice(0, 4)) && r.season >= 2021).sort((a, b) => a.season - b.season || LEVEL_RANK[a.sportId] - LEVEL_RANK[b.sportId]).pop()
  if (!lastRow) continue
  const orgId = teamToOrg.get(lastRow.teamId)
  if (!orgId) continue
  const highest = levels[levels.length - 1]
  if (!levels.includes(12)) continue // only count players who reached AA at all
  if (!byOrg.has(orgId)) byOrg.set(orgId, { total: 0, debutedFromAA: 0 })
  const b = byOrg.get(orgId)
  b.total++
  // AA was the HIGHEST level reached before debut — the org never gave him a
  // Triple-A stint at all before the call-up
  if (highest === 12) b.debutedFromAA++
}

const rows = [...byOrg.entries()]
  .filter(([, b]) => b.total >= 6)
  .map(([orgId, b]) => ({ orgId, name: orgName.get(orgId) || orgId, total: b.total, pct: (b.debutedFromAA / b.total * 100).toFixed(0) }))
  .sort((a, b) => b.pct - a.pct)

console.log(`orgs with >=6 players who reached AA pre-debut (2021+ segments): ${rows.length}`)
for (const r of rows) console.log(`${String(r.name).padEnd(28)} n(reached AA)=${r.total}  debuted-straight-from-AA=${r.pct}%`)
