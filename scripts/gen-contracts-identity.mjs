// Resolves every row of the four historical contract CSVs
// (scripts/data/contracts/*.csv) to a real MLB player id, using the season
// player-pool cache from scripts/gen-contracts-season-players.mjs as the
// candidate list and scripts/lib/contract-identity-match.mjs for the
// name/position/service-time scoring.
//
// A row with no confident match is written out `unresolved`/`ambiguous`,
// never silently guessed -- see
// docs/adr/0066-a-contract-row-with-no-confident-id-stays-unresolved.md.
// Those rows are exactly what PR2's /admin/contracts review page queues up.
//
// Match order matters and is NOT arbitrary:
//   1. Extensions   -- has a club + a signed_date, the tightest team-season scope
//   2. Arbitration  -- has a club + season (roster looked up at season-1,
//                      since the "prior year" WARP/salary columns it carries
//                      describe that season, and arbitration doesn't reassign
//                      a player to a new team)
//   3. Free Agency  -- has old_club/new_club; scoped to OLD club at (year-1),
//                      the roster the player actually sat on at signing time
//                      -- new_club frequently has no roster history yet for
//                      a player who just switched teams
//   4. Salaries     -- NO team column at all, matched against the full
//                      season-wide pool (~1,300 candidates/year), but first
//                      checked against a warm-start map of names already
//                      resolved (unambiguously) from the other three files
//
// Run by hand: node scripts/gen-contracts-identity.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { parseCsv } from './lib/csv.mjs'
import { resolveClubCode } from './lib/retrosheet-teams.mjs'
import { matchRow, normalizeName } from './lib/contract-identity-match.mjs'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'

const here = dirname(fileURLToPath(import.meta.url))
const sourceDir = join(here, 'data', 'contracts')
const poolDir = join(here, '..', 'public', 'data', 'contracts-history', 'season-players')
const outDir = join(here, '..', 'public', 'data', 'contracts-history', 'identity')

const poolCache = new Map()
async function loadPool(season) {
  if (poolCache.has(season)) return poolCache.get(season)
  const pool = await readJsonOr(join(poolDir, `${season}.json`), null)
  poolCache.set(season, pool)
  return pool
}

// Resolves a club-code cell to a teamId, or null if the row carries no usable
// team context (blank cell, or a "left MLB" sentinel like retired/KBO/NPB).
// An actually UNKNOWN code (one this table has never seen) is a hard error --
// scripts/lib/retrosheet-teams.mjs's crosswalk was built from every code
// observed in these exact files, so a new miss means a new source export
// needs the table extended, not a silent skip.
function requireTeamId(code, context) {
  if (!code) return null
  const resolved = resolveClubCode(code)
  if (resolved === null) {
    throw new Error(`Unrecognized club code "${code}" (${context}) -- extend scripts/lib/retrosheet-teams.mjs`)
  }
  return resolved.leftMlb ? null : resolved.teamId
}

async function candidatesFor(season, teamId) {
  const pool = await loadPool(season)
  if (!pool) return []
  if (teamId == null) return pool
  const scoped = pool.filter((p) => p.teamId === teamId)
  return scoped.length > 0 ? scoped : pool // fall back to full pool rather than zero candidates
}

// A row's own season is usually right, but two real gaps showed up on first
// run against actual data: a prospect extended before their MLB debut (e.g.
// Jackson Chourio, signed 2023, debuted 2024 -- the 2023 pool has zero
// entries for him at all), and the occasional season-boundary-off-by-one.
// Widen the search a little before giving up, preferring the row's own
// season but trying nearby ones -- name matching stays exactly as strict, only
// which season's roster is being checked changes.
const SEASON_SEARCH_OFFSETS = [0, 1, 2, -1]

// `season` is the row's real, reportable contract-year (what a consumer
// should display). `lookupSeason` is which season's roster to check name
// candidates against -- for arbitration/free-agency these differ (a 2026
// arbitration case is decided on the 2025 roster), so the two must never be
// conflated: overwriting `season` with the lookup season would silently
// mislabel every arbitration/free-agency record's actual contract year.
async function resolve(sourceFile, index, { rawName, season, lookupSeason, teamId, position, mls }) {
  const baseSeason = lookupSeason ?? season
  let best = null
  let bestSeason = baseSeason
  for (const offset of SEASON_SEARCH_OFFSETS) {
    const trySeason = baseSeason + offset
    if (!Number.isFinite(trySeason)) continue
    const candidates = await candidatesFor(trySeason, teamId)
    const result = matchRow({ rawName, position, mls }, candidates, trySeason)
    if (result.confidence === 'exact' || result.confidence === 'fuzzy') {
      best = result
      bestSeason = trySeason
      break
    }
    if (!best || (best.confidence === 'unresolved' && result.confidence !== 'unresolved')) {
      best = result
      bestSeason = trySeason
    }
  }
  return {
    rowKey: `${sourceFile}#${index}`,
    sourceFile,
    season,
    matchedSeason: bestSeason,
    rawName,
    rawTeamCode: teamId ?? null,
    ...best,
  }
}

async function processExtensions() {
  const rows = parseCsv(await readFile(join(sourceDir, 'extensions.csv'), 'utf8'))
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const season = r.signed_date ? Number(r.signed_date.slice(0, 4)) : Number(r.first_year) - 1
    const teamId = requireTeamId(r.club, `extensions.csv row ${i}`)
    out.push(await resolve('extensions', i, { rawName: r.player, season, teamId, position: r.position, mls: r.mls }))
  }
  return out
}

async function processArbitration() {
  const rows = parseCsv(await readFile(join(sourceDir, 'arbitration.csv'), 'utf8'))
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const season = Number(r.season) // the arbitration year itself -- what a consumer should display
    const lookupSeason = season - 1 // roster lookup at the season the "prior year" columns describe
    const teamId = requireTeamId(r.club, `arbitration.csv row ${i}`)
    out.push(
      await resolve('arbitration', i, { rawName: r.player, season, lookupSeason, teamId, position: r.position, mls: r.mls }),
    )
  }
  return out
}

async function processFreeAgency() {
  const rows = parseCsv(await readFile(join(sourceDir, 'free_agency.csv'), 'utf8'))
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const season = Number(r.year) // the free-agent signing year itself
    const lookupSeason = season - 1 // last season on the OLD club, at signing time
    const teamId = requireTeamId(r.old_club, `free_agency.csv row ${i}`)
    out.push(
      await resolve('free_agency', i, { rawName: r.player, season, lookupSeason, teamId, position: r.position, mls: null }),
    )
  }
  return out
}

// Builds a name -> single known mlbId map from already-resolved rows, but
// ONLY when every resolution for that normalized name agrees on one id --
// two different real players who happen to share a name must never collapse
// into a false warm-start hit.
function buildWarmStart(resolvedBatches) {
  const byName = new Map()
  for (const batch of resolvedBatches) {
    for (const row of batch) {
      if (row.confidence !== 'exact' && row.confidence !== 'fuzzy') continue
      const key = normalizeName(row.rawName)
      if (!byName.has(key)) byName.set(key, new Set())
      byName.get(key).add(row.mlbId)
    }
  }
  const warmStart = new Map()
  for (const [key, ids] of byName) {
    if (ids.size === 1) warmStart.set(key, [...ids][0])
  }
  return warmStart
}

async function processSalaries(warmStart) {
  const rows = parseCsv(await readFile(join(sourceDir, 'salaries.csv'), 'utf8'))
  const out = []
  let warmHits = 0
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const season = Number(r.year)
    const key = normalizeName(r.player)
    if (warmStart.has(key)) {
      warmHits++
      out.push({
        rowKey: `salaries#${i}`,
        sourceFile: 'salaries',
        season,
        rawName: r.player,
        rawTeamCode: null,
        mlbId: warmStart.get(key),
        confidence: 'exact',
        matchScore: 1,
        matchedVia: 'cross-file-identity',
        candidates: [],
      })
      continue
    }
    out.push(await resolve('salaries', i, { rawName: r.player, season, teamId: null, position: r.position, mls: r.mls }))
  }
  console.log(`  salaries: ${warmHits}/${rows.length} rows resolved via warm-start from other files`)
  return out
}

function report(name, rows) {
  const counts = { exact: 0, fuzzy: 0, ambiguous: 0, unresolved: 0 }
  for (const r of rows) counts[r.confidence] = (counts[r.confidence] ?? 0) + 1
  const pct = (n) => ((100 * n) / rows.length).toFixed(1)
  console.log(
    `${name}: ${rows.length} rows -- exact ${counts.exact} (${pct(counts.exact)}%), ` +
      `fuzzy ${counts.fuzzy} (${pct(counts.fuzzy)}%), ambiguous ${counts.ambiguous} (${pct(counts.ambiguous)}%), ` +
      `unresolved ${counts.unresolved} (${pct(counts.unresolved)}%)`,
  )
}

// Second pass, after every file has had its own team/season-scoped attempt:
// a row can stay unresolved purely because the roster lookup for ITS OWN
// season/team came up empty (e.g. Alek Manoah's 2026 arbitration case lists
// Atlanta -- he was traded there and non-tendered without ever appearing on
// an Atlanta roster -- while his 2025 Toronto arbitration row, same person,
// resolves cleanly). If the row's name is unambiguous across the WHOLE
// resolved dataset, reuse that id instead of leaving a fixable row unresolved.
function crossReference(allBatches) {
  const byName = new Map()
  for (const batch of allBatches) {
    for (const row of batch) {
      if (row.confidence !== 'exact' && row.confidence !== 'fuzzy') continue
      const key = normalizeName(row.rawName)
      if (!byName.has(key)) byName.set(key, new Set())
      byName.get(key).add(row.mlbId)
    }
  }
  let filled = 0
  for (const batch of allBatches) {
    for (const row of batch) {
      if (row.confidence === 'exact' || row.confidence === 'fuzzy') continue
      const ids = byName.get(normalizeName(row.rawName))
      if (ids && ids.size === 1) {
        row.mlbId = [...ids][0]
        row.confidence = 'fuzzy'
        row.matchedVia = 'cross-reference'
        row.candidates = []
        filled++
      }
    }
  }
  return filled
}

async function main() {
  console.log('Matching extensions.csv...')
  const extensions = await processExtensions()
  console.log('Matching arbitration.csv...')
  const arbitration = await processArbitration()
  console.log('Matching free_agency.csv...')
  const freeAgency = await processFreeAgency()

  const warmStart = buildWarmStart([extensions, arbitration, freeAgency])
  console.log(`Matching salaries.csv (warm-start pool: ${warmStart.size} unambiguous names)...`)
  const salaries = await processSalaries(warmStart)

  const filled = crossReference([extensions, arbitration, freeAgency, salaries])
  console.log(`Cross-reference pass: filled ${filled} otherwise-unresolved rows from elsewhere in the dataset.`)

  await writeJsonAtomic(join(outDir, 'extensions.json'), extensions, 2)
  await writeJsonAtomic(join(outDir, 'arbitration.json'), arbitration, 2)
  await writeJsonAtomic(join(outDir, 'free_agency.json'), freeAgency, 2)
  await writeJsonAtomic(join(outDir, 'salaries.json'), salaries, 2)

  // A separate, much smaller file for the /admin/contracts review queue
  // (PR2): every non-exact row across all four files, so the review page
  // never has to fetch salaries.json's full ~8 MB just to find the ~700
  // rows in it actually worth a human's attention.
  const pending = [extensions, arbitration, freeAgency, salaries]
    .flat()
    .filter((row) => row.confidence !== 'exact')
  await writeJsonAtomic(join(outDir, 'pending.json'), pending, 2)
  console.log(`Wrote pending.json: ${pending.length} rows needing review`)

  console.log('\nMatch-rate report:')
  report('extensions', extensions)
  report('arbitration', arbitration)
  report('free_agency', freeAgency)
  report('salaries', salaries)
}

await main()
