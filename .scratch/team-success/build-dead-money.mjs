// Builds the dead-money panel: one row per player-season that was PAID and
// logged no MLB plate appearance and no inning that season (W1.1's
// paid-no-appearance.json, read here as-is, never re-derived).
//
// THE NAME IS WIDER THAN THE TERM. "Dead money" in baseball usually means
// salary owed to a player no longer on the roster. This panel is wider: it
// also holds players who sat on the active roster all year hurt, and
// players signed but never activated. A reader who wants the narrow sense
// should filter this panel's `classification` down to 'released',
// 'designated-for-assignment' and 'outrighted-to-minors'.
//
// TWO SEPARATE QUESTIONS, TWO SEPARATE SOURCES.
//
// 1. attributedTeamId -- which club, if any, can be named for the season.
//    salaries.csv carries no club column (ADR-0067), and inferring a club
//    from a season roster is the exact error that ADR refused to make. So
//    this never guesses from a roster. It tries two things, in order, and
//    leaves the field null rather than force a third:
//      a. ADJACENT-SEASON STINT. .scratch/team-success/roster-age-cache.json
//         gives real MLB stints (by team) for the seasons around the paid
//         one. If the season before and the season after agree on exactly
//         one club, or only one side has data and it names exactly one
//         club, that club gets the row. A player who played for different
//         clubs on each side changed teams somewhere in the gap -- that is
//         a genuine unknown, not a coin flip, so it is left null here.
//      b. TRANSACTIONS WIRE. For everything still unattributed, this reads
//         statsapi's own /api/v1/transactions directly for the season (see
//         "WHY NOT public/data/team-transactions/" below) and takes the
//         chronologically LAST row that names a real MLB club (toTeam,
//         falling back to fromTeam) as that season's club.
//    Both routes are read-only against real events. Neither infers a club
//    from "he was on this roster in that year," which is the thing ADR-0067
//    forbids.
//
// 2. classification -- why he was paid and did not appear. Derived from
//    every transaction row the wire carries for him that season, checked in
//    this order (most definitive first): released > retired > designated
//    for assignment > outrighted to the minors > optioned to the minors >
//    injured (the wire says "disabled list" before 2019 and "injured list"
//    after -- both are read) > signed to a minor league deal and never
//    activated > elected free agency > 'other' (wire rows exist but match
//    none of these) > 'unknown' (no wire rows at all that season -- most
//    common before 2009, see docs/transactions-wire.md). Elected free
//    agency ranks near the bottom on purpose -- it is a routine,
//    contract-ending formality that fires for almost any player nearing
//    free agency, often filed after the season is over, and explains
//    nothing about why he did not appear (verified live: Justin Verlander's
//    2021 row set is a 60-day-IL placement in February and a "DFA" row
//    dated that November).
//
// WHY NOT public/data/team-transactions/. That tree holds ONLY the 2026
// season -- scripts/gen-team-transactions.mjs rebuilds the current season
// from scratch every night and never backfills a past one (its own header
// says so). It cannot classify a single 2000-2025 case. This script instead
// pulls /api/v1/transactions directly, once per season, exactly as
// scripts/gen-trade-deadline.mjs and scripts/gen-team-transactions.mjs do
// for a single season each. The wire itself thins badly before 2009
// (docs/transactions-wire.md) -- expect more 'unknown' rows in early
// seasons, and this script prints the split by season so that is visible,
// not silent.
//
// Run: node .scratch/team-success/build-dead-money.mjs
// (needs network access to statsapi.mlb.com)
// Writes: dead-money-panel.json
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getJson } from '../../src/api/statsapi.js'
import { isMlbTeamId } from '../../src/lib/teams.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO = join(__dirname, '..', '..')

const readJson = (p) => JSON.parse(readFileSync(join(REPO, p), 'utf8'))

const input = readJson('.scratch/team-success/paid-no-appearance.json')
const rows = input.rows
console.log(`input: ${rows.length} rows, window ${input.window.join('-')}`)

// ------------------------------------------------- adjacent-season stints

// `${season}|${personId}` -> Set<teamId>, built the same way build-payroll.mjs
// builds its stint map, but this only needs WHICH clubs, not playing time.
const cache = readJson('.scratch/team-success/roster-age-cache.json')
const stintTeams = new Map()
for (const key of Object.keys(cache)) {
  const [, teamIdRaw, seasonRaw] = key.split('-')
  const teamId = Number(teamIdRaw)
  const season = Number(seasonRaw)
  for (const split of cache[key]) {
    if (!split.personId) continue
    const mapKey = `${season}|${split.personId}`
    let set = stintTeams.get(mapKey)
    if (!set) {
      set = new Set()
      stintTeams.set(mapKey, set)
    }
    set.add(teamId)
  }
}

function adjacentSeasonTeam(season, mlbId) {
  const prev = stintTeams.get(`${season - 1}|${mlbId}`)
  const next = stintTeams.get(`${season + 1}|${mlbId}`)
  const prevList = prev ? [...prev] : []
  const nextList = next ? [...next] : []
  if (prevList.length > 0 && nextList.length > 0) {
    const shared = prevList.filter((t) => next.has(t))
    if (shared.length === 1) return shared[0]
    return null // played for different clubs on each side -- a real unknown
  }
  if (prevList.length === 1) return prevList[0]
  if (nextList.length === 1) return nextList[0]
  return null
}

// -------------------------------------------------------- the wire, live

// Which (season, mlbId) pairs need a wire pull at all -- every row, because
// classification is attempted for every row regardless of whether the
// adjacent-season route already found a club.
const seasonsNeeded = new Set(rows.map((r) => r.season))
const idsBySeasonNeeded = new Map()
for (const r of rows) {
  let set = idsBySeasonNeeded.get(r.season)
  if (!set) {
    set = new Set()
    idsBySeasonNeeded.set(r.season, set)
  }
  set.add(r.mlbId)
}

// season -> personId -> that player's transaction rows filed that season
const wireBySeason = new Map()
for (const season of [...seasonsNeeded].sort((a, b) => a - b)) {
  const wanted = idsBySeasonNeeded.get(season)
  const data = await getJson(`/api/v1/transactions?startDate=${season}-01-01&endDate=${season}-12-31`)
  const all = data.transactions ?? []
  const byPerson = new Map()
  for (const t of all) {
    const id = t.person?.id
    if (id == null || !wanted.has(id)) continue
    let list = byPerson.get(id)
    if (!list) {
      list = []
      byPerson.set(id, list)
    }
    list.push(t)
  }
  wireBySeason.set(season, byPerson)
  console.log(`${season}: ${all.length} wire rows, ${byPerson.size}/${wanted.size} of our players named on it`)
}

function mlbTeamOf(row) {
  const to = row.toTeam?.id
  if (to != null && isMlbTeamId(to)) return to
  const from = row.fromTeam?.id
  if (from != null && isMlbTeamId(from)) return from
  return null
}

function wireTeam(seasonRows) {
  const sorted = [...seasonRows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  for (let i = sorted.length - 1; i >= 0; i--) {
    const team = mlbTeamOf(sorted[i])
    if (team != null) return team
  }
  return null
}

const IL_RE = /injured list|disabled list/i
const MINOR_CONTRACT_RE = /minor league contract/i

function classify(seasonRows) {
  if (seasonRows.length === 0) return 'unknown'
  const has = (code) => seasonRows.some((r) => r.typeCode === code)
  const hasIL = seasonRows.some((r) => IL_RE.test(r.description ?? ''))
  const hasActivation = seasonRows.some((r) => r.typeCode === 'CU' || r.typeCode === 'SE')
  const hasMinorSigning = seasonRows.some(
    (r) => (r.typeCode === 'SFA' || r.typeCode === 'SGN') && MINOR_CONTRACT_RE.test(r.description ?? ''),
  )
  if (has('REL')) return 'released'
  if (has('RET')) return 'retired'
  if (has('DES')) return 'designated-for-assignment'
  if (has('OUT')) return 'outrighted-to-minors'
  if (has('OPT')) return 'optioned-to-minors'
  if (hasIL) return 'injured-reserve'
  if (hasMinorSigning && !hasActivation) return 'signed-not-activated'
  // The wire's DFA code means "declared free agency," not designated for
  // assignment (DES). It ranks last among the "found something" outcomes on
  // purpose: it fires as a routine, contract-ending formality for almost any
  // player nearing free agency, often filed in November, well after the
  // season it is being read for has ended (verified live: Justin Verlander's
  // 2021 row set is exactly a 60-day-IL placement in February and a DFA row
  // dated 2021-11-03 -- the DFA explains nothing about why he did not pitch,
  // the IL placement does). It is used only when nothing more specific fired.
  if (has('DFA')) return 'elected-free-agency'
  return 'other'
}

// ------------------------------------------------------------ the panel

const counts = {
  totalRows: rows.length,
  attributedByStint: 0,
  attributedByWire: 0,
  unattributed: 0,
  classifiedKnown: 0,
  classifiedUnknown: 0,
}
const bySeasonDollars = new Map()

const outputRows = rows.map((r) => {
  let attributedTeamId = adjacentSeasonTeam(r.season, r.mlbId)
  let attributionBasis = attributedTeamId != null ? 'adjacent-season stint' : null

  const seasonRows = wireBySeason.get(r.season)?.get(r.mlbId) ?? []

  if (attributedTeamId == null) {
    const fromWire = wireTeam(seasonRows)
    if (fromWire != null) {
      attributedTeamId = fromWire
      attributionBasis = 'transactions wire'
    }
  }

  if (attributionBasis === 'adjacent-season stint') counts.attributedByStint++
  else if (attributionBasis === 'transactions wire') counts.attributedByWire++
  else counts.unattributed++

  const classification = classify(seasonRows)
  if (classification === 'unknown') counts.classifiedUnknown++
  else counts.classifiedKnown++

  const seasonTotal = bySeasonDollars.get(r.season) ?? 0
  bySeasonDollars.set(r.season, seasonTotal + r.salary)

  return {
    season: r.season,
    mlbId: r.mlbId,
    name: r.name,
    salary: r.salary,
    attributedTeamId,
    attributionBasis,
    classification,
  }
})

const generatedAt = new Date().toISOString()
const panel = {
  generatedAt,
  window: input.window,
  definition:
    'A player-season that was paid (a trustworthy mlbId and a parsed salary in W1.1\'s ' +
    'paid-no-appearance.json) with NO MLB plate appearance and NO inning that season. This is ' +
    'WIDER than baseball\'s usual "dead money" -- it also holds players hurt all year on the ' +
    'active roster and players signed but never activated, not only released players.',
  attribution:
    'attributedTeamId is null wherever it cannot be known -- never inferred from a season roster ' +
    '(ADR-0067). Resolved two ways, in order: an adjacent-season stint from ' +
    'roster-age-cache.json when the season before and after agree on one club, or, failing that, ' +
    'the last statsapi /api/v1/transactions row that season naming a real MLB club. ' +
    'attributionBasis names which route found it, or is null if neither did.',
  classification:
    'Derived from every /api/v1/transactions row for that player filed in that season, read live ' +
    '-- public/data/team-transactions/ holds only the 2026 season and cannot classify this window. ' +
    "Checked in order, most definitive first: released, retired, elected-free-agency, " +
    "designated-for-assignment, outrighted-to-minors, optioned-to-minors, injured-reserve, " +
    "signed-not-activated, other (wire rows exist, none matched), unknown (no wire rows that " +
    'season -- the wire thins badly before 2009, docs/transactions-wire.md).',
  counts,
  rows: outputRows,
}

writeFileSync(
  join(__dirname, 'dead-money-panel.json'),
  `${JSON.stringify(panel, null, 1)}\n`,
)

// ----------------------------------------------------------- the report

console.log('\ncounts', counts)
const totalDollars = rows.reduce((sum, r) => sum + r.salary, 0)
console.log(`total dollars: $${totalDollars.toLocaleString('en-US')}`)

const usd = (n) => `$${n.toLocaleString('en-US')}`
console.log('\nby season:')
for (const season of [...bySeasonDollars.keys()].sort((a, b) => a - b)) {
  console.log(`${season}  ${usd(bySeasonDollars.get(season))}`)
}

const classCounts = new Map()
for (const r of outputRows) classCounts.set(r.classification, (classCounts.get(r.classification) ?? 0) + 1)
console.log('\nclassification counts:', Object.fromEntries(classCounts))

const top5 = [...rows].sort((a, b) => b.salary - a.salary).slice(0, 5)
console.log('\ntop 5 largest single cases:')
for (const r of top5) {
  console.log(`${r.season}  ${r.name}  ${usd(r.salary)}`)
}
