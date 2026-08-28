// Panel: what a Top Prospects ranking is worth in career earnings.
//
// One row per player in the UNION of two populations, because neither one
// alone can answer the question honestly:
//
//   - the RANKED population: every man who appeared on MLB Pipeline's Top
//     Prospects list 2009-2024 (.scratch/top-prospects-history/rows.json).
//     757 men. This is the cohort defined AT RANKING TIME, so a ranked man who
//     never reached the majors is in it, carrying a real zero.
//   - the DEBUT cohort: docs/prospect-traits.md's 3,061 men, every MLB debut
//     2005-2023 that cleared the app's rookie threshold. Already selected on
//     reaching the majors, so it can only answer the narrower question -- but
//     it is the only population that supplies an UNRANKED comparison group.
//
// THE SELECTION TRAP THIS PANEL IS BUILT AROUND. Prospects are ranked BEFORE
// they debut. The debut cohort starts in 2005; the rank file starts in 2009.
// For a man who debuted in 2006 the seasons he could have been listed in are
// simply not in the file. He is ABSENT, and absent is not the same fact as
// unranked. Coding him as an unranked zero would read "no list exists for that
// year" as "this man was not good enough to be listed". Every row therefore
// carries `windowStatus`, and the ranked-versus-unranked comparisons run only
// on the rows where the whole ranking window is observed. See computeWindow().
//
// Rebuild: node .scratch/prospect-value/panel.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCohort } from '../prospect-traits/lib.mjs'
import { parseCsv } from '../../scripts/lib/csv.mjs'
import { resolveRole } from '../../src/lib/contracts/positions.js'
import { parseMoneyCell } from '../../src/lib/contracts/parseMoney.js'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const j = async (p) => JSON.parse(await readFile(p, 'utf8'))

// --- 1. the ranked lists ----------------------------------------------------

const rankRows = await j(join(here, '..', 'top-prospects-history', 'rows.json'))
const rankSeasons = await j(join(here, '..', 'top-prospects-history', 'seasons.json'))
const rankedBios = await j(join(here, 'bios.json'))

// Depth per season, read from the coverage file rather than assumed. 2009-2011
// are TOP-50 lists and 2020/2021 stop at 99; pooling a top-50 year with a
// top-100 year as though rank 60 could have existed in 2010 is an artifact.
const DEPTH = new Map()
const AVAILABLE = new Set()
for (const s of rankSeasons) {
  if (s.status !== 'ok') continue
  AVAILABLE.add(s.season)
  DEPTH.set(s.season, s.depth)
}
const RANK_MIN = Math.min(...AVAILABLE)
const RANK_MAX = Math.max(...AVAILABLE)
const DEEP = new Set([...AVAILABLE].filter((y) => DEPTH.get(y) >= 99))

const byPlayer = new Map()
for (const r of rankRows) {
  if (!byPlayer.has(r.mlbId)) byPlayer.set(r.mlbId, [])
  byPlayer.get(r.mlbId).push({ season: r.season, rank: r.rank, depth: DEPTH.get(r.season) })
}
for (const v of byPlayer.values()) v.sort((a, b) => a.season - b.season)

// --- 2. the ranking window, and who is observable inside it -----------------

// How many seasons before his debut can a man appear on a list? Measured, not
// assumed: over the ranked men with a known debut, the window running from one
// season AFTER the debut (a rookie-eligible man stays on the list) back to
// FOUR seasons before it catches 98.1% of them. The capture rate is re-derived
// and asserted at the end, so a rebuilt rank file cannot move it in silence.
const LAG_AFTER = 1
const LAG_BEFORE = 4

function windowSeasons(debutYear) {
  const out = []
  for (let y = debutYear - LAG_BEFORE; y <= debutYear + LAG_AFTER; y++) out.push(y)
  return out
}

// 'observed-deep'    every season of the window exists AND is a top-100 list.
//                    Ranked-versus-unranked is clean here.
// 'observed-shallow' every season exists, but at least one is a top-50 list
//                    (2009-2011). A man who would have ranked 51-100 in such a
//                    year reads as unranked -- a depth undercount, not a gap.
// 'censored'         at least one season of the window has NO list at all
//                    (2005-2008, or after the file ends). NEVER enters a
//                    ranked-versus-unranked comparison.
function computeWindow(debutYear) {
  if (debutYear == null) return 'no-debut'
  const w = windowSeasons(debutYear)
  if (w.some((y) => !AVAILABLE.has(y))) return 'censored'
  if (w.some((y) => !DEEP.has(y))) return 'observed-shallow'
  return 'observed-deep'
}

// --- 3. earnings ------------------------------------------------------------

// salaries.csv is 27,349 rows, 2000-2026. Three rules from the foundation pass,
// all load-bearing:
//   - a front-office row leaves through resolveRole(), never the position cell:
//     27 rows carry a front-office title while the man was actively playing.
//   - a non-numeric salary is a STATUS, not a number, and carries no dollars.
//   - rowKey is a POSITIONAL index. The crosswalk array is aligned to the CSV
//     by position; the alignment is asserted here rather than trusted.
const salaryRows = parseCsv(await readFile(join(repo, 'scripts/data/contracts/salaries.csv'), 'utf8'))
const salaryXw = await j(join(repo, 'public/data/contracts-history/identity/salaries.json'))
if (salaryXw.length !== salaryRows.length) throw new Error('crosswalk length does not match salaries.csv')
for (let i = 0; i < salaryRows.length; i++) {
  const x = salaryXw[i]
  if (
    x.rowKey !== `salaries#${i}` ||
    x.rawName !== salaryRows[i].player ||
    Number(x.season) !== Number(salaryRows[i].year)
  ) {
    throw new Error(`crosswalk row ${i} does not align with salaries.csv -- a row moved`)
  }
}

const seasonNames = new Map()
for (let y = 2000; y <= 2026; y++) {
  try {
    const pool = await j(join(repo, `public/data/contracts-history/season-players/${y}.json`))
    seasonNames.set(y, new Set(pool.map((p) => p.lastFirstName)))
  } catch {
    seasonNames.set(y, new Set())
  }
}

// 2026 is an announced season, not a paid one. Every earnings figure stops at
// 2025 so an announced salary never enters a career total.
const LAST_PAID_SEASON = 2025

const earnings = new Map() // mlbId -> Map(season -> dollars)
const audit = { numericRows: 0, dollars: 0, noMlbId: 0, noMlbIdDollars: 0, statuses: {}, roles: {} }
for (let i = 0; i < salaryRows.length; i++) {
  const row = salaryRows[i]
  const year = Number(row.year)
  const role = resolveRole(row, seasonNames.get(year))
  audit.roles[role] = (audit.roles[role] ?? 0) + 1
  if (role !== 'player') continue
  const money = parseMoneyCell(row.salary, 'salary', row)
  const status = money.status ?? 'numeric'
  audit.statuses[status] = (audit.statuses[status] ?? 0) + 1
  if (money.status != null || money.amount == null) continue
  audit.numericRows++
  audit.dollars += money.amount
  if (year > LAST_PAID_SEASON) continue
  const id = salaryXw[i].mlbId
  if (id == null) {
    audit.noMlbId++
    audit.noMlbIdDollars += money.amount
    continue
  }
  if (!earnings.has(id)) earnings.set(id, new Map())
  const m = earnings.get(id)
  m.set(year, (m.get(year) ?? 0) + money.amount)
}

// The index. A 2004 salary and a 2024 salary are not the same money, and
// consumer inflation is the wrong ruler for a labour market that grew far
// faster than prices. Every dollar is restated in 2025 salary terms using
// salaries_summary.csv's own league average salary for its season.
const summary = parseCsv(await readFile(join(repo, 'scripts/data/contracts/salaries_summary.csv'), 'utf8'))
const avgByYear = new Map(summary.map((r) => [Number(r.year), Number(r.avg_salary)]))
const BASE_YEAR = 2025
const baseAvg = avgByYear.get(BASE_YEAR)
if (!Number.isFinite(baseAvg)) throw new Error('no league average salary for the base year')
const indexFactor = new Map()
for (const [y, avg] of avgByYear) indexFactor.set(y, baseAvg / avg)

// The 21 player-seasons where two men share one mlbId (payroll-panel.json).
// Twelve are real homonym pairs; nine are wrong fuzzy matches in the contract
// crosswalk. This panel joins at player grain on mlbId, so every affected id is
// FLAGGED and the analysis reports the sensitivity. Repairing them belongs in
// the admin workbench, not here.
const payrollPanel = await j(join(here, '..', 'team-success', 'payroll-panel.json'))
const collisionIds = new Set((payrollPanel.identityCollisions ?? []).map((c) => c.mlbId))

// --- 4. the debut cohort ----------------------------------------------------

const cohort = await buildCohort()
const cohortById = new Map(cohort.map((p) => [p.id, p]))

// Age relative to level: the man's age in his LAST pre-debut season at his
// highest minor-league level, centred on the cohort mean for that same
// (level, season) cell. Cells thinner than 15 men fall back to the level mean
// pooled over seasons. It is a cohort-relative figure -- the cohort holds only
// men who reached the majors -- and it is reported as such.
function ageInSeason(p, season) {
  if (!p.birthDate) return null
  return season + 0.5 - (Number(p.birthDate.slice(0, 4)) + (Number(p.birthDate.slice(5, 7)) - 0.5) / 12)
}
const cells = new Map()
const levelPool = new Map()
for (const p of cohort) {
  const top = p.segs[p.segs.length - 1]
  if (!top) continue
  const age = ageInSeason(p, top.lastSeason)
  if (age == null) continue
  p.topLevel = top.level
  p.topSeason = top.lastSeason
  p.ageAtTop = age
  const key = `${top.level}:${top.lastSeason}`
  if (!cells.has(key)) cells.set(key, [])
  cells.get(key).push(age)
  if (!levelPool.has(top.level)) levelPool.set(top.level, [])
  levelPool.get(top.level).push(age)
}
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
const cellMean = new Map([...cells].map(([k, v]) => [k, mean(v)]))
const cellN = new Map([...cells].map(([k, v]) => [k, v.length]))
const levelMean = new Map([...levelPool].map(([k, v]) => [k, mean(v)]))

// --- 5. rows ----------------------------------------------------------------

function debutYearOf(id) {
  const c = cohortById.get(id)
  if (c) return c.debutYear
  const b = rankedBios[id]
  if (b?.mlbDebutDate) return Number(b.mlbDebutDate.slice(0, 4))
  return null
}

// A two-way man gets his own value rather than being folded into one side. It
// is one player -- Shohei Ohtani, statsapi positionType "Two-Way Player" -- and
// he is also the single man buildCohort() drops from the 3,061, because
// raw.json gives him no stat group. He is therefore the highest-earning ranked
// prospect of the era AND the one man the debut cohort cannot see. Filing him
// as a hitter would put the largest contract in the data on one side of the
// hitter-pitcher split by accident. 'two-way' is excluded from both.
function groupOf(id) {
  const c = cohortById.get(id)
  if (c) return c.group
  const b = rankedBios[id]
  if (!b) return null
  if (b.positionType === 'Two-Way Player') return 'two-way'
  if (b.positionType === 'Pitcher') return 'pitching'
  if (b.positionType) return 'hitting'
  return null
}

const allIds = new Set([...cohortById.keys(), ...byPlayer.keys()])
const panel = []
for (const id of [...allIds].sort((a, b) => a - b)) {
  const c = cohortById.get(id) ?? null
  const b = rankedBios[id] ?? null
  const ranks = byPlayer.get(id) ?? []
  const debutYear = debutYearOf(id)
  const seasons = earnings.get(id) ?? new Map()

  const paidSeasons = [...seasons.keys()].sort((x, y) => x - y)
  const byHorizon = {}
  if (debutYear != null) {
    for (const h of [3, 6, 9, 12]) {
      let nominal = 0
      let indexed = 0
      let complete = true
      for (let y = debutYear; y <= debutYear + h - 1; y++) {
        if (y > LAST_PAID_SEASON || y < 2000) {
          complete = false
          continue
        }
        const d = seasons.get(y) ?? 0
        nominal += d
        indexed += d * (indexFactor.get(y) ?? 1)
      }
      byHorizon[`h${h}`] = { nominal, indexed, complete }
    }
  }

  let careerNominal = 0
  let careerIndexed = 0
  for (const [y, d] of seasons) {
    careerNominal += d
    careerIndexed += d * (indexFactor.get(y) ?? 1)
  }

  const peak = ranks.length ? Math.min(...ranks.map((r) => r.rank)) : null
  const peakRow = ranks.length ? ranks.find((r) => r.rank === peak) : null
  const cellKey = c?.topLevel ? `${c.topLevel}:${c.topSeason}` : null
  const ref = cellKey && cellN.get(cellKey) >= 15 ? cellMean.get(cellKey) : c?.topLevel ? levelMean.get(c.topLevel) : null

  panel.push({
    mlbId: id,
    name: c?.name ?? b?.name ?? null,
    group: groupOf(id),
    inDebutCohort: !!c,
    inRankFile: ranks.length > 0,
    debutYear,
    debutDate: c?.debutDate ?? b?.mlbDebutDate ?? null,
    windowStatus: computeWindow(debutYear),
    // rank facts
    nRankSeasons: ranks.length,
    peakRank: peak,
    peakRankDepth: peakRow ? peakRow.depth : null,
    firstRankSeason: ranks.length ? ranks[0].season : null,
    firstRank: ranks.length ? ranks[0].rank : null,
    firstRankDepth: ranks.length ? ranks[0].depth : null,
    lastRankSeason: ranks.length ? ranks[ranks.length - 1].season : null,
    rankSeasons: ranks,
    // development facts (debut cohort only)
    ageAtDebut: c?.ageAtDebut ?? null,
    seasonsToDebut: c?.seasonsToDebut ?? null,
    topLevel: c?.topLevel ?? null,
    ageAtTopLevel: c?.ageAtTop ?? null,
    ageRelToLevel: c?.ageAtTop != null && ref != null ? c.ageAtTop - ref : null,
    draftTier: c?.draftTier ?? null,
    // earnings
    hasSalaryRow: seasons.size > 0,
    paidSeasonCount: seasons.size,
    // Per-season dollars, so a consumer can cut ANY fixed window without
    // re-deriving the join. The rank curve needs a window measured from the
    // first ranking season, which no debut-anchored horizon can supply.
    // An ARRAY of records, not a year-keyed object: read_json_auto infers a
    // year-keyed object as a STRUCT with one column per year it happens to
    // see, which changes shape whenever the data does.
    seasonEarnings: [...seasons].sort((x, y) => x[0] - y[0]).map(([season, dollars]) => ({ season, dollars })),
    firstPaidSeason: paidSeasons.length ? paidSeasons[0] : null,
    lastPaidSeason: paidSeasons.length ? paidSeasons[paidSeasons.length - 1] : null,
    careerNominal,
    careerIndexed,
    ...byHorizon,
    identityCollision: collisionIds.has(id),
  })
}

// --- 6. assertions ----------------------------------------------------------

// Re-derive the ranking window from the data instead of trusting the constant.
let inWindow = 0
let withDebut = 0
for (const [id, ranks] of byPlayer) {
  const d = debutYearOf(id)
  if (d == null) continue
  withDebut++
  if (ranks.some((r) => d - r.season <= LAG_BEFORE && d - r.season >= -LAG_AFTER)) inWindow++
}
const capture = inWindow / withDebut
if (capture < 0.95) {
  throw new Error(`ranking window [-${LAG_AFTER},${LAG_BEFORE}] now catches only ${(100 * capture).toFixed(1)}% of ranked debutants`)
}

const windowCounts = {}
for (const r of panel) windowCounts[r.windowStatus] = (windowCounts[r.windowStatus] ?? 0) + 1

const meta = {
  generatedAt: new Date().toISOString(),
  rankWindow: { first: RANK_MIN, last: RANK_MAX, depths: Object.fromEntries([...DEPTH].sort((a, b) => a[0] - b[0])) },
  unavailableRankSeasons: rankSeasons.filter((s) => s.status !== 'ok').map((s) => s.season),
  rankingWindow: { lagBefore: LAG_BEFORE, lagAfter: LAG_AFTER, captureRate: capture, rankedWithDebut: withDebut },
  lastPaidSeason: LAST_PAID_SEASON,
  indexBaseYear: BASE_YEAR,
  indexFactor: Object.fromEntries([...indexFactor].sort((a, b) => a[0] - b[0])),
  salaryAudit: audit,
  identityCollisionIds: [...collisionIds],
  counts: {
    rows: panel.length,
    debutCohort: cohort.length,
    rankedPlayers: byPlayer.size,
    rankedInDebutCohort: panel.filter((r) => r.inRankFile && r.inDebutCohort).length,
    rankedNotInDebutCohort: panel.filter((r) => r.inRankFile && !r.inDebutCohort).length,
    rankedNeverDebuted: panel.filter((r) => r.inRankFile && r.debutYear == null).length,
    windowStatus: windowCounts,
  },
}

// panel.json is a plain top-level ARRAY, and the metadata lives beside it in
// panel-meta.json rather than wrapping it. A {meta, rows} wrapper registers in
// scripts/research-db.mjs as ONE row holding an array column, so every
// row-grain query against it throws -- a sibling panel in this wave learned
// that. A bare array registers as one row per player with no flattening step.
await writeFile(join(here, 'panel.json'), JSON.stringify(panel, null, 1))
await writeFile(join(here, 'panel-meta.json'), JSON.stringify(meta, null, 1))
console.log(JSON.stringify(meta.counts, null, 1))
console.log('window capture', (100 * capture).toFixed(1) + '%')
console.log('salary audit', JSON.stringify(audit))
