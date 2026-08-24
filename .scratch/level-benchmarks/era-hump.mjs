// Follow-up to org-era-granularity.mjs, which found that days-at-level runs
// 257d -> 324d -> 265d across three era buckets (<=2015 / 2016-2020 /
// 2021-2023) and named the shape "a hump peaking 2016-2020, not the 2021
// contraction." docs/team-movement-windows.md flags WHY that hump exists as
// the biggest open question left in this spike, and points at institutional
// causes (front-office regimes, rule changes, PDL restructuring).
//
// This script asks the prior question first: IS THE HUMP REAL, or is it a
// measurement artifact of how `dates.mjs` builds durations? Same discipline
// the performance pass used when it found the PA/IP volume floor was
// mechanically dropping the fastest promotions -- check the instrument
// before theorizing about the signal.
//
// Three candidate artifacts, each testable with data already on disk:
//
//   A1  TRANSACTION-WIRE LEFT-TRUNCATION. A duration needs BOTH endpoints
//       dated off the wire. statsapi's transaction feed is effectively empty
//       before 2009 (2008: 34 ASG rows; 2009: 9,941 -- a 290x step). So a
//       duration ending in 2009 can only start in 2009, mechanically capping
//       it at one season; 2010 can only reach back to 2009. Both years are
//       therefore biased short by construction, and both sit in bucket A.
//
//   A2  THE LOST 2020 MiLB SEASON. No minor-league games were played in
//       2020. A stint spanning it accrues a full extra year of calendar time
//       with zero baseball in it -- inflating bucket B (durations ending
//       2019/2020) and bucket C (ending 2021).
//
//   A3  THE 900-DAY CAP interacting with A2. dates.mjs drops durations of
//       >=900 days. That filter is not era-neutral: it deletes exactly the
//       COVID-spanning stints A2 inflates, and it deletes most of them in
//       2021 -- pulling bucket C's median DOWN while A2 pushes it up.
//
// Plus two smaller data-quality checks the spike has not made before:
// debut-window censoring (a duration ending in 2023 is only observed if the
// player debuted by 2023, so recent years over-sample fast movers), and
// post-debut contamination (durations resolved from option/rehab assignments
// AFTER the player already debuted -- a different phenomenon than
// development).
//
// Finally, a WIRE-INDEPENDENT cross-check: seasons-at-level and PA/IP-at-
// level, read straight off yearByYear stats with no transaction wire
// involved at all. If the hump is a real development-practice shift it must
// show up there too; if it only exists in wire-dated calendar days, it is an
// instrument artifact.
//
// Output: era-hump.json. Reads dates.json (now stamped with startDate /
// endDate / debutDate by dates.mjs), raw.json, findings.json, txn-cache.json.
// No network calls -- this asks nothing statsapi has not already been asked.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const EOL = String.fromCharCode(10)

// --- numeric primitives (same implementations as org-variance-components.mjs
// and org-era-granularity.mjs; self-tested below before any real data runs) --
function gammaln(x) {
  const g = 7
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaln(1 - x)
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-14, FPMIN = 1e-300
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}
function incompleteBetaRegularized(a, b, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a
  return 1 - (bt * betacf(b, a, 1 - x)) / b
}
function fUpperTailP(F, df1, df2) {
  if (F <= 0) return 1
  return incompleteBetaRegularized(df2 / 2, df1 / 2, df2 / (df2 + df1 * F))
}
function lowerIncompleteGammaRegularized(a, x) {
  if (x <= 0) return 0
  if (x < a + 1) {
    let sum = 1 / a, term = sum, n = a
    for (let i = 0; i < 200; i++) { n += 1; term *= x / n; sum += term; if (Math.abs(term) < Math.abs(sum) * 1e-14) break }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a))
  }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a)
    b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-14) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gammaln(a)) * h
}
function chiSquareUpperTailP(stat, df) {
  if (stat <= 0) return 1
  return 1 - lowerIncompleteGammaRegularized(df / 2, stat / 2)
}

// --- SELF-TESTS: known reference values, before touching real data ----------
// Convention from org-variance-components.mjs -- a wrong tail probability
// would silently turn a null into a finding, so the primitives get checked
// against textbook critical values first.
;(function selfTest() {
  const checks = []
  const near = (label, got, want, tol) => checks.push({ label, got, want, ok: Math.abs(got - want) < tol })
  // chi-square: standard 5% critical values
  near('chi2 p(3.8415, df=1) = 0.05', chiSquareUpperTailP(3.8415, 1), 0.05, 1e-4)
  near('chi2 p(5.9915, df=2) = 0.05', chiSquareUpperTailP(5.9915, 2), 0.05, 1e-4)
  near('chi2 p(18.307, df=10) = 0.05', chiSquareUpperTailP(18.307, 10), 0.05, 1e-4)
  near('chi2 p(42.557, df=29) = 0.05', chiSquareUpperTailP(42.557, 29), 0.05, 1e-4)
  // F distribution: standard 5% critical values
  near('F p(4.9646, 1, 10) = 0.05', fUpperTailP(4.9646, 1, 10), 0.05, 1e-4)
  near('F p(3.3258, 5, 10) = 0.05', fUpperTailP(3.3258, 5, 10), 0.05, 1e-4)
  near('F p(1.0, 10, 10) = 0.5', fUpperTailP(1, 10, 10), 0.5, 1e-9)
  // incomplete beta symmetry identity
  near('I_0.5(0.5,0.5) = 0.5', incompleteBetaRegularized(0.5, 0.5, 0.5), 0.5, 1e-12)
  // cross-check against a result this spike already published: the
  // org-variance-components.mjs omnibus, F(29,1494)=1.824 -> p=0.0048
  near('published omnibus F(29,1494)=1.824 -> p=0.0048', fUpperTailP(1.824, 29, 1494), 0.0048, 5e-4)
  const failed = checks.filter((c) => !c.ok)
  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.label}  (got ${c.got.toExponential(6)})`)
  if (failed.length) throw new Error(`${failed.length} numeric self-test(s) failed -- refusing to run on real data`)
  console.log(`  ${checks.length}/${checks.length} numeric self-tests passed\n`)
})()

// --- helpers ----------------------------------------------------------------
const DAY = 86400000
const asDate = (s) => new Date(s + 'T00:00:00Z')
const daysBetween = (a, b) => Math.round((asDate(b) - asDate(a)) / DAY)
function percentile(sorted, pct) {
  if (!sorted.length) return NaN
  const idx = (sorted.length - 1) * pct
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}
function summarize(values) {
  const s = [...values].sort((a, b) => a - b)
  if (!s.length) return { n: 0 }
  return { n: s.length, p25: Math.round(percentile(s, 0.25)), median: Math.round(percentile(s, 0.5)), p75: Math.round(percentile(s, 0.75)) }
}
const round = (v, d = 4) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null)

// --- load -------------------------------------------------------------------
const dates = JSON.parse(await readFile(join(here, 'dates.json'), 'utf8'))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const findings = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
const disputedIds = new Set(findings.validation.disagree.map((d) => d.playerId))

if (!dates.allDurations[0]?.startDate) {
  throw new Error('dates.json has no startDate -- rerun dates.mjs (it now stamps startDate/endDate/debutDate)')
}

// ============================================================================
// A1 -- transaction-wire coverage, and the left-truncation it forces
// ============================================================================
console.log('=== A1: transaction-wire coverage by season (the truncation floor) ===')
const cache = JSON.parse(await readFile(join(here, 'txn-cache.json'), 'utf8'))
const wireCoverage = []
for (const season of Object.keys(cache).map(Number).sort((a, b) => a - b)) {
  const asg = cache[season].filter((t) => t.typeCode === 'ASG').length
  wireCoverage.push({ season, rows: cache[season].length, asg })
}
for (const w of wireCoverage) {
  if (w.season >= 2003 && w.season <= 2012) console.log(`  ${w.season}  rows=${String(w.rows).padStart(6)}  ASG=${String(w.asg).padStart(6)}`)
}
const asg2008 = wireCoverage.find((w) => w.season === 2008)?.asg ?? 0
const asg2009 = wireCoverage.find((w) => w.season === 2009)?.asg ?? 0
console.log(`  -> ASG rows jump ${asg2008} (2008) -> ${asg2009} (2009): ${Math.round(asg2009 / Math.max(asg2008, 1))}x. The wire effectively starts in 2009.`)

// The direct consequence: how far back can a duration ending in year Y reach?
const universe = [...dates.allDurations, ...dates.droppedLongDurations]
  .filter((d) => !disputedIds.has(d.playerId) && d.days > 0)
console.log(`\n  universe (all dated durations incl. those the 900d cap drops): ${universe.length}`)
console.log('\n  earliest startDate observed among durations ending in year Y:')
const truncation = []
for (const y of [...new Set(universe.map((d) => d.season))].sort()) {
  const rows = universe.filter((d) => d.season === y)
  const starts = rows.map((d) => d.startDate).sort()
  const rec = { season: y, n: rows.length, minStart: starts[0], reachDays: daysBetween(starts[0], `${y}-12-31`) }
  truncation.push(rec)
  if (y <= 2013) console.log(`    ${y}  n=${String(rec.n).padStart(4)}  minStart=${rec.minStart}  (max reachable span ~${rec.reachDays}d)`)
}
// The floor is not a judgement call: it is the first year in which the wire
// stops being the binding constraint and the 900-day cap takes over. A
// duration ending in year Y can span at most (Y-12-31 minus the wire's first
// covered date); while that ceiling sits BELOW the 900d cap, the year's
// durations are shortened by the instrument rather than by behaviour.
// 2009 opening day, the first date the wire covers DENSELY. A few hundred
// stray ASG rows do exist across 1997-2008 (~0.1% of the 2009-2023 volume),
// so a rare duration reaches back further -- the minStart table above shows
// two. The floor describes where coverage becomes usable, not an absolute
// bound, and the two truncated years are identified by the span ceiling
// below rather than by that handful of exceptions.
const WIRE_FIRST_DATE = '2009-03-27'
const asgBefore2009 = wireCoverage.filter((w) => w.season < 2009).reduce((a, w) => a + w.asg, 0)
const asgFrom2009 = wireCoverage.filter((w) => w.season >= 2009).reduce((a, w) => a + w.asg, 0)
console.log(`  ASG rows before 2009: ${asgBefore2009}  vs 2009-2023: ${asgFrom2009}  (${round((asgBefore2009 / asgFrom2009) * 100, 2)}%)`)
console.log(EOL + '  maximum span the wire permits for a duration ending in year Y, vs the 900d cap:')
const wireBound = []
for (const y of [2009, 2010, 2011, 2012]) {
  const maxSpan = daysBetween(WIRE_FIRST_DATE, `${y}-12-31`)
  wireBound.push({ season: y, maxSpanDays: maxSpan, boundBy: maxSpan < 900 ? 'wire' : 'cap' })
  console.log(`    ${y}  max span ${String(maxSpan).padStart(5)}d  -> bound by the ${maxSpan < 900 ? 'WIRE (truncated)' : 'cap (comparable)'}`)
}
console.log('  -> 2009 and 2010 are wire-bound; 2011 onward are cap-bound. That is where')
console.log('     YEAR_FLOOR=2011 comes from -- a measured boundary, not a round number.')

// ============================================================================
// A2/A3 -- the lost 2020 season, and the 900-day cap that deletes it
// ============================================================================
// MiLB played no games in 2020. The 2019 season ended in early September
// 2019; the 2021 season opened in early May 2021. A duration spanning that
// window accrues calendar time with no development in it. Rather than
// subtracting the whole gap (every duration spanning any winter has a normal
// offseason in it too), subtract only the EXTRA year: the would-be 2020
// season, pro-rated by how much of it the duration covers.
const SEASON_2020_START = '2020-04-09' // scheduled MiLB opening day 2020
const SEASON_2020_END = '2020-09-07'   // scheduled regular-season close
const SEASON_2020_LEN = daysBetween(SEASON_2020_START, SEASON_2020_END)
function lostSeasonDays(d) {
  const lo = Math.max(asDate(d.startDate), asDate(SEASON_2020_START))
  const hi = Math.min(asDate(d.endDate), asDate(SEASON_2020_END))
  const overlap = Math.max(0, Math.round((hi - lo) / DAY))
  // a fully-spanned 2020 season costs the player one full year cycle (365d)
  return Math.round(365 * (overlap / SEASON_2020_LEN))
}
for (const d of universe) {
  d.lost = lostSeasonDays(d)
  d.adjDays = d.days - d.lost
  d.postDebut = d.endDate > d.debutDate
  d.lagDays = daysBetween(d.endDate, d.debutDate)
}
console.log('\n=== A2/A3: the lost 2020 season and the 900-day cap ===')
console.log('  year | universe | capped-out | of those, 2020-spanning | median raw | median adj')
for (const y of [2018, 2019, 2020, 2021, 2022, 2023]) {
  const rows = universe.filter((d) => d.season === y)
  const capped = rows.filter((d) => d.days >= 900)
  const cappedCovid = capped.filter((d) => d.lost > 0)
  console.log(
    `  ${y} | ${String(rows.length).padStart(8)} | ${String(capped.length).padStart(10)} | ${String(cappedCovid.length).padStart(23)} | ${String(summarize(rows.map((d) => d.days)).median).padStart(10)} | ${String(summarize(rows.map((d) => d.adjDays)).median).padStart(10)}`,
  )
}
const covidAffected = universe.filter((d) => d.lost > 0)
console.log(`  -> ${covidAffected.length} durations span the would-be 2020 season; ${covidAffected.filter((d) => d.days >= 900).length} of them are deleted outright by the 900d cap.`)
console.log('  -> the cap is not era-neutral: it removes the inflated rows, mostly in 2021,')
console.log('     which pushes bucket C DOWN at the same time A2 pushes it up.')

// ============================================================================
// Specifications: peel the artifacts off one at a time
// ============================================================================
const CAP = 900
const YEAR_FLOOR = 2011 // first year the wire no longer truncates (see A1)
function draftTier(ped) {
  if (!ped?.draftRound) return 'No draft record'
  const r = String(ped.draftRound)
  if (r === '1' || r === '1C' || r === 'CB-A' || r === 'C-A') return 'Round 1'
  const n = Number(r)
  if (!Number.isFinite(n)) return 'Round 1'
  if (n <= 5 || r === '2C' || r === 'CB-B') return 'Rounds 2-5'
  if (n <= 10) return 'Rounds 6-10'
  return 'Round 11+'
}
const playersById = new Map(Object.entries(raw.players).map(([id, p]) => [Number(id), p]))
function era3Of(season) {
  if (season <= 2015) return 'A: <=2015'
  if (season <= 2020) return 'B: 2016-2020'
  return 'C: 2021-2023'
}

// Each spec returns the row set it wants modelled, with the response it wants.
const SPECS = [
  {
    key: 'S0-as-published',
    note: 'exactly what org-era-granularity.mjs modelled: every year, calendar days, 900d cap on calendar days',
    rows: () => universe.filter((d) => d.days < CAP).map((d) => ({ ...d, resp: d.days })),
  },
  {
    key: 'S1-drop-truncated-years',
    note: 'A1 only: drop 2009-2010, whose durations the wire mechanically truncates',
    rows: () => universe.filter((d) => d.days < CAP && d.season >= YEAR_FLOOR).map((d) => ({ ...d, resp: d.days })),
  },
  {
    key: 'S2-drop-covid-rows',
    note: 'A1 + A2/A3 by exclusion: drop every duration spanning the would-be 2020 season. CAVEAT: this introduces a selection bias of its own -- ANY 2021-ending duration longer than ~8 months necessarily spans the dead window, so this spec keeps only the SHORT 2021 stints. Reported for completeness; S3/S5 are the trustworthy COVID handlings.',
    rows: () => universe.filter((d) => d.days < CAP && d.season >= YEAR_FLOOR && d.lost === 0).map((d) => ({ ...d, resp: d.days })),
  },
  {
    key: 'S3-lost-season-adjusted',
    note: 'A1 + A2/A3 by adjustment: subtract the pro-rated lost 2020 season, then apply the 900d cap to ADJUSTED days (so COVID-spanning rows re-enter instead of being deleted)',
    rows: () => universe.filter((d) => d.adjDays > 0 && d.adjDays < CAP && d.season >= YEAR_FLOOR).map((d) => ({ ...d, resp: d.adjDays })),
  },
  {
    key: 'S5-drop-disrupted-years',
    note: 'A1 + A2/A3 with NO adjustment assumption at all: drop end-years 2020 and 2021 outright (the only two years where COVID makes any calendar-day figure a judgement call) and keep every other year on raw calendar days',
    rows: () => universe.filter((d) => d.days < CAP && d.season >= YEAR_FLOOR && d.season !== 2020 && d.season !== 2021).map((d) => ({ ...d, resp: d.days })),
  },
  {
    key: 'S4-also-drop-post-debut',
    note: 'S3 + drop durations resolved from assignments AFTER the player already debuted (option/rehab shuttling, not development)',
    rows: () => universe.filter((d) => d.adjDays > 0 && d.adjDays < CAP && d.season >= YEAR_FLOOR && !d.postDebut).map((d) => ({ ...d, resp: d.adjDays })),
  },
]

// --- OLS machinery (same as org-era-granularity.mjs) ------------------------
function matTMat(X) { const p = X[0].length; const M = Array.from({ length: p }, () => new Array(p).fill(0)); for (const row of X) for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) M[i][j] += row[i] * row[j]; return M }
function matTVec(X, y) { const p = X[0].length; const v = new Array(p).fill(0); for (let k = 0; k < X.length; k++) for (let i = 0; i < p; i++) v[i] += X[k][i] * y[k]; return v }
function invert(M) {
  const n = M.length
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r
    if (Math.abs(A[pivot][col]) < 1e-12) throw new Error(`singular at col ${col}`)
    ;[A[col], A[pivot]] = [A[pivot], A[col]]
    const pv = A[col][col]
    for (let j = 0; j < 2 * n; j++) A[col][j] /= pv
    for (let r = 0; r < n; r++) { if (r === col) continue; const f = A[r][col]; if (f === 0) continue; for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j] }
  }
  return A.map((row) => row.slice(n))
}
function fitOLS(X, y) {
  const XtX = matTMat(X), XtXinv = invert(XtX), Xty = matTVec(X, y)
  const beta = XtXinv.map((row) => row.reduce((s, v, i) => s + v * Xty[i], 0))
  const yhat = X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0))
  const resid = y.map((v, i) => v - yhat[i])
  const ssRes = resid.reduce((s, e) => s + e * e, 0)
  const mean = y.reduce((a, b) => a + b, 0) / y.length
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0)
  return { beta, XtXinv, resid, ssRes, r2: 1 - ssRes / ssTot, n: X.length, p: X[0].length }
}
function clusterRobustCov(X, resid, clusterIds, XtXinv) {
  const p = X[0].length
  const byCluster = new Map()
  for (let i = 0; i < X.length; i++) {
    const key = clusterIds[i]
    if (!byCluster.has(key)) byCluster.set(key, new Array(p).fill(0))
    const acc = byCluster.get(key)
    for (let j = 0; j < p; j++) acc[j] += X[i][j] * resid[i]
  }
  const meat = Array.from({ length: p }, () => new Array(p).fill(0))
  for (const acc of byCluster.values()) for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) meat[i][j] += acc[i] * acc[j]
  const bm = XtXinv.map((row) => { const out = new Array(p).fill(0); for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) out[j] += row[k] * meat[k][j]; return out })
  const cov = bm.map((row) => { const out = new Array(p).fill(0); for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) out[j] += row[k] * XtXinv[k][j]; return out })
  const G = byCluster.size, n = X.length
  const c = (G / (G - 1)) * ((n - 1) / (n - p))
  return { covAdj: cov.map((row) => row.map((v) => v * c)), G }
}
function jointWaldF(betaBlock, covBlock, dfDenom) {
  const covInv = invert(covBlock)
  let W = 0
  for (let i = 0; i < betaBlock.length; i++) for (let j = 0; j < betaBlock.length; j++) W += betaBlock[i] * covInv[i][j] * betaBlock[j]
  const dfNum = betaBlock.length, F = W / dfNum
  return { W, dfNum, dfDenom, F, p: fUpperTailP(F, dfNum, dfDenom) }
}
// Kruskal-Wallis: a rank-based era test that assumes no transform at all,
// so it cannot be an artifact of modelling log(days).
function kruskalWallis(groups) {
  const all = []
  groups.forEach((g, gi) => g.forEach((v) => all.push({ v, gi })))
  all.sort((a, b) => a.v - b.v)
  const ranks = new Array(all.length)
  let i = 0
  while (i < all.length) {
    let j = i
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[k] = avg
    i = j + 1
  }
  const N = all.length
  const sums = new Array(groups.length).fill(0), ns = groups.map((g) => g.length)
  all.forEach((a, idx) => { sums[a.gi] += ranks[idx] })
  let H = 0
  for (let g = 0; g < groups.length; g++) if (ns[g]) H += sums[g] ** 2 / ns[g]
  H = (12 / (N * (N + 1))) * H - 3 * (N + 1)
  const df = groups.length - 1
  return { H, df, p: chiSquareUpperTailP(H, df) }
}

const eras = ['A: <=2015', 'B: 2016-2020', 'C: 2021-2023']
const tiers = ['Round 1', 'Rounds 2-5', 'Rounds 6-10', 'Round 11+', 'No draft record']

function runSpec(spec) {
  const rows = spec.rows().map((d) => ({
    ...d,
    tier: draftTier(playersById.get(d.playerId)?.ped),
    era3: era3Of(d.season),
    logResp: Math.log(d.resp),
  }))
  const levels = ['A', 'High-A', 'AA', 'AAA'].filter((l) => rows.some((r) => r.level === l))
  const levelRef = levels[0], tierRef = tiers[tiers.length - 1], eraRef = eras[0]
  const levelCols = levels.filter((l) => l !== levelRef)
  const tierCols = tiers.filter((t) => t !== tierRef)
  const eraCols = eras.filter((e) => e !== eraRef)
  const design = (r) => {
    const row = [1]
    for (const l of levelCols) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
    for (const t of tierCols) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
    for (const e of eraCols) row.push(r.era3 === e ? 1 : r.era3 === eraRef ? -1 : 0)
    return row
  }
  const X = rows.map(design), y = rows.map((r) => r.logResp)
  const fit = fitOLS(X, y)
  const { covAdj, G } = clusterRobustCov(X, fit.resid, rows.map((r) => r.playerId), fit.XtXinv)
  const eraStart = 1 + levelCols.length + tierCols.length
  const eraBetaBlock = eraCols.map((_, i) => fit.beta[eraStart + i])
  const eraCovBlock = eraCols.map((_, i) => eraCols.map((_, j) => covAdj[eraStart + i][eraStart + j]))
  const omnibus = jointWaldF(eraBetaBlock, eraCovBlock, G - fit.p)
  const refBeta = -eraBetaBlock.reduce((s, b) => s + b, 0)
  const eraEffects = eras.map((e, i) => ({
    era: e,
    pct: round(((Math.exp(i === 0 ? refBeta : eraBetaBlock[i - 1]) - 1) * 100), 1),
  }))
  const rawByEra = eras.map((e) => summarize(rows.filter((r) => r.era3 === e).map((r) => r.resp)))
  const kw = kruskalWallis(eras.map((e) => rows.filter((r) => r.era3 === e).map((r) => r.resp)))
  const byYear = [...new Set(rows.map((r) => r.season))].sort().map((season) => ({ season, ...summarize(rows.filter((r) => r.season === season).map((r) => r.resp)) }))
  return { key: spec.key, note: spec.note, n: fit.n, clusters: G, r2: round(fit.r2), rawByEra: eras.map((e, i) => ({ era: e, ...rawByEra[i] })), eraEffects, omnibusWaldF: { F: round(omnibus.F, 3), dfNum: omnibus.dfNum, dfDenom: omnibus.dfDenom, p: round(omnibus.p) }, kruskalWallis: { H: round(kw.H, 3), df: kw.df, p: round(kw.p) }, byYear }
}

console.log('\n=== Specifications: is the hump still there once each artifact is peeled off? ===')
const specResults = SPECS.map(runSpec)
for (const r of specResults) {
  console.log(`\n  ${r.key}  (n=${r.n}, ${r.clusters} players, R^2=${r.r2})`)
  console.log(`    ${r.note}`)
  console.log(`    raw days by era        : ${r.rawByEra.map((e) => `${e.era.split(':')[0]}=${e.median} [${e.p25}-${e.p75}]`).join('  ')}   (n=${r.rawByEra.map((e) => e.n).join('/')})`)
  console.log(`    model-adjusted era eff : ${r.eraEffects.map((e) => `${e.era.split(':')[0]}=${e.pct > 0 ? '+' : ''}${e.pct}%`).join('  ')}`)
  console.log(`    era omnibus Wald       : F(${r.omnibusWaldF.dfNum},${r.omnibusWaldF.dfDenom})=${r.omnibusWaldF.F}, p=${r.omnibusWaldF.p}`)
  console.log(`    Kruskal-Wallis (ranks) : H(${r.kruskalWallis.df})=${r.kruskalWallis.H}, p=${r.kruskalWallis.p}`)
}

console.log('\n=== Per-year medians, as-published vs fully corrected ===')
const s0 = specResults.find((r) => r.key === 'S0-as-published')
const s3 = specResults.find((r) => r.key === 'S3-lost-season-adjusted')
console.log('  year |    S0 n | S0 median |    S3 n | S3 median')
for (const y of [...new Set([...s0.byYear, ...s3.byYear].map((r) => r.season))].sort()) {
  const a = s0.byYear.find((r) => r.season === y), b = s3.byYear.find((r) => r.season === y)
  console.log(`  ${y} | ${String(a?.n ?? '-').padStart(7)} | ${String(a?.median ?? '-').padStart(9)} | ${String(b?.n ?? '-').padStart(7)} | ${String(b?.median ?? '-').padStart(9)}`)
}

// ============================================================================
// Debut-window censoring: a duration ending in year Y is only observed if the
// player debuted by 2023, so recent years cannot contain slow movers at all.
// ============================================================================
console.log('\n=== Debut-window censoring: how much room does each end-year have? ===')
const censor = []
for (const y of [...new Set(universe.map((d) => d.season))].sort()) {
  const rows = universe.filter((d) => d.season === y && d.lagDays >= 0)
  const lags = rows.map((d) => d.lagDays).sort((a, b) => a - b)
  censor.push({ season: y, n: rows.length, headroomDays: daysBetween(`${y}-12-31`, '2023-12-31'), medianLag: Math.round(percentile(lags, 0.5)), p90Lag: Math.round(percentile(lags, 0.9)) })
}
console.log('  year | n | headroom to 2023 (d) | median lag to debut | p90 lag')
for (const c of censor) console.log(`  ${c.season} | ${String(c.n).padStart(4)} | ${String(c.headroomDays).padStart(20)} | ${String(c.medianLag).padStart(19)} | ${String(c.p90Lag).padStart(7)}`)
// Harmonised test: give every end-year the SAME observation window (a fixed
// lag budget), so the recent years are no longer advantaged.
const LAG_BUDGET = 730 // 2 years
const harmonised = universe.filter((d) => d.adjDays > 0 && d.adjDays < CAP && d.season >= YEAR_FLOOR && d.season <= 2021 && d.lagDays >= 0 && d.lagDays <= LAG_BUDGET)
const harmByEra = eras.map((e) => ({ era: e, ...summarize(harmonised.filter((d) => era3Of(d.season) === e).map((d) => d.adjDays)) }))
const harmKw = kruskalWallis(eras.map((e) => harmonised.filter((d) => era3Of(d.season) === e).map((d) => d.adjDays)))
console.log(`\n  harmonised window (end-year 2011-2021, lag to debut <= ${LAG_BUDGET}d, lost-season adjusted): n=${harmonised.length}`)
console.log(`    median by era: ${harmByEra.map((e) => `${e.era.split(':')[0]}=${e.median} (n=${e.n})`).join('  ')}`)
console.log(`    Kruskal-Wallis H(${harmKw.df})=${round(harmKw.H, 3)}, p=${round(harmKw.p)}`)

// ============================================================================
// Wire-independent cross-check: seasons-at-level and PA/IP-at-level, read
// straight off yearByYear. No transaction wire anywhere in this measurement,
// so none of A1/A2/A3 can touch it.
// ============================================================================
console.log('\n=== Wire-independent cross-check: seasons-at-level from yearByYear ===')
const LEVEL_RANK = { 14: 1, 13: 2, 12: 3, 11: 4 }
const LEVEL_NAME = { 14: 'A', 13: 'High-A', 12: 'AA', 11: 'AAA' }
function ipToOuts(ip) {
  if (ip == null) return 0
  const n = Number(ip)
  if (!Number.isFinite(n)) return 0
  const whole = Math.floor(n)
  return whole * 3 + Math.round((n - whole) * 10)
}
const wireFree = []
for (const [idStr, p] of Object.entries(raw.players)) {
  const id = Number(idStr)
  if (disputedIds.has(id)) continue
  if (p.group !== 'hitting' && p.group !== 'pitching') continue
  const debutYear = Number(p.debutDate.slice(0, 4))
  const rows = p.milb.filter((r) => Number.isInteger(r.season) && r.season <= debutYear && LEVEL_RANK[r.sportId])
  if (!rows.length) continue
  const bySport = new Map()
  for (const r of rows) {
    if (!bySport.has(r.sportId)) bySport.set(r.sportId, [])
    bySport.get(r.sportId).push(r)
  }
  // mirror the durations' scope: a player's FIRST level has no dated arrival,
  // so the duration data covers 2nd level onward only. Same restriction here.
  const firstRank = Math.min(...[...bySport.keys()].map((s) => LEVEL_RANK[s]))
  for (const [sportId, rs] of bySport) {
    if (LEVEL_RANK[sportId] === firstRank) continue
    const seasons = [...new Set(rs.map((r) => r.season))].sort()
    const volume = p.group === 'hitting'
      ? rs.reduce((s, r) => s + (r.stat?.plateAppearances ?? 0), 0)
      : rs.reduce((s, r) => s + ipToOuts(r.stat?.inningsPitched), 0) / 3
    wireFree.push({ playerId: id, level: LEVEL_NAME[sportId], group: p.group, firstSeason: Math.min(...seasons), nSeasons: seasons.length, volume, debutYear })
  }
}
console.log(`  (player, level) pairs, 2nd level onward, pre-debut seasons only: ${wireFree.length}`)
console.log('  firstSeason | n | median seasons at level | median PA (hitters) | median IP (pitchers)')
const wireFreeByYear = []
for (const y of [...new Set(wireFree.map((r) => r.firstSeason))].sort()) {
  if (y < 2005 || y > 2023) continue
  const rs = wireFree.filter((r) => r.firstSeason === y)
  if (rs.length < 15) continue
  const hit = rs.filter((r) => r.group === 'hitting').map((r) => r.volume)
  const pit = rs.filter((r) => r.group === 'pitching').map((r) => r.volume)
  const rec = { firstSeason: y, n: rs.length, medianSeasons: round(percentile(rs.map((r) => r.nSeasons).sort((a, b) => a - b), 0.5), 2), meanSeasons: round(rs.reduce((s, r) => s + r.nSeasons, 0) / rs.length, 3), medianPA: Math.round(percentile(hit.sort((a, b) => a - b), 0.5)), medianIP: round(percentile(pit.sort((a, b) => a - b), 0.5), 1) }
  wireFreeByYear.push(rec)
  console.log(`  ${rec.firstSeason}       | ${String(rec.n).padStart(4)} | ${String(rec.meanSeasons).padStart(23)} | ${String(rec.medianPA).padStart(19)} | ${String(rec.medianIP).padStart(20)}`)
}
// Does the wire-free measure hump in 2016-2020? Compare arrival-era buckets.
// Restrict to firstSeason <= 2020: later arrivals are truncated by the 2023
// debut cutoff (they have not had time to accumulate seasons at the level).
// The comparison window stops at 2018 on BOTH sides, and that boundary is
// forced rather than chosen: this metric counts SEASONS at a level, and 2020
// had no minor-league season to count. Anyone whose stay reached into 2020 is
// missing a countable season mechanically -- which deflates arrivals from
// 2019 on (the 2019 row above reads 1.137 seasons against a 1.44-1.63 band
// everywhere else: exactly that artifact, and a useful sanity check that the
// metric behaves as expected). The 2023 debut cutoff censors recent arrivals
// on top of it. Capping at 2018 keeps a typical 1-2 season stay clear of
// both, at the cost of not covering 2019-2020 -- an honest gap, and the
// reason this check can speak to the RISE into 2016-2018 but not to 2019-20.
const wfEras = [
  { era: 'A: arrive 2011-2015', rows: wireFree.filter((r) => r.firstSeason >= 2011 && r.firstSeason <= 2015) },
  { era: 'B: arrive 2016-2018', rows: wireFree.filter((r) => r.firstSeason >= 2016 && r.firstSeason <= 2018) },
]
const wfSummary = wfEras.map((e) => ({ era: e.era, n: e.rows.length, meanSeasons: round(e.rows.reduce((s, r) => s + r.nSeasons, 0) / e.rows.length, 3), medianVolumeHit: Math.round(percentile(e.rows.filter((r) => r.group === 'hitting').map((r) => r.volume).sort((a, b) => a - b), 0.5)) }))
const wfKw = kruskalWallis(wfEras.map((e) => e.rows.map((r) => r.nSeasons)))
console.log(`\n  arrival-era comparison (wire-free; 2019+ excluded, see comment):`)
for (const s of wfSummary) console.log(`    ${s.era.padEnd(22)} n=${String(s.n).padStart(4)}  mean seasons-at-level=${s.meanSeasons}  median PA (hitters)=${s.medianVolumeHit}`)
console.log(`    Kruskal-Wallis on seasons-at-level: H(${wfKw.df})=${round(wfKw.H, 3)}, p=${round(wfKw.p)}`)

// ============================================================================
// The residual: does what survives correction track the INSTRUMENT rather
// than behaviour? The wire more than doubled in density across the window
// (13,731 ASG rows in 2011 -> 27,284 in 2019). Denser coverage means a
// player's true arrival at a level is likelier to be caught; a MISSED arrival
// makes the resolver fall through to a later event and understate the
// duration. So thinner early coverage predicts shorter early durations --
// the exact residual shape left after A1/A2/A3 are removed.
// ============================================================================
function pearson(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy }
  return sxy / Math.sqrt(sxx * syy)
}
function spearman(xs, ys) {
  const rank = (v) => { const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]); const r = new Array(v.length); idx.forEach(([, i], k) => { r[i] = k + 1 }); return r }
  return pearson(rank(xs), rank(ys))
}
console.log(EOL + '=== The residual vs wire density (2011-2019, COVID years excluded) ===')
const s5 = specResults.find((r) => r.key === 'S5-drop-disrupted-years')
const densYears = s5.byYear.filter((r) => r.season >= 2011 && r.season <= 2019)
const dens = densYears.map((r) => wireCoverage.find((w) => w.season === r.season)?.asg ?? 0)
const meds = densYears.map((r) => r.median)
console.log('  year | ASG rows on the wire | median days-at-level')
densYears.forEach((r, i) => console.log(`  ${r.season} | ${String(dens[i]).padStart(20)} | ${String(meds[i]).padStart(20)}`))
const rP = pearson(dens, meds), rS = spearman(dens, meds)
console.log(`  Pearson r = ${round(rP, 3)}   Spearman rho = ${round(rS, 3)}  (n=${densYears.length} years)`)
console.log('  CAVEAT: wire density is very nearly monotone in year, so this correlation')
console.log('  cannot separate "denser wire -> longer measured durations" from any other')
console.log('  monotone trend over the same nine years. It is CONSISTENT WITH the')
console.log('  instrument explanation, not proof of it. The wire-free check above is the')
console.log('  test that actually discriminates, and it shows no rise at all.')

// ============================================================================
// Post-debut contamination (reported, and its era profile checked)
// ============================================================================
const postDebutRows = universe.filter((d) => d.postDebut)
console.log('\n=== Post-debut contamination ===')
console.log(`  ${postDebutRows.length} of ${universe.length} durations (${round((postDebutRows.length / universe.length) * 100, 1)}%) end AFTER the player's MLB debut`)
console.log('  -- resolved from option/rehab assignments, not a development stay.')
const postByYear = [...new Set(universe.map((d) => d.season))].sort().map((season) => {
  const all = universe.filter((d) => d.season === season)
  return { season, n: all.length, postDebut: all.filter((d) => d.postDebut).length, pct: round((all.filter((d) => d.postDebut).length / all.length) * 100, 1) }
})
console.log(`  share by year: ${postByYear.map((r) => `${r.season}=${r.pct}%`).join(' ')}`)

// --- write ------------------------------------------------------------------
await writeFile(
  join(here, 'era-hump.json'),
  JSON.stringify(
    {
      generatedFrom: 'dates.json (startDate/endDate stamped), raw.json, findings.json, txn-cache.json',
      universeN: universe.length,
      a1WireTruncation: { wireFirstDate: WIRE_FIRST_DATE, asgBefore2009, asgFrom2009, wireCoverage, wireBound, truncation: truncation.filter((t) => t.season <= 2014) },
      a2LostSeason: { window: { start: SEASON_2020_START, end: SEASON_2020_END }, affectedDurations: covidAffected.length, deletedByCap: covidAffected.filter((d) => d.days >= CAP).length },
      specs: specResults,
      debutCensoring: { lagBudgetDays: LAG_BUDGET, byYear: censor, harmonised: { n: harmonised.length, byEra: harmByEra, kruskalWallis: { H: round(harmKw.H, 3), df: harmKw.df, p: round(harmKw.p) } } },
      wireIndependent: { pairs: wireFree.length, byArrivalSeason: wireFreeByYear, byArrivalEra: wfSummary, kruskalWallis: { H: round(wfKw.H, 3), df: wfKw.df, p: round(wfKw.p) } },
      residualVsWireDensity: { years: densYears.map((r, i) => ({ season: r.season, asgRows: dens[i], medianDays: r.median })), pearson: round(rP, 3), spearman: round(rS, 3), caveat: 'wire density is near-monotone in year; consistent with the instrument explanation, not proof of it' },
      postDebutContamination: { n: postDebutRows.length, pct: round((postDebutRows.length / universe.length) * 100, 1), byYear: postByYear },
    },
    null,
    2,
  ),
)
console.log('\nwrote era-hump.json')
