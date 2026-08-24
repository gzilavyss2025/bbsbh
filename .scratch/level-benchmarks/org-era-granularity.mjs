// Follow-up to org-variance-components.mjs's era check: that script found a
// real org x era confound using a binary split (<=2015 vs 2016+) but the
// binary split conflates two different candidate explanations named
// elsewhere in this spike -- a gradual "analytics era" shift in development
// practice, vs. a sharp, dated event: the 2021 minor-league contraction
// (~160 full-season affiliates down to ~120), which docs/level-tenure-
// benchmark.md names as the leading hypothesis for why calendar-day medians
// dropped when the cohort widened, but never tests directly. This script
// reruns the era check with a THREE-bucket split that isolates the
// contraction as its own era, to see whether the era effect found in
// org-variance-components.mjs is really "2021+" specifically, or a smoother
// trend that a binary split just happened to catch.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const dates = JSON.parse(await readFile(join(here, 'dates.json'), 'utf8'))
const findings = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
const disputedIds = new Set(findings.validation.disagree.map((d) => d.playerId))

// --- numeric primitives (same as org-variance-components.mjs) --------------
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

// --- row assembly (same fixed org attribution) ------------------------------
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
function era3Of(season) {
  if (season <= 2015) return 'A: <=2015'
  if (season <= 2020) return 'B: 2016-2020'
  return 'C: 2021-2023 (post-contraction)'
}
const rows = []
for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId)) continue
  if (d.days <= 0) continue
  const org = orgForDuration(d.playerId, d.level, d.season)
  if (!org) continue
  const p = playersById.get(d.playerId)
  rows.push({ playerId: d.playerId, orgId: org.orgId, orgName: org.orgName, level: d.level, tier: draftTier(p?.ped), era3: era3Of(d.season), days: d.days, logDays: Math.log(d.days) })
}
const ORG_MIN_N = 20
const orgCounts = new Map()
for (const r of rows) orgCounts.set(r.orgId, (orgCounts.get(r.orgId) || 0) + 1)
const keptRows = rows.filter((r) => orgCounts.get(r.orgId) >= ORG_MIN_N)
console.log(`rows: ${keptRows.length}, orgs kept: ${new Set(keptRows.map((r) => r.orgId)).size}`)

// --- OLS machinery -----------------------------------------------------------
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
function clusterRobustCov(X, resid, playerIds, XtXinv) {
  const p = X[0].length
  const byCluster = new Map()
  for (let i = 0; i < X.length; i++) {
    const key = playerIds[i]
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

// --- design: level + tier + era3 + org ---------------------------------------
const levels = ['A', 'High-A', 'AA', 'AAA'].filter((l) => keptRows.some((r) => r.level === l))
const tiers = ['Round 1', 'Rounds 2-5', 'Rounds 6-10', 'Round 11+', 'No draft record']
const eras = ['A: <=2015', 'B: 2016-2020', 'C: 2021-2023 (post-contraction)']
const orgIds = [...new Set(keptRows.map((r) => r.orgId))].sort((a, b) => a - b)
const orgNameById = new Map(keptRows.map((r) => [r.orgId, r.orgName]))
const levelRef = levels[0], tierRef = tiers[tiers.length - 1], eraRef = eras[0], orgRef = orgIds[orgIds.length - 1]
const levelCols = levels.filter((l) => l !== levelRef)
const tierCols = tiers.filter((t) => t !== tierRef)
const eraCols = eras.filter((e) => e !== eraRef)
const orgCols = orgIds.filter((o) => o !== orgRef)
function designRow(r) {
  const row = [1]
  for (const l of levelCols) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
  for (const t of tierCols) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
  for (const e of eraCols) row.push(r.era3 === e ? 1 : r.era3 === eraRef ? -1 : 0)
  for (const o of orgCols) row.push(r.orgId === o ? 1 : r.orgId === orgRef ? -1 : 0)
  return row
}
const X = keptRows.map(designRow)
const y = keptRows.map((r) => r.logDays)
const playerIds = keptRows.map((r) => r.playerId)
const fit = fitOLS(X, y)
const { covAdj, G } = clusterRobustCov(X, fit.resid, playerIds, fit.XtXinv)
console.log(`\nfit: n=${fit.n}, p=${fit.p}, R^2=${fit.r2.toFixed(4)}, G=${G} clusters`)

// era3 effect sizes (context: is the shift concentrated in bucket C?)
const eraColStart = 1 + levelCols.length + tierCols.length
const eraBeta = new Map(), eraSE = new Map()
eraCols.forEach((e, i) => { eraBeta.set(e, fit.beta[eraColStart + i]); eraSE.set(e, Math.sqrt(covAdj[eraColStart + i][eraColStart + i])) })
const refEraBeta = -eraCols.reduce((s, e) => s + eraBeta.get(e), 0)
console.log('\nera3 effect (pct vs grand mean, holding level+tier+org fixed):')
for (const e of eras) {
  const b = e === eraRef ? refEraBeta : eraBeta.get(e)
  console.log(`  ${e.padEnd(32)} ${((Math.exp(b) - 1) * 100).toFixed(1)}%`)
}

// org x era3 contingency chi-square
const table = orgIds.map((o) => {
  const rowsForOrg = keptRows.filter((r) => r.orgId === o)
  return { orgId: o, name: orgNameById.get(o), counts: eras.map((e) => rowsForOrg.filter((r) => r.era3 === e).length) }
})
const totalN = keptRows.length
const eraTotals = eras.map((e) => keptRows.filter((r) => r.era3 === e).length)
let chiSq = 0
for (const t of table) {
  const rowTotal = t.counts.reduce((a, b) => a + b, 0)
  for (let j = 0; j < eras.length; j++) {
    const exp = (rowTotal * eraTotals[j]) / totalN
    chiSq += (t.counts[j] - exp) ** 2 / exp
  }
}
const dfContingency = (table.length - 1) * (eras.length - 1)
const pContingency = chiSquareUpperTailP(chiSq, dfContingency)
console.log(`\norg x era3 independence: chi2(${dfContingency}) = ${chiSq.toFixed(2)}, p = ${pContingency.toFixed(4)}`)
console.log(`pooled era3 split: ${eras.map((e, i) => `${e}=${eraTotals[i]}`).join(', ')}`)

// omnibus cluster-robust Wald test for org block, with era3 controlled
const orgColStart = 1 + levelCols.length + tierCols.length + eraCols.length
const orgBetaBlock = orgCols.map((_, i) => fit.beta[orgColStart + i])
const orgCovBlock = orgCols.map((_, i) => orgCols.map((_, j) => covAdj[orgColStart + i][orgColStart + j]))
const omnibus = jointWaldF(orgBetaBlock, orgCovBlock, G - fit.p)
console.log(`\nomnibus cluster-robust Wald test (era3-controlled), H0: all org effects = 0`)
console.log(`F(${omnibus.dfNum}, ${omnibus.dfDenom}) = ${omnibus.F.toFixed(3)}, p = ${omnibus.p.toFixed(4)}`)

await writeFile(
  join(here, 'org-era-granularity.json'),
  JSON.stringify({ n: fit.n, r2: fit.r2, eraSplit: Object.fromEntries(eras.map((e, i) => [e, eraTotals[i]])), eraEffects: eras.map((e) => ({ name: e, pctEffect: Math.round((Math.exp(e === eraRef ? refEraBeta : eraBeta.get(e)) - 1) * 1000) / 10 })), contingency: { chiSq, df: dfContingency, p: pContingency }, omnibusWaldF: omnibus }, null, 2),
)
console.log('\nwrote org-era-granularity.json')
