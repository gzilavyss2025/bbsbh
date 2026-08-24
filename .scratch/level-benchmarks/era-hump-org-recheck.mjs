// era-hump.mjs found that the "2016-2020 hump" in days-at-level is mostly an
// instrument artifact: transaction-wire left-truncation in 2009-2010, the
// lost 2020 MiLB season, and the 900-day cap deleting the stints that season
// inflated. That has a knock-on this spike has to check rather than assume.
//
// org-variance-components.mjs built its headline org results -- the
// cluster-robust omnibus Wald test, the ICC, and the empirical-Bayes shrunk
// per-org estimates -- on the SAME rows those artifacts contaminate, and used
// era as a control on top. Two questions follow:
//
//   Q1  Does the org signal survive on the corrected row set? If the
//       artifacts are unevenly spread across orgs (and org x era already
//       rejects independence at chi2(29)=85.9, so they might be), the
//       published F(29,1494)=1.824, p=0.0048 and ICC=1.2% could be partly
//       measuring which orgs happen to have rows in the truncated or
//       COVID-mangled years.
//
//   Q2  Does Tampa Bay -- "the only org significant across all seven
//       specifications," the single closest thing to a per-org finding
//       anywhere in this spike -- survive too?
//
// This refits the org block on each corrected specification and compares,
// number for number, against what the doc currently publishes. It changes no
// prior conclusion by itself; it reports whether the prior conclusions still
// hold once the rows are cleaned.
//
// Output: era-hump-org-recheck.json. Needs the 52-call historical team->org
// sweep (same one team-windows.mjs / org-regression.mjs / org-era-
// granularity.mjs use), so unlike era-hump.mjs this one does hit statsapi.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const EOL = String.fromCharCode(10)

// --- numeric primitives (identical to org-variance-components.mjs) ----------
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
function erf(x) {
  const s = x < 0 ? -1 : 1
  x = Math.abs(x)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return s * y
}
const normalTwoSidedP = (z) => 1 - erf(Math.abs(z) / Math.SQRT2)

// --- SELF-TESTS before any real data ---------------------------------------
;(function selfTest() {
  const checks = []
  const near = (label, got, want, tol) => checks.push({ label, got, ok: Math.abs(got - want) < tol })
  near('F p(4.9646, 1, 10) = 0.05', fUpperTailP(4.9646, 1, 10), 0.05, 1e-4)
  near('F p(3.3258, 5, 10) = 0.05', fUpperTailP(3.3258, 5, 10), 0.05, 1e-4)
  near('F p(1.0, 10, 10) = 0.5', fUpperTailP(1, 10, 10), 0.5, 1e-9)
  near('I_0.5(0.5,0.5) = 0.5', incompleteBetaRegularized(0.5, 0.5, 0.5), 0.5, 1e-12)
  near('two-sided p(z=1.96) = 0.05', normalTwoSidedP(1.96), 0.05, 1e-4)
  near('two-sided p(z=2.576) = 0.01', normalTwoSidedP(2.576), 0.01, 1e-4)
  // reproduce two results this spike already published, as end-to-end checks
  near('published omnibus Wald F(29,1494)=1.824 -> p=0.0048', fUpperTailP(1.824, 29, 1494), 0.0048, 5e-4)
  near('published ANOVA F(29,1677)=1.685 -> p=0.0128', fUpperTailP(1.685, 29, 1677), 0.0128, 5e-4)
  const failed = checks.filter((c) => !c.ok)
  for (const c of checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.label}  (got ${c.got.toExponential(6)})`)
  if (failed.length) throw new Error(`${failed.length} numeric self-test(s) failed -- refusing to run on real data`)
  console.log(`  ${checks.length}/${checks.length} numeric self-tests passed${EOL}`)
})()

// --- OLS machinery (identical to org-era-granularity.mjs) -------------------
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
const round = (v, d = 4) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null)

// --- rows -------------------------------------------------------------------
const dates = JSON.parse(await readFile(join(here, 'dates.json'), 'utf8'))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const findings = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
const disputedIds = new Set(findings.validation.disagree.map((d) => d.playerId))
if (!dates.allDurations[0]?.startDate) throw new Error('dates.json has no startDate -- rerun dates.mjs')

const DAY = 86400000
const asDate = (s) => new Date(s + 'T00:00:00Z')
const daysBetween = (a, b) => Math.round((asDate(b) - asDate(a)) / DAY)
const SEASON_2020_START = '2020-04-09', SEASON_2020_END = '2020-09-07'
const SEASON_2020_LEN = daysBetween(SEASON_2020_START, SEASON_2020_END)
const universe = [...dates.allDurations, ...dates.droppedLongDurations].filter((d) => !disputedIds.has(d.playerId) && d.days > 0)
for (const d of universe) {
  const lo = Math.max(asDate(d.startDate), asDate(SEASON_2020_START))
  const hi = Math.min(asDate(d.endDate), asDate(SEASON_2020_END))
  d.lost = Math.round(365 * (Math.max(0, Math.round((hi - lo) / DAY)) / SEASON_2020_LEN))
  d.adjDays = d.days - d.lost
}
const CAP = 900, YEAR_FLOOR = 2011

const SPECS = [
  { key: 'S0-as-published', note: 'the rows org-variance-components.mjs actually used', rows: () => universe.filter((d) => d.days < CAP).map((d) => ({ ...d, resp: d.days })) },
  { key: 'S3-lost-season-adjusted', note: 'drop the wire-truncated years, subtract the lost 2020 season, cap on adjusted days', rows: () => universe.filter((d) => d.adjDays > 0 && d.adjDays < CAP && d.season >= YEAR_FLOOR).map((d) => ({ ...d, resp: d.adjDays })) },
  { key: 'S5-drop-disrupted-years', note: 'drop the wire-truncated years AND end-years 2020/2021 outright -- no COVID adjustment assumed anywhere', rows: () => universe.filter((d) => d.days < CAP && d.season >= YEAR_FLOOR && d.season !== 2020 && d.season !== 2021).map((d) => ({ ...d, resp: d.days })) },
]

// --- historical team -> org sweep (same 52 calls as the other org scripts) ---
const SPORT_IDS = [11, 12, 13, 14]
const SEASONS = Array.from({ length: 2023 - 2005 + 1 }, (_, i) => 2005 + i).filter((y) => y !== 2020)
async function buildHistoricalOrgMap() {
  const map = new Map()
  const jobs = []
  for (const sportId of SPORT_IDS) for (const season of SEASONS) jobs.push({ sportId, season })
  let cursor = 0
  async function worker() {
    while (cursor < jobs.length) {
      const { sportId, season } = jobs[cursor++]
      const data = await getJson(`/api/v1/teams?sportId=${sportId}&season=${season}`)
      for (const t of data.teams ?? []) { if (!t.parentOrgId) continue; map.set(`${t.id}:${season}`, { orgId: t.parentOrgId, orgName: t.parentOrgName || '' }) }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return map
}
console.log('sweeping historical team->org map (52 calls)...')
const orgMap = await buildHistoricalOrgMap()
const playersById = new Map(Object.entries(raw.players).map(([id, p]) => [Number(id), p]))
const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }
function orgForDuration(playerId, level, season) {
  const p = playersById.get(playerId)
  if (!p) return null
  const rows = p.milb.filter((r) => r.sportId === LEVEL_SPORT[level])
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) if (Math.abs(r.season - season) < Math.abs(best.season - season)) best = r
  return orgMap.get(`${best.teamId}:${best.season}`) || null
}
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
const ORG_MIN_N = 20
const tiers = ['Round 1', 'Rounds 2-5', 'Rounds 6-10', 'Round 11+', 'No draft record']

function runSpec(spec) {
  const built = []
  for (const d of spec.rows()) {
    const org = orgForDuration(d.playerId, d.level, d.season)
    if (!org) continue
    built.push({ playerId: d.playerId, orgId: org.orgId, orgName: org.orgName, level: d.level, tier: draftTier(playersById.get(d.playerId)?.ped), logResp: Math.log(d.resp) })
  }
  const counts = new Map()
  for (const r of built) counts.set(r.orgId, (counts.get(r.orgId) || 0) + 1)
  const keptRows = built.filter((r) => counts.get(r.orgId) >= ORG_MIN_N)
  const droppedOrgs = [...new Set(built.map((r) => r.orgId))].length - [...new Set(keptRows.map((r) => r.orgId))].length

  const levels = ['A', 'High-A', 'AA', 'AAA'].filter((l) => keptRows.some((r) => r.level === l))
  const orgIds = [...new Set(keptRows.map((r) => r.orgId))].sort((a, b) => a - b)
  const orgNameById = new Map(keptRows.map((r) => [r.orgId, r.orgName]))
  const levelRef = levels[0], tierRef = tiers[tiers.length - 1], orgRef = orgIds[orgIds.length - 1]
  const levelCols = levels.filter((l) => l !== levelRef)
  const tierCols = tiers.filter((t) => t !== tierRef)
  const orgCols = orgIds.filter((o) => o !== orgRef)
  const design = (r) => {
    const row = [1]
    for (const l of levelCols) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
    for (const t of tierCols) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
    for (const o of orgCols) row.push(r.orgId === o ? 1 : r.orgId === orgRef ? -1 : 0)
    return row
  }
  const X = keptRows.map(design), y = keptRows.map((r) => r.logResp)
  const fit = fitOLS(X, y)
  const { covAdj, G } = clusterRobustCov(X, fit.resid, keptRows.map((r) => r.playerId), fit.XtXinv)
  const orgStart = 1 + levelCols.length + tierCols.length
  const orgBetaBlock = orgCols.map((_, i) => fit.beta[orgStart + i])
  const orgCovBlock = orgCols.map((_, i) => orgCols.map((_, j) => covAdj[orgStart + i][orgStart + j]))
  const omnibus = jointWaldF(orgBetaBlock, orgCovBlock, G - fit.p)

  // per-org effects, including the effect-coded reference org recovered as
  // -sum(others) with its variance from the full covariance submatrix
  const perOrg = orgCols.map((o, i) => {
    const b = orgBetaBlock[i], se = Math.sqrt(orgCovBlock[i][i])
    return { orgId: o, name: orgNameById.get(o), beta: b, se, z: b / se, p: normalTwoSidedP(b / se), pct: round((Math.exp(b) - 1) * 100, 1) }
  })
  const refBeta = -orgBetaBlock.reduce((s, b) => s + b, 0)
  let refVar = 0
  for (let i = 0; i < orgCols.length; i++) for (let j = 0; j < orgCols.length; j++) refVar += orgCovBlock[i][j]
  const refSE = Math.sqrt(refVar)
  perOrg.push({ orgId: orgRef, name: orgNameById.get(orgRef), beta: refBeta, se: refSE, z: refBeta / refSE, p: normalTwoSidedP(refBeta / refSE), pct: round((Math.exp(refBeta) - 1) * 100, 1) })
  // Benjamini-Hochberg at q=0.05
  const sortedP = [...perOrg].sort((a, b) => a.p - b.p)
  const m = sortedP.length
  let maxK = 0
  sortedP.forEach((r, idx) => { if (r.p <= ((idx + 1) / m) * 0.05) maxK = idx + 1 })
  const bhSet = new Set(sortedP.slice(0, maxK).map((r) => r.orgId))
  for (const r of perOrg) r.bh = bhSet.has(r.orgId)
  const sigUncorrected = perOrg.filter((r) => r.p < 0.05)

  // player-collapsed one-way variance components (same construction as
  // org-variance-components.mjs section 3, minus the era term -- era is now
  // known to be largely instrument artifact, and these rows have it removed
  // at the source instead of modelled around)
  const designNoOrg = (r) => {
    const row = [1]
    for (const l of levelCols) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
    for (const t of tierCols) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
    return row
  }
  const fitNoOrg = fitOLS(keptRows.map(designNoOrg), y)
  const pairResid = new Map()
  keptRows.forEach((r, i) => {
    const key = `${r.orgId}:${r.playerId}`
    if (!pairResid.has(key)) pairResid.set(key, { orgId: r.orgId, sum: 0, count: 0 })
    const e = pairResid.get(key)
    e.sum += fitNoOrg.resid[i]; e.count++
  })
  const pairs = [...pairResid.values()].map((e) => ({ orgId: e.orgId, resid: e.sum / e.count }))
  const byOrg = new Map()
  for (const pr of pairs) { if (!byOrg.has(pr.orgId)) byOrg.set(pr.orgId, []); byOrg.get(pr.orgId).push(pr.resid) }
  const N = pairs.length, q = byOrg.size
  const grandMean = pairs.reduce((s, pr) => s + pr.resid, 0) / N
  let SSB = 0, SSW = 0, sumNj2overN = 0
  for (const vals of byOrg.values()) {
    const nj = vals.length, meanj = vals.reduce((a, b) => a + b, 0) / nj
    SSB += nj * (meanj - grandMean) ** 2
    for (const v of vals) SSW += (v - meanj) ** 2
    sumNj2overN += (nj * nj) / N
  }
  const dfB = q - 1, dfW = N - q
  const MSB = SSB / dfB, MSW = SSW / dfW, Fstat = MSB / MSW
  const n0 = (N - sumNj2overN) / (q - 1)
  const tau2 = Math.max(0, (MSB - MSW) / n0)
  const ICC = tau2 / (tau2 + MSW)

  return {
    key: spec.key, note: spec.note, n: fit.n, orgs: orgIds.length, droppedOrgsForLowN: droppedOrgs, clusters: G, r2: round(fit.r2),
    omnibusWaldF: { F: round(omnibus.F, 3), dfNum: omnibus.dfNum, dfDenom: omnibus.dfDenom, p: round(omnibus.p) },
    varianceComponents: { N, q, F: round(Fstat, 3), dfB, dfW, p: round(fUpperTailP(Fstat, dfB, dfW)), tau2: round(tau2), sigma2: round(MSW), ICCpct: round(ICC * 100, 2) },
    sigUncorrected: sigUncorrected.map((r) => ({ name: r.name, pct: r.pct, p: round(r.p) })).sort((a, b) => a.p - b.p),
    bhSurvivors: perOrg.filter((r) => r.bh).map((r) => ({ name: r.name, pct: r.pct, p: round(r.p) })).sort((a, b) => a.p - b.p),
    tampaBay: (() => { const t = perOrg.find((r) => /Rays/.test(r.name)); return t ? { name: t.name, pct: t.pct, z: round(t.z, 3), p: round(t.p), bh: t.bh, sigUncorrected: t.p < 0.05 } : null })(),
    _keptRows: keptRows,
  }
}

// Refit just the org omnibus + tau^2 on an arbitrary row subset -- the engine
// the subsampling control below drives.
function orgOmnibusOn(rows) {
  const levels = ['A', 'High-A', 'AA', 'AAA'].filter((l) => rows.some((r) => r.level === l))
  const orgIds = [...new Set(rows.map((r) => r.orgId))].sort((a, b) => a - b)
  const levelRef = levels[0], tierRef = tiers[tiers.length - 1], orgRef = orgIds[orgIds.length - 1]
  const levelCols = levels.filter((l) => l !== levelRef)
  const tierCols = tiers.filter((t) => t !== tierRef)
  const orgCols = orgIds.filter((o) => o !== orgRef)
  const design = (r) => {
    const row = [1]
    for (const l of levelCols) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
    for (const t of tierCols) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
    for (const o of orgCols) row.push(r.orgId === o ? 1 : r.orgId === orgRef ? -1 : 0)
    return row
  }
  const X = rows.map(design), y = rows.map((r) => r.logResp)
  let fit
  try { fit = fitOLS(X, y) } catch { return null }
  const { covAdj, G } = clusterRobustCov(X, fit.resid, rows.map((r) => r.playerId), fit.XtXinv)
  const orgStart = 1 + levelCols.length + tierCols.length
  const bBlock = orgCols.map((_, i) => fit.beta[orgStart + i])
  const cBlock = orgCols.map((_, i) => orgCols.map((_, j) => covAdj[orgStart + i][orgStart + j]))
  let om
  try { om = jointWaldF(bBlock, cBlock, G - fit.p) } catch { return null }
  const designNoOrg = (r) => {
    const row = [1]
    for (const l of levelCols) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
    for (const t of tierCols) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
    return row
  }
  const fitNoOrg = fitOLS(rows.map(designNoOrg), y)
  const pairResid = new Map()
  rows.forEach((r, i) => {
    const key = `${r.orgId}:${r.playerId}`
    if (!pairResid.has(key)) pairResid.set(key, { orgId: r.orgId, sum: 0, count: 0 })
    const e = pairResid.get(key); e.sum += fitNoOrg.resid[i]; e.count++
  })
  const pairs = [...pairResid.values()].map((e) => ({ orgId: e.orgId, resid: e.sum / e.count }))
  const byOrg = new Map()
  for (const pr of pairs) { if (!byOrg.has(pr.orgId)) byOrg.set(pr.orgId, []); byOrg.get(pr.orgId).push(pr.resid) }
  const N = pairs.length, q = byOrg.size
  const gm = pairs.reduce((a, pr) => a + pr.resid, 0) / N
  let SSB = 0, SSW = 0, sumNj2overN = 0
  for (const vals of byOrg.values()) {
    const nj = vals.length, mj = vals.reduce((a, b) => a + b, 0) / nj
    SSB += nj * (mj - gm) ** 2
    for (const v of vals) SSW += (v - mj) ** 2
    sumNj2overN += (nj * nj) / N
  }
  const MSB = SSB / (q - 1), MSW = SSW / (N - q)
  const n0 = (N - sumNj2overN) / (q - 1)
  return { F: om.F, p: om.p, tau2: Math.max(0, (MSB - MSW) / n0) }
}

const results = SPECS.map(runSpec)
for (const r of results) {
  console.log(`${EOL}=== ${r.key} ===`)
  console.log(`  ${r.note}`)
  console.log(`  n=${r.n} rows, ${r.orgs} orgs (dropped for n<${ORG_MIN_N}: ${r.droppedOrgsForLowN}), ${r.clusters} player clusters, R^2=${r.r2}`)
  console.log(`  org omnibus, cluster-robust Wald : F(${r.omnibusWaldF.dfNum},${r.omnibusWaldF.dfDenom})=${r.omnibusWaldF.F}, p=${r.omnibusWaldF.p}`)
  const v = r.varianceComponents
  console.log(`  player-collapsed ANOVA           : F(${v.dfB},${v.dfW})=${v.F}, p=${v.p}   tau^2=${v.tau2}  sigma^2=${v.sigma2}  ICC=${v.ICCpct}%`)
  console.log(`  orgs significant (uncorrected)   : ${r.sigUncorrected.length ? r.sigUncorrected.map((o) => `${o.name} ${o.pct > 0 ? '+' : ''}${o.pct}% (p=${o.p})`).join(', ') : 'none'}`)
  console.log(`  orgs surviving BH q=0.05         : ${r.bhSurvivors.length ? r.bhSurvivors.map((o) => o.name).join(', ') : 'none'}`)
  console.log(`  Tampa Bay                        : ${r.tampaBay ? `${r.tampaBay.pct > 0 ? '+' : ''}${r.tampaBay.pct}%, z=${r.tampaBay.z}, p=${r.tampaBay.p}, uncorrected-sig=${r.tampaBay.sigUncorrected}, BH=${r.tampaBay.bh}` : 'not present'}`)
}

// ============================================================================
// The obvious objection, tested rather than argued: "the org signal weakened
// because you deleted rows, not because you deleted the RIGHT rows." S3 drops
// only 4.6% of the sample, so a power-only story is already a stretch -- and
// tau^2 is an effect-SIZE estimate, not a power quantity, so pure power loss
// should leave it roughly where it was rather than shrinking it several-fold.
// This makes that argument empirically instead: draw many random subsamples
// of the PUBLISHED rows, each the same size as the corrected set, and see
// where the corrected result lands in that distribution. Seeded LCG, so the
// answer is reproducible rather than a different number every run.
// ============================================================================
console.log(`${EOL}=== Control: is the collapse just the smaller n? ===`)
function makeRng(seed) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296 } }
const s0 = results.find((r) => r.key === 'S0-as-published')
const B = 200
for (const target of results.filter((r) => r.key !== 'S0-as-published')) {
  const rng = makeRng(20260824)
  const nTarget = target.n
  const Fs = [], taus = []
  for (let b = 0; b < B; b++) {
    const pool = [...s0._keptRows]
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp }
    const draw = pool.slice(0, nTarget)
    if (new Set(draw.map((r) => r.orgId)).size !== s0.orgs) continue
    const out = orgOmnibusOn(draw)
    if (out) { Fs.push(out.F); taus.push(out.tau2) }
  }
  Fs.sort((a, b2) => a - b2); taus.sort((a, b2) => a - b2)
  const pctBelow = (arr, v) => round((arr.filter((x) => x < v).length / arr.length) * 100, 1)
  const obsF = target.omnibusWaldF.F, obsTau = target.varianceComponents.tau2
  console.log(`${EOL}  ${target.key} (n=${nTarget}, ${round((1 - nTarget / s0.n) * 100, 1)}% of rows removed)`)
  console.log(`    ${Fs.length} random subsamples of the PUBLISHED rows at the same n:`)
  console.log(`      Wald F : random median=${round(Fs[Math.floor(Fs.length / 2)], 3)} [p05=${round(Fs[Math.floor(Fs.length * 0.05)], 3)}, p95=${round(Fs[Math.floor(Fs.length * 0.95)], 3)}]  observed=${obsF} -> ${pctBelow(Fs, obsF)}th pctile`)
  console.log(`      tau^2  : random median=${round(taus[Math.floor(taus.length / 2)])} [p05=${round(taus[Math.floor(taus.length * 0.05)])}, p95=${round(taus[Math.floor(taus.length * 0.95)])}]  observed=${obsTau} -> ${pctBelow(taus, obsTau)}th pctile`)
  target.subsamplingControl = { draws: Fs.length, nTarget, randomF: { median: round(Fs[Math.floor(Fs.length / 2)], 3), p05: round(Fs[Math.floor(Fs.length * 0.05)], 3), p95: round(Fs[Math.floor(Fs.length * 0.95)], 3) }, observedF: obsF, percentileF: pctBelow(Fs, obsF), randomTau2: { median: round(taus[Math.floor(taus.length / 2)]), p05: round(taus[Math.floor(taus.length * 0.05)]), p95: round(taus[Math.floor(taus.length * 0.95)]) }, observedTau2: obsTau, percentileTau2: pctBelow(taus, obsTau) }
}
console.log(`${EOL}  If the corrected values sit far down that distribution, the collapse is`)
console.log('  about WHICH rows came out, not how many.')

console.log(`${EOL}=== Against what the doc currently publishes ===`)
const pub = { omnibusF: 1.824, omnibusP: 0.0048, anovaF: 1.685, anovaP: 0.0128, ICCpct: 1.2 }
console.log(`  published (org-variance-components.mjs): Wald F=${pub.omnibusF} p=${pub.omnibusP} | ANOVA F=${pub.anovaF} p=${pub.anovaP} | ICC=${pub.ICCpct}%`)
for (const r of results) {
  console.log(`  ${r.key.padEnd(26)}: Wald F=${r.omnibusWaldF.F} p=${r.omnibusWaldF.p} | ANOVA F=${r.varianceComponents.F} p=${r.varianceComponents.p} | ICC=${r.varianceComponents.ICCpct}%`)
}

for (const r of results) delete r._keptRows
await writeFile(join(here, 'era-hump-org-recheck.json'), JSON.stringify({ published: pub, orgMinN: ORG_MIN_N, subsamplingDraws: B, specs: results }, null, 2))
console.log(`${EOL}wrote era-hump-org-recheck.json`)
