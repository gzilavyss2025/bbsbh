// KILL CHECK 0 — run before anything else.
//
// The gate: "the service-time column's 29.4% blank rate correlates with debut
// timing. That would mean your sample is selected by the very thing you are
// measuring."
//
// This script answers three questions, in order of how much they can hurt:
//   A. What SHAPE does the blankness have? Scatter, or a window?
//   B. Inside the usable window, does blankness track debut timing?
//   C. The wider selection risk the gate is really about: does a man's PRESENCE
//      in salaries.csv the season after he debuts depend on when he debuted?
//      The service column can only be read for men who have a row at all, so a
//      timing-dependent row rate would select the validation sample even if
//      every cell it holds is filled.
//
// Output: .scratch/service-clock/k0-blank-rate.json
import { writeFile } from 'node:fs/promises'
import { j, local, readCsv, loadCalendar, dayDiff, parseMls, propTest, pct, fmt } from './lib.mjs'

const out = {}
const say = (s) => process.stdout.write(s + '\n')

// --- A. the shape of the blankness ------------------------------------------
const salaries = await readCsv('scripts/data/contracts/salaries.csv')
const bySeason = new Map()
for (const r of salaries) {
  const y = Number(r.year)
  if (!bySeason.has(y)) bySeason.set(y, { rows: 0, blank: 0 })
  const s = bySeason.get(y)
  s.rows++
  if (!r.mls.trim()) s.blank++
}
const seasonRows = [...bySeason.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([season, s]) => ({ season, ...s, blankRate: s.blank / s.rows }))
const totalRows = salaries.length
const totalBlank = seasonRows.reduce((a, b) => a + b.blank, 0)
const preBlank = seasonRows.filter((s) => s.season <= 2009).reduce((a, b) => a + b.blank, 0)
const preRows = seasonRows.filter((s) => s.season <= 2009).reduce((a, b) => a + b.rows, 0)
const postBlank = seasonRows.filter((s) => s.season >= 2010).reduce((a, b) => a + b.blank, 0)
const postRows = seasonRows.filter((s) => s.season >= 2010).reduce((a, b) => a + b.rows, 0)

out.shape = {
  totalRows,
  totalBlank,
  totalBlankRate: totalBlank / totalRows,
  pre2010: { rows: preRows, blank: preBlank, rate: preBlank / preRows },
  from2010: { rows: postRows, blank: postBlank, rate: postBlank / postRows },
  bySeason: seasonRows,
}
say('=== A. shape of the blankness ===')
say(`all rows ${totalRows}, blank ${totalBlank} (${pct(totalBlank / totalRows)})`)
say(`2000-2009: ${preRows} rows, ${preBlank} blank (${pct(preBlank / preRows)})`)
say(`2010-2026: ${postRows} rows, ${postBlank} blank (${pct(postBlank / postRows)})`)
say('')

// --- the join: salary row -> mlbId -> debut date -----------------------------
const identity = await j('public/data/contracts-history/identity/salaries.json'.replace(/^/, '../../'))
const idByRowKey = new Map()
for (const e of identity) if (e.mlbId != null) idByRowKey.set(e.rowKey, e.mlbId)

const debuts = await j(local('debuts'))
const debutById = new Map(debuts.map((d) => [d.id, d]))
const calendar = await loadCalendar()

// relDay for a debut: days from the season's service line to the debut date.
// <= 0 means a full service year was still reachable; >= 1 means it was not.
function relDayOf(d) {
  const cal = calendar.get(d.debutSeason)
  if (!cal || cal.excluded) return null
  return dayDiff(d.debutDate, cal.cutoff)
}

let joined = 0
let unmatched = 0
const rowsWithDebut = []
for (const r of salaries) {
  const mlbId = idByRowKey.get(`salaries#${r.__index}`)
  if (mlbId == null) {
    unmatched++
    continue
  }
  const d = debutById.get(mlbId)
  if (!d) continue // debuted outside 2005-2025; no debut date in this cohort
  joined++
  rowsWithDebut.push({
    season: Number(r.year),
    mlbId,
    blank: !r.mls.trim(),
    mls: parseMls(r.mls),
    debutSeason: d.debutSeason,
    relDay: relDayOf(d),
    debutDate: d.debutDate,
  })
}
out.join = {
  salaryRows: totalRows,
  rowsWithNoMlbId: unmatched,
  rowsJoinedToA2005to2025Debut: joined,
}
say('=== the join ===')
say(`salary rows ${totalRows}; no resolved mlbId ${unmatched}; joined to a 2005-2025 debut ${joined}`)
say('')

// --- B. inside the usable window, does blankness track debut timing? ---------
function bucket(relDay) {
  if (relDay == null) return null
  if (relDay <= -1) return 'on or before the line'
  if (relDay <= 0) return 'on or before the line'
  if (relDay <= 30) return 'line +1 to +30'
  return 'line +31 or later'
}

function blankByBucket(rows) {
  const m = new Map()
  for (const r of rows) {
    const b = bucket(r.relDay)
    if (!b) continue
    if (!m.has(b)) m.set(b, { rows: 0, blank: 0 })
    const s = m.get(b)
    s.rows++
    if (r.blank) s.blank++
  }
  return [...m.entries()].map(([k, v]) => ({ bucket: k, ...v, rate: v.blank / v.rows }))
}

const allRows = rowsWithDebut.filter((r) => r.relDay != null)
const modernRows = allRows.filter((r) => r.season >= 2010)

out.testA_fullFile = blankByBucket(allRows)
out.testB_from2010 = blankByBucket(modernRows)

say('=== B1. blank rate by debut timing, FULL FILE (2000-2026 rows) ===')
for (const b of out.testA_fullFile) say(`  ${b.bucket.padEnd(22)} rows ${String(b.rows).padStart(6)} blank ${String(b.blank).padStart(5)} ${pct(b.rate)}`)

// The pooled comparison the gate names: on-or-before the line vs after it.
const preLineAll = allRows.filter((r) => r.relDay <= 0)
const postLineAll = allRows.filter((r) => r.relDay > 0)
const tAll = propTest(
  preLineAll.filter((r) => r.blank).length,
  preLineAll.length,
  postLineAll.filter((r) => r.blank).length,
  postLineAll.length,
)
out.testA_pooled = tAll
say(`  pooled: pre-line ${pct(tAll.p1)} vs post-line ${pct(tAll.p2)}  z=${fmt(tAll.z, 2)} p=${fmt(tAll.p, 4)}`)
say('')

say('=== B2. blank rate by debut timing, 2010-2026 ROWS ONLY ===')
for (const b of out.testB_from2010) say(`  ${b.bucket.padEnd(22)} rows ${String(b.rows).padStart(6)} blank ${String(b.blank).padStart(5)} ${pct(b.rate)}`)
const preLineMod = modernRows.filter((r) => r.relDay <= 0)
const postLineMod = modernRows.filter((r) => r.relDay > 0)
const tMod = propTest(
  preLineMod.filter((r) => r.blank).length,
  preLineMod.length,
  postLineMod.filter((r) => r.blank).length,
  postLineMod.length,
)
out.testB_pooled = tMod
say(`  pooled: pre-line ${pct(tMod.p1)} vs post-line ${pct(tMod.p2)}  z=${fmt(tMod.z, 2)} p=${fmt(tMod.p, 4)}`)
say('')

// The same question asked of the DEBUT SEASON rather than the row season: a
// man who debuted before 2010 carries blank rows for reasons of calendar, and
// pooling him with a 2015 debutant is the confound the gate is about.
const byDebutEra = new Map()
for (const r of allRows) {
  const era = r.debutSeason <= 2009 ? 'debuted 2005-2009' : 'debuted 2010-2025'
  if (!byDebutEra.has(era)) byDebutEra.set(era, { rows: 0, blank: 0 })
  const s = byDebutEra.get(era)
  s.rows++
  if (r.blank) s.blank++
}
out.byDebutEra = [...byDebutEra.entries()].map(([k, v]) => ({ era: k, ...v, rate: v.blank / v.rows }))
say('=== B3. blank rate by DEBUT era (all rows) ===')
for (const b of out.byDebutEra) say(`  ${b.era.padEnd(22)} rows ${String(b.rows).padStart(6)} blank ${String(b.blank).padStart(5)} ${pct(b.rate)}`)
say('')

// --- C. does a man's salary row exist at all, as a function of debut timing? -
// The validation instrument this spike wants from `mls` is: did the man bank a
// full service year in his debut season? That is read off his row in the
// FOLLOWING season. If having such a row depends on when he debuted, the
// instrument is selected even where every cell is filled.
const salaryRowSeasons = new Map() // mlbId -> Set(season)
for (const r of salaries) {
  const mlbId = idByRowKey.get(`salaries#${r.__index}`)
  if (mlbId == null) continue
  if (!salaryRowSeasons.has(mlbId)) salaryRowSeasons.set(mlbId, new Set())
  salaryRowSeasons.get(mlbId).add(Number(r.year))
}

const coverage = []
for (const d of debuts) {
  const cal = calendar.get(d.debutSeason)
  if (!cal || cal.excluded) continue
  // The following-season row must itself be inside the file's window and
  // inside the era where `mls` is populated at all.
  if (d.debutSeason + 1 < 2010 || d.debutSeason + 1 > 2026) continue
  const seasons = salaryRowSeasons.get(d.id)
  const hasNextYearRow = !!seasons?.has(d.debutSeason + 1)
  coverage.push({ id: d.id, relDay: dayDiff(d.debutDate, cal.cutoff), hasNextYearRow })
}

function coverageByBucket(rows) {
  const m = new Map()
  for (const r of rows) {
    const b = bucket(r.relDay)
    if (!b) continue
    if (!m.has(b)) m.set(b, { debuts: 0, withRow: 0 })
    const s = m.get(b)
    s.debuts++
    if (r.hasNextYearRow) s.withRow++
  }
  return [...m.entries()].map(([k, v]) => ({ bucket: k, ...v, rate: v.withRow / v.debuts }))
}
out.testC_coverage = coverageByBucket(coverage)
const preC = coverage.filter((r) => r.relDay <= 0)
const postC = coverage.filter((r) => r.relDay > 0)
const tC = propTest(
  preC.filter((r) => r.hasNextYearRow).length,
  preC.length,
  postC.filter((r) => r.hasNextYearRow).length,
  postC.length,
)
out.testC_pooled = tC
say('=== C. does a following-season salary row exist, by debut timing? ===')
say(`  (debuts 2009-2025 whose following season is 2010-2026; ${coverage.length} men)`)
for (const b of out.testC_coverage) say(`  ${b.bucket.padEnd(22)} debuts ${String(b.debuts).padStart(5)} with a next-year row ${String(b.withRow).padStart(5)} ${pct(b.rate)}`)
say(`  pooled: pre-line ${pct(tC.p1)} vs post-line ${pct(tC.p2)}  z=${fmt(tC.z, 2)} p=${fmt(tC.p, 6)}`)
say('')

await writeFile(local('k0-blank-rate'), JSON.stringify(out, null, 1))
say('wrote k0-blank-rate.json')
