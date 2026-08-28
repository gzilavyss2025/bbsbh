// W3.5 — "Does the debut calendar follow the service-time clock?"
//
// Every statsapi pull this spike needs, in one resumable script. Each cache is
// written under .scratch/service-clock/ and re-read on the next run, so a
// re-run costs nothing. Pass --refetch <name> to force one cache to rebuild.
//
// FIELD PATHS ARE CONFIRMED AGAINST LIVE RESPONSES, not guessed:
//   /api/v1/seasons?sportId=1&season=YYYY  -> regularSeasonStartDate,
//       regularSeasonEndDate  (checked 2015: 2015-04-05 .. 2015-10-04)
//   /api/v1/sports/1/players?season=YYYY   -> people[].mlbDebutDate,
//       id, fullName, primaryPosition.{code,abbreviation,type}, birthDate
//       (checked 2015: 1,348 people, 0 missing mlbDebutDate, 254 debuts)
//   /api/v1/transactions?startDate&endDate&sportId=1 -> transactions[].{id,
//       person.id, fromTeam.id, toTeam.id, date, effectiveDate, typeCode,
//       typeDesc, description}  (checked 2015-04-17: 35 rows, codes
//       OPT/SFA/DES/ASG/CU/SC/CLW/SE)
//
// Two standing traps are honoured here:
//   - `effectiveDate` can be months wrong. Every join in this spike uses
//     `date`. The raw row keeps both so a later reader can check.
//   - Wire row order is unstable between queries. Rows are sorted by `id`
//     before anything groups or merges them.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const API = 'https://statsapi.mlb.com/api/v1'

// The debut window. 2005 is where the reusable prospect cohort starts; 2025 is
// the last complete season. 2026 is in progress and is deliberately out.
export const FIRST_SEASON = 2005
export const LAST_SEASON = 2025

const refetch = new Set(
  process.argv.slice(2).flatMap((a, i, all) => (a === '--refetch' ? [all[i + 1]] : [])),
)

async function get(url, tries = 2) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'bbsbh-research/1.0' } })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return await res.json()
    } catch (err) {
      // The standing note: retry once on a connect timeout before giving up.
      if (attempt === tries) throw err
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

async function cached(name, build) {
  const path = join(here, `${name}.json`)
  if (existsSync(path) && !refetch.has(name)) {
    return JSON.parse(await readFile(path, 'utf8'))
  }
  const data = await build()
  await mkdir(here, { recursive: true })
  await writeFile(path, JSON.stringify(data))
  return data
}

// --- 1. the season calendar --------------------------------------------------
// One row per season carrying the regular-season first and last day. The
// service-time line is derived from these two dates in build.mjs, never
// hard-coded.
async function pullSeasons() {
  const out = []
  for (let y = FIRST_SEASON; y <= LAST_SEASON; y++) {
    const j = await get(`${API}/seasons?sportId=1&season=${y}`)
    const s = j.seasons?.[0]
    if (!s) throw new Error(`no season record for ${y}`)
    out.push({
      season: y,
      regularSeasonStartDate: s.regularSeasonStartDate,
      regularSeasonEndDate: s.regularSeasonEndDate,
      allStarDate: s.allStarDate ?? null,
    })
    process.stderr.write(`seasons ${y} ${s.regularSeasonStartDate}..${s.regularSeasonEndDate}\n`)
  }
  return out
}

// --- 2. every MLB debut in the window ----------------------------------------
// The complete population, not a filtered cohort: /sports/1/players lists every
// man who appeared for an MLB club that season and carries his mlbDebutDate, so
// a season's debut class is that season's list filtered on the debut year. No
// performance threshold is applied here — a threshold is a selection, and this
// spike needs the unselected denominator.
async function pullDebuts() {
  const byId = new Map()
  for (let y = FIRST_SEASON; y <= LAST_SEASON; y++) {
    const j = await get(`${API}/sports/1/players?season=${y}`)
    const people = j.people ?? []
    let debuts = 0
    for (const p of people) {
      if (!p.mlbDebutDate) continue
      const debutYear = Number(p.mlbDebutDate.slice(0, 4))
      if (debutYear !== y) continue
      debuts++
      // A man can appear in two season lists; keep one row.
      if (byId.has(p.id)) continue
      byId.set(p.id, {
        id: p.id,
        name: p.fullName,
        debutDate: p.mlbDebutDate,
        debutSeason: debutYear,
        birthDate: p.birthDate ?? null,
        posCode: p.primaryPosition?.code ?? null,
        posAbbr: p.primaryPosition?.abbreviation ?? null,
        posType: p.primaryPosition?.type ?? null,
      })
    }
    process.stderr.write(`debuts ${y}: ${debuts} of ${people.length} listed\n`)
  }
  return [...byId.values()].sort((a, b) => a.debutDate.localeCompare(b.debutDate) || a.id - b.id)
}

// --- 3. the transaction wire -------------------------------------------------
// Pulled month by month so no single response is enormous, from February (the
// first roster moves of the year) through November. Everything is kept: the
// roster-add codes this spike joins on and the status changes the roster-need
// control reads are both in here, and a later question should not need a
// re-pull.
async function pullTransactions() {
  const rows = []
  for (let y = FIRST_SEASON; y <= LAST_SEASON; y++) {
    let seasonRows = 0
    for (let m = 2; m <= 11; m++) {
      const start = `${y}-${String(m).padStart(2, '0')}-01`
      const endDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
      const end = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
      const j = await get(`${API}/transactions?startDate=${start}&endDate=${end}&sportId=1`)
      for (const t of j.transactions ?? []) {
        rows.push({
          id: t.id,
          personId: t.person?.id ?? null,
          fromTeamId: t.fromTeam?.id ?? null,
          toTeamId: t.toTeam?.id ?? null,
          date: t.date ?? null,
          effectiveDate: t.effectiveDate ?? null,
          typeCode: t.typeCode ?? null,
          typeDesc: t.typeDesc ?? null,
          description: t.description ?? '',
        })
        seasonRows++
      }
    }
    process.stderr.write(`txn ${y}: ${seasonRows} rows\n`)
  }
  // Wire order is unstable between queries. Sort by id so every downstream
  // grouping sees the same sequence.
  rows.sort((a, b) => a.id - b.id)
  return rows
}

const which = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : null

if (!which || which === 'seasons') await cached('seasons', pullSeasons)
if (!which || which === 'debuts') await cached('debuts', pullDebuts)
if (!which || which === 'transactions') await cached('transactions', pullTransactions)
process.stderr.write('pull done\n')
