// Two follow-up cuts on dates.json's resolved transition dates:
//   A. team duration patterns — using REAL historical team->org mapping
//      (sweep /api/v1/teams?sportId&season, same technique gen-milb-history.mjs
//      uses) instead of the earlier spike's current-season-only approximation.
//   B. seasonal timing of promotions — does the calendar date of a promotion
//      cluster around a milestone (season open, All-Star break, trade
//      deadline, season close)? Split by draft pedigree to test the "top
//      prospects get bumped after the break" folk wisdom.
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
const SEASONS = Array.from({ length: 2023 - 2010 + 1 }, (_, i) => 2010 + i).filter((y) => y !== 2020)

// --- A. historical team -> org map, per season ------------------------------
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

// need player's own team ids per season to resolve org — rebuild a lookup
const playersById = new Map(Object.entries(raw.players).map(([id, p]) => [Number(id), p]))

function orgForDuration(playerId, level, seasonGuess) {
  const p = playersById.get(playerId)
  if (!p) return null
  // find a milb row at this level closest to seasonGuess
  const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }
  const sportId = LEVEL_SPORT[level]
  const rows = p.milb.filter((r) => r.sportId === sportId)
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) if (Math.abs(r.season - seasonGuess) < Math.abs(best.season - seasonGuess)) best = r
  return orgMap.get(`${best.teamId}:${best.season}`) || null
}

// --- team duration cut -------------------------------------------------------
const byOrgLevel = new Map() // `${orgId}:${level}` -> [days]
for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId)) continue
  const seasonGuess = Number((dates.allPromotionDates.find((pp) => pp.playerId === d.playerId)?.date || '2020').slice(0, 4))
  const org = orgForDuration(d.playerId, d.level, seasonGuess)
  if (!org) continue
  const key = `${org.orgId}:${d.level}`
  if (!byOrgLevel.has(key)) byOrgLevel.set(key, { name: org.orgName, days: [] })
  byOrgLevel.get(key).days.push(d.days)
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

console.log('\n=== AA median days-at-level by org (n>=8) ===')
const aaRows = [...byOrgLevel.entries()]
  .filter(([k, v]) => k.endsWith(':AA') && v.days.length >= 8)
  .map(([k, v]) => ({ name: v.name, n: v.days.length, median: median(v.days) }))
  .sort((a, b) => a.median - b.median)
for (const r of aaRows) console.log(`${r.name.padEnd(26)} n=${r.n}  median=${r.median}d`)

console.log('\n=== AAA median days-at-level by org (n>=8) ===')
const aaaRows = [...byOrgLevel.entries()]
  .filter(([k, v]) => k.endsWith(':AAA') && v.days.length >= 8)
  .map(([k, v]) => ({ name: v.name, n: v.days.length, median: median(v.days) }))
  .sort((a, b) => a.median - b.median)
for (const r of aaaRows) console.log(`${r.name.padEnd(26)} n=${r.n}  median=${r.median}d`)

// --- B. seasonal timing of promotions ---------------------------------------
// All-Star break lands roughly July 10-16 each year (day-of-year ~191-197).
function dayOfYear(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.floor((d - start) / 86400000) + 1
}
const promos = dates.allPromotionDates.filter((p) => p.toLevel !== 'MLB' && !disputedIds.has(p.playerId))
const buckets = { 'Mar-Apr (season open)': 0, 'May-Jun': 0, 'Jul 1-9': 0, 'Jul 10-16 (ASB window)': 0, 'Jul 17-Aug': 0, 'Sep+ (season close/taxi)': 0 }
for (const p of promos) {
  const doy = dayOfYear(p.date)
  if (doy < 90) buckets['Sep+ (season close/taxi)']++
  else if (doy < 152) buckets['Mar-Apr (season open)']++
  else if (doy < 190) buckets['May-Jun']++
  else if (doy < 198) buckets['Jul 10-16 (ASB window)']++
  else if (doy < 213) buckets['Jul 17-Aug']++
  else if (doy < 244) buckets['Jul 17-Aug']++
  else buckets['Sep+ (season close/taxi)']++
}
console.log('\n=== promotion timing, all MiLB-to-MiLB/MLB transitions (n=' + promos.length + ') ===')
for (const [k, v] of Object.entries(buckets)) console.log(`${k.padEnd(28)} ${v} (${(v / promos.length * 100).toFixed(0)}%)`)

// same, split Round 1 vs everyone else
for (const tier of ['Round 1', 'Rounds 2-5', 'Rounds 6-10', 'Round 11+', 'No draft record']) {
  const sub = promos.filter((p) => p.draftTier === tier)
  if (!sub.length) continue
  const asb = sub.filter((p) => { const d = dayOfYear(p.date); return d >= 190 && d < 213 }).length
  console.log(`${tier.padEnd(18)} n=${sub.length}  Jul10-Aug window=${(asb / sub.length * 100).toFixed(0)}%`)
}

await writeFile(join(here, 'org-timing.json'), JSON.stringify({ aaRows, aaaRows, buckets, promosTotal: promos.length }, null, 2))
console.log('\nwrote org-timing.json')
