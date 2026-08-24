// Follow-up to org-regression.mjs, after the adversarial-review pass (see
// "Adversarial review" in docs/team-movement-windows.md). That review flagged
// two things as real but unmeasured: (a) non-independence — a player who
// passes through 3 levels contributes 3 rows to his org, not 3 independent
// players, so the naive OLS SEs are anti-conservative; (b) era — whether some
// orgs' rows cluster in different multi-year spans than others', which would
// let an org's fitted effect partly absorb an era shift instead of an org
// tendency. Also: testing 30 individual org coefficients and correcting for
// multiple comparisons (Bonferroni/BH) answers "which specific org differs,"
// not "does org matter at all" — a single joint (omnibus) test is the right
// tool for that question and wasn't run.
//
// This script runs three things against the same fixed row set org-regression.mjs
// uses (level + draftTier + org, correct per-duration season):
//
// 1. Cluster-robust (CR1, clustered by player) standard errors for the exact
//    same level+tier+org OLS fit, plus a cluster-robust joint Wald/F test for
//    "does the org block matter at all" — the omnibus test the per-org
//    Bonferroni/BH counts were never a substitute for.
// 2. The same model with an era term added (season <=2015 vs >=2016, an
//    ~44/56 split of the cohort) — reports whether adding era shifts the org
//    coefficients, plus an org x era contingency chi-square test for whether
//    any org's rows are disproportionately concentrated in one era.
// 3. A player-collapsed one-way variance-components analysis: fit
//    log(days) ~ level + tier + era (NO org) by OLS, average each (org,
//    player) pair's residuals into one point (this is what actually fixes
//    the clustering problem, by construction, rather than modeling around
//    it), then run classical unbalanced one-way ANOVA of those residuals by
//    org. This gives what the fixed-effect approach can't: a variance
//    component (tau^2 for org vs sigma^2 residual — how much of the spread
//    is real, in absolute terms) and shrunk (empirical-Bayes) per-org point
//    estimates, instead of "significant or not."
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const dates = JSON.parse(await readFile(join(here, 'dates.json'), 'utf8'))
const findings = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
const disputedIds = new Set(findings.validation.disagree.map((d) => d.playerId))

// ============================================================================
// numeric primitives: gammaln, regularized incomplete gamma (chi-square CDF),
// regularized incomplete beta (F-distribution CDF), normal CDF via erf.
// Standard textbook algorithms (Abramowitz & Stegun / Numerical Recipes),
// self-tested below against known reference values before use.
// ============================================================================
function gammaln(x) {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaln(1 - x)
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}
function lowerIncompleteGammaRegularized(a, x) {
  // P(a,x): series for x < a+1, continued fraction for x >= a+1 (Numerical Recipes gammp)
  if (x <= 0) return 0
  if (x < a + 1) {
    let sum = 1 / a, term = sum, n = a
    for (let i = 0; i < 200; i++) {
      n += 1
      term *= x / n
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a))
  }
  // continued fraction for the UPPER incomplete gamma Q, then P = 1-Q
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-14) break
  }
  const q = Math.exp(-x + a * Math.log(x) - gammaln(a)) * h
  return 1 - q
}
function chiSquareUpperTailP(stat, df) {
  if (stat <= 0) return 1
  return 1 - lowerIncompleteGammaRegularized(df / 2, stat / 2)
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
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c
    if (Math.abs(c) < FPMIN) c = FPMIN
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
  const x = df2 / (df2 + df1 * F)
  return incompleteBetaRegularized(df2 / 2, df1 / 2, x)
}
function erf(x) {
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}
function normalTwoSidedP(z) {
  return 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)))
}

// self-test against known reference values before trusting these on real data
console.log('=== numeric self-test ===')
console.log(`chi2 upper-tail p, stat=3.841, df=1 (expect ~0.0500): ${chiSquareUpperTailP(3.841, 1).toFixed(4)}`)
console.log(`chi2 upper-tail p, stat=43.773, df=29 (expect ~0.0400): ${chiSquareUpperTailP(43.773, 29).toFixed(4)}`)
console.log(`F upper-tail p, F=1.860, df1=4, df2=30 (expect ~0.1450): ${fUpperTailP(1.86, 4, 30).toFixed(4)}`)
console.log(`normal two-sided p, z=1.96 (expect ~0.0500): ${normalTwoSidedP(1.96).toFixed(4)}`)
console.log(`normal two-sided p, z=2.576 (expect ~0.0100): ${normalTwoSidedP(2.576).toFixed(4)}\n`)

// ============================================================================
// row assembly — same fixed org attribution as org-regression.mjs, but
// carrying playerId (for clustering) and era through
// ============================================================================
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

const playersById = new Map(Object.entries(raw.players).map(([id, p]) => [Number(id), p]))
const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }
function orgForDuration(playerId, level, season) {
  const p = playersById.get(playerId)
  if (!p) return null
  const sportId = LEVEL_SPORT[level]
  const rows = p.milb.filter((r) => r.sportId === sportId)
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
const ERA_SPLIT = 2016 // ~44/56 split of the cohort's resolved-transition seasons; see docs
function eraOf(season) {
  return season <= ERA_SPLIT - 1 ? 'Era1 (<=2015)' : 'Era2 (2016+)'
}

const rows = []
for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId)) continue
  if (d.days <= 0) continue
  const org = orgForDuration(d.playerId, d.level, d.season)
  if (!org) continue
  const p = playersById.get(d.playerId)
  rows.push({
    playerId: d.playerId,
    orgId: org.orgId,
    orgName: org.orgName,
    level: d.level,
    tier: draftTier(p?.ped),
    era: eraOf(d.season),
    days: d.days,
    logDays: Math.log(d.days),
  })
}
console.log(`rows with org+level+tier resolved: ${rows.length} of ${dates.allDurations.length} allDurations`)

const ORG_MIN_N = 20
const orgCounts = new Map()
for (const r of rows) orgCounts.set(r.orgId, (orgCounts.get(r.orgId) || 0) + 1)
const keptRows = rows.filter((r) => orgCounts.get(r.orgId) >= ORG_MIN_N)
console.log(`orgs kept (n>=${ORG_MIN_N}): ${new Set(keptRows.map((r) => r.orgId)).size}`)

// ============================================================================
// design matrix / OLS machinery (same effect-coding convention as org-regression.mjs)
// ============================================================================
function matTMat(X) {
  const p = X[0].length
  const M = Array.from({ length: p }, () => new Array(p).fill(0))
  for (const row of X) for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) M[i][j] += row[i] * row[j]
  return M
}
function matTVec(X, y) {
  const p = X[0].length
  const v = new Array(p).fill(0)
  for (let k = 0; k < X.length; k++) for (let i = 0; i < p; i++) v[i] += X[k][i] * y[k]
  return v
}
function invert(M) {
  const n = M.length
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r
    if (Math.abs(A[pivot][col]) < 1e-12) throw new Error(`singular design matrix at column ${col}`)
    ;[A[col], A[pivot]] = [A[pivot], A[col]]
    const pv = A[col][col]
    for (let j = 0; j < 2 * n; j++) A[col][j] /= pv
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = A[r][col]
      if (f === 0) continue
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j]
    }
  }
  return A.map((row) => row.slice(n))
}
function fitOLS(X, y) {
  const XtX = matTMat(X)
  const XtXinv = invert(XtX)
  const Xty = matTVec(X, y)
  const beta = XtXinv.map((row) => row.reduce((s, v, i) => s + v * Xty[i], 0))
  const yhat = X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0))
  const resid = y.map((v, i) => v - yhat[i])
  const ssRes = resid.reduce((s, e) => s + e * e, 0)
  const mean = y.reduce((a, b) => a + b, 0) / y.length
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0)
  const n = X.length, p = X[0].length
  const dof = n - p
  const sigma2 = ssRes / dof
  const naiveSE = XtXinv.map((row, i) => Math.sqrt(sigma2 * row[i]))
  return { beta, XtXinv, resid, ssRes, ssTot, r2: 1 - ssRes / ssTot, n, p, dof, sigma2, naiveSE }
}
// cluster-robust (CR1) sandwich covariance, clustered by playerId
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
  // bread * meat * bread
  const bm = XtXinv.map((row) => {
    const out = new Array(p).fill(0)
    for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) out[j] += row[k] * meat[k][j]
    return out
  })
  const cov = bm.map((row) => {
    const out = new Array(p).fill(0)
    for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) out[j] += row[k] * XtXinv[k][j]
    return out
  })
  const G = byCluster.size
  const n = X.length
  const c = (G / (G - 1)) * ((n - 1) / (n - p))
  const covAdj = cov.map((row) => row.map((v) => v * c))
  return { covAdj, G }
}

function buildDesign(rowSet, { includeEra }) {
  const levels = ['A', 'High-A', 'AA', 'AAA'].filter((l) => rowSet.some((r) => r.level === l))
  const tiers = ['Round 1', 'Rounds 2-5', 'Rounds 6-10', 'Round 11+', 'No draft record']
  const orgIds = [...new Set(rowSet.map((r) => r.orgId))].sort((a, b) => a - b)
  const orgNameById = new Map(rowSet.map((r) => [r.orgId, r.orgName]))
  const eras = includeEra ? ['Era1 (<=2015)', 'Era2 (2016+)'] : []

  const levelRef = levels[0]
  const tierRef = tiers[tiers.length - 1]
  const orgRef = orgIds[orgIds.length - 1]
  const eraRef = eras[eras.length - 1]

  const levelCols = levels.filter((l) => l !== levelRef)
  const tierCols = tiers.filter((t) => t !== tierRef)
  const eraCols = eras.filter((e) => e !== eraRef)
  const orgCols = orgIds.filter((o) => o !== orgRef)

  function designRow(r) {
    const row = [1]
    for (const l of levelCols) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
    for (const t of tierCols) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
    for (const e of eraCols) row.push(r.era === e ? 1 : r.era === eraRef ? -1 : 0)
    for (const o of orgCols) row.push(r.orgId === o ? 1 : r.orgId === orgRef ? -1 : 0)
    return row
  }
  return { levels, levelRef, levelCols, tierRef, tierCols, eraRef, eraCols, orgIds, orgRef, orgCols, orgNameById, designRow }
}

// recover a factor's per-level effect + SE from a covariance matrix (naive or clustered)
function factorEffects(cols, ref, startIdx, beta, cov, labelFn) {
  const b = new Map(), sub = cols.map((_, i) => cols.map((_, j) => cov[startIdx + i][startIdx + j]))
  cols.forEach((c, i) => b.set(c, beta[startIdx + i]))
  const refB = -cols.reduce((s, c) => s + b.get(c), 0)
  let refVar = 0
  for (let i = 0; i < cols.length; i++) for (let j = 0; j < cols.length; j++) refVar += sub[i][j]
  const all = [...cols, ref]
  return all.map((c) => {
    const beta_ = c === ref ? refB : b.get(c)
    const se_ = c === ref ? Math.sqrt(Math.max(refVar, 0)) : Math.sqrt(cov[startIdx + cols.indexOf(c)][startIdx + cols.indexOf(c)])
    return { name: labelFn ? labelFn(c) : c, beta: beta_, se: se_ }
  })
}

// ============================================================================
// 1. cluster-robust fit, level+tier+org (no era) — the direct clustered
//    counterpart to org-regression.json's published fit
// ============================================================================
console.log('\n=== 1. cluster-robust SEs, level+tier+org (no era) ===')
const d1 = buildDesign(keptRows, { includeEra: false })
const X1 = keptRows.map(d1.designRow)
const y1 = keptRows.map((r) => r.logDays)
const fit1 = fitOLS(X1, y1)
const playerIds1 = keptRows.map((r) => r.playerId)
const { covAdj: cov1, G: G1 } = clusterRobustCov(X1, fit1.resid, playerIds1, fit1.XtXinv)
console.log(`n=${fit1.n} rows, G=${G1} player clusters, p=${fit1.p}, R^2=${fit1.r2.toFixed(3)}`)

const orgColStart1 = 1 + d1.levelCols.length + d1.tierCols.length
const orgEffectsNaive = factorEffects(d1.orgCols, d1.orgRef, orgColStart1, fit1.beta, fit1.naiveSE.map((s, i) => fit1.naiveSE.map((s2, j) => (i === j ? s * s : fit1.sigma2 * fit1.XtXinv[i][j]))), d1.orgNameById.get.bind(d1.orgNameById))
const orgEffectsClustered = factorEffects(d1.orgCols, d1.orgRef, orgColStart1, fit1.beta, cov1, (o) => d1.orgNameById.get(o) || String(o))

const Z95 = 1.96
function withCI(effects, n) {
  return effects
    .map((e) => {
      const lo = e.beta - Z95 * e.se, hi = e.beta + Z95 * e.se
      return {
        name: e.name,
        n,
        pctEffect: Math.round((Math.exp(e.beta) - 1) * 1000) / 10,
        ciLowPct: Math.round((Math.exp(lo) - 1) * 1000) / 10,
        ciHighPct: Math.round((Math.exp(hi) - 1) * 1000) / 10,
        p: normalTwoSidedP(e.beta / e.se),
        significant: lo > 0 || hi < 0,
      }
    })
    .sort((a, b) => a.pctEffect - b.pctEffect)
}
const orgEffectsNaiveCI = withCI(orgEffectsNaive).map((e) => ({ ...e, n: orgCounts.get(d1.orgIds.find((o) => (d1.orgNameById.get(o) || String(o)) === e.name)) }))
const orgEffectsClusteredCI = withCI(orgEffectsClustered).map((e) => ({ ...e, n: orgCounts.get(d1.orgIds.find((o) => (d1.orgNameById.get(o) || String(o)) === e.name)) }))

console.log('naive vs cluster-robust: uncorrected-significant count')
const sigNaive = orgEffectsNaiveCI.filter((e) => e.significant).length
const sigClustered = orgEffectsClusteredCI.filter((e) => e.significant).length
console.log(`naive SE:           ${sigNaive} of ${orgEffectsNaiveCI.length}`)
console.log(`cluster-robust SE:  ${sigClustered} of ${orgEffectsClusteredCI.length}`)
// Benjamini-Hochberg on clustered p-values
function benjaminiHochberg(effects, q = 0.05) {
  const sorted = [...effects].sort((a, b) => a.p - b.p)
  const m = sorted.length
  let cutoff = -1
  for (let i = 0; i < m; i++) if (sorted[i].p <= ((i + 1) / m) * q) cutoff = i
  const survivors = new Set(sorted.slice(0, cutoff + 1).map((e) => e.name))
  return effects.map((e) => ({ ...e, survivesBH: survivors.has(e.name) }))
}
const orgEffectsClusteredBH = benjaminiHochberg(orgEffectsClusteredCI)
const bhCount = orgEffectsClusteredBH.filter((e) => e.survivesBH).length
console.log(`cluster-robust BH (q=0.05): ${bhCount} of ${orgEffectsClusteredCI.length} — ${orgEffectsClusteredBH.filter((e) => e.survivesBH).map((e) => e.name).join(', ') || '(none)'}`)

// joint (omnibus) cluster-robust Wald F-test for the whole org block
function jointWaldF(betaBlock, covBlock, dfDenom) {
  const covInv = invert(covBlock)
  let W = 0
  for (let i = 0; i < betaBlock.length; i++) for (let j = 0; j < betaBlock.length; j++) W += betaBlock[i] * covInv[i][j] * betaBlock[j]
  const dfNum = betaBlock.length
  const F = W / dfNum
  return { W, dfNum, dfDenom, F, p: fUpperTailP(F, dfNum, dfDenom) }
}
const orgBetaBlock1 = d1.orgCols.map((_, i) => fit1.beta[orgColStart1 + i])
const orgCovBlock1 = d1.orgCols.map((_, i) => d1.orgCols.map((_, j) => cov1[orgColStart1 + i][orgColStart1 + j]))
const omnibus1 = jointWaldF(orgBetaBlock1, orgCovBlock1, G1 - fit1.p)
console.log(`\nomnibus cluster-robust Wald test, H0: all org effects = 0`)
console.log(`F(${omnibus1.dfNum}, ${omnibus1.dfDenom}) = ${omnibus1.F.toFixed(3)}, p = ${omnibus1.p.toFixed(4)}`)

// ============================================================================
// 2. era-augmented model — does adding era shift the org coefficients?
//    plus an org x era representation chi-square test
// ============================================================================
console.log('\n=== 2. era check ===')
const eraCounts = { 'Era1 (<=2015)': 0, 'Era2 (2016+)': 0 }
for (const r of keptRows) eraCounts[r.era]++
console.log(`pooled era split: ${JSON.stringify(eraCounts)}`)

// org x era contingency chi-square (independence test)
const orgIds = d1.orgIds
const table = orgIds.map((o) => {
  const rowsForOrg = keptRows.filter((r) => r.orgId === o)
  return { orgId: o, name: d1.orgNameById.get(o), era1: rowsForOrg.filter((r) => r.era === 'Era1 (<=2015)').length, era2: rowsForOrg.filter((r) => r.era === 'Era2 (2016+)').length }
})
const totalN = keptRows.length
const totalEra1 = eraCounts['Era1 (<=2015)']
let chiSq = 0
for (const t of table) {
  const rowTotal = t.era1 + t.era2
  const expEra1 = (rowTotal * totalEra1) / totalN
  const expEra2 = rowTotal - expEra1
  chiSq += (t.era1 - expEra1) ** 2 / expEra1 + (t.era2 - expEra2) ** 2 / expEra2
}
const dfContingency = table.length - 1
const pContingency = chiSquareUpperTailP(chiSq, dfContingency)
console.log(`org x era independence: chi2(${dfContingency}) = ${chiSq.toFixed(2)}, p = ${pContingency.toFixed(4)}`)
const skewedOrgs = table
  .map((t) => ({ ...t, share1: t.era1 / (t.era1 + t.era2) }))
  .sort((a, b) => Math.abs(b.share1 - totalEra1 / totalN) - Math.abs(a.share1 - totalEra1 / totalN))
  .slice(0, 5)
console.log('most era-skewed orgs (share of rows in Era1 vs pooled ' + (totalEra1 / totalN).toFixed(2) + '):')
for (const t of skewedOrgs) console.log(`  ${t.name.padEnd(26)} era1=${t.era1} era2=${t.era2} share1=${t.share1.toFixed(2)}`)

// refit WITH era, cluster-robust, compare org coefficients to the no-era fit
const d2 = buildDesign(keptRows, { includeEra: true })
const X2 = keptRows.map(d2.designRow)
const y2 = keptRows.map((r) => r.logDays)
const fit2 = fitOLS(X2, y2)
const { covAdj: cov2, G: G2 } = clusterRobustCov(X2, fit2.resid, playerIds1, fit2.XtXinv)
const orgColStart2 = 1 + d2.levelCols.length + d2.tierCols.length + d2.eraCols.length
const orgEffectsWithEra = factorEffects(d2.orgCols, d2.orgRef, orgColStart2, fit2.beta, cov2, (o) => d2.orgNameById.get(o) || String(o))
const orgEffectsWithEraCI = withCI(orgEffectsWithEra).map((e) => ({ ...e, n: orgCounts.get(d2.orgIds.find((o) => (d2.orgNameById.get(o) || String(o)) === e.name)) }))
const shifts = orgEffectsClusteredCI.map((noEra) => {
  const withEra = orgEffectsWithEraCI.find((e) => e.name === noEra.name)
  return { name: noEra.name, noEra: noEra.pctEffect, withEra: withEra.pctEffect, shiftPts: Math.round((withEra.pctEffect - noEra.pctEffect) * 10) / 10 }
})
const maxShift = shifts.reduce((m, s) => (Math.abs(s.shiftPts) > Math.abs(m.shiftPts) ? s : m))
const meanAbsShift = shifts.reduce((s, x) => s + Math.abs(x.shiftPts), 0) / shifts.length
console.log(`\nadding era to the model: mean |shift| in org pct-effect = ${meanAbsShift.toFixed(1)} pts; largest = ${maxShift.name} (${maxShift.shiftPts >= 0 ? '+' : ''}${maxShift.shiftPts} pts)`)
const eraR2Gain = fit2.r2 - fit1.r2
console.log(`R^2 with era added: ${fit2.r2.toFixed(4)} (vs ${fit1.r2.toFixed(4)} without, +${(eraR2Gain * 100).toFixed(2)} pts)`)
const sigClusteredWithEra = orgEffectsWithEraCI.filter((e) => e.significant).length
console.log(`orgs significant, cluster-robust, WITH era control: ${sigClusteredWithEra} of ${orgEffectsWithEraCI.length}`)

// ============================================================================
// 3. player-collapsed variance-components (fixes clustering by construction)
// ============================================================================
console.log('\n=== 3. player-collapsed one-way variance components (org, controlling level+tier+era) ===')
const d3 = buildDesign(keptRows, { includeEra: true })
// fit WITHOUT org: level + tier + era only
const orgFreeRows = keptRows.map((r) => ({ ...r }))
const levels3 = ['A', 'High-A', 'AA', 'AAA'].filter((l) => orgFreeRows.some((r) => r.level === l))
const tiers3 = ['Round 1', 'Rounds 2-5', 'Rounds 6-10', 'Round 11+', 'No draft record']
const eras3 = ['Era1 (<=2015)', 'Era2 (2016+)']
const levelRef3 = levels3[0], tierRef3 = tiers3[tiers3.length - 1], eraRef3 = eras3[1]
const levelCols3 = levels3.filter((l) => l !== levelRef3)
const tierCols3 = tiers3.filter((t) => t !== tierRef3)
const eraCols3 = eras3.filter((e) => e !== eraRef3)
function designRowNoOrg(r) {
  const row = [1]
  for (const l of levelCols3) row.push(r.level === l ? 1 : r.level === levelRef3 ? -1 : 0)
  for (const t of tierCols3) row.push(r.tier === t ? 1 : r.tier === tierRef3 ? -1 : 0)
  for (const e of eraCols3) row.push(r.era === e ? 1 : r.era === eraRef3 ? -1 : 0)
  return row
}
const X3 = orgFreeRows.map(designRowNoOrg)
const y3 = orgFreeRows.map((r) => r.logDays)
const fit3 = fitOLS(X3, y3)
console.log(`level+tier+era-only fit: R^2=${fit3.r2.toFixed(4)} (context: how much level+tier+era alone explain)`)

// collapse residuals to one point per (org, player) pair
const pairResid = new Map() // "orgId:playerId" -> {orgId, sum, count}
orgFreeRows.forEach((r, i) => {
  const key = `${r.orgId}:${r.playerId}`
  if (!pairResid.has(key)) pairResid.set(key, { orgId: r.orgId, orgName: r.orgName, sum: 0, count: 0 })
  const e = pairResid.get(key)
  e.sum += fit3.resid[i]
  e.count++
})
const pairs = [...pairResid.values()].map((e) => ({ orgId: e.orgId, orgName: e.orgName, resid: e.sum / e.count }))
console.log(`collapsed ${orgFreeRows.length} rows to ${pairs.length} (org,player) pairs`)

const byOrg = new Map()
for (const pr of pairs) {
  if (!byOrg.has(pr.orgId)) byOrg.set(pr.orgId, { name: pr.orgName, vals: [] })
  byOrg.get(pr.orgId).vals.push(pr.resid)
}
const N = pairs.length
const q = byOrg.size
const grandMean = pairs.reduce((s, pr) => s + pr.resid, 0) / N
let SSB = 0, SSW = 0, sumNj2overN = 0
const orgStats = []
for (const [orgId, { name, vals }] of byOrg) {
  const nj = vals.length
  const meanj = vals.reduce((a, b) => a + b, 0) / nj
  SSB += nj * (meanj - grandMean) ** 2
  for (const v of vals) SSW += (v - meanj) ** 2
  sumNj2overN += (nj * nj) / N
  orgStats.push({ orgId, name, nj, meanj })
}
const dfB = q - 1, dfW = N - q
const MSB = SSB / dfB, MSW = SSW / dfW
const Fstat = MSB / MSW
const pOmnibusANOVA = fUpperTailP(Fstat, dfB, dfW)
const n0 = (N - sumNj2overN) / (q - 1)
const tau2 = Math.max(0, (MSB - MSW) / n0)
const sigma2Resid = MSW
const ICC = tau2 / (tau2 + sigma2Resid)
console.log(`\nplayer-collapsed one-way ANOVA of residuals by org:`)
console.log(`N=${N} pairs, q=${q} orgs, F(${dfB},${dfW})=${Fstat.toFixed(3)}, p=${pOmnibusANOVA.toFixed(4)}`)
console.log(`tau^2 (between-org variance, log-days units) = ${tau2.toFixed(4)}`)
console.log(`sigma^2 (residual/within-org variance) = ${sigma2Resid.toFixed(4)}`)
console.log(`ICC = tau^2/(tau^2+sigma^2) = ${(ICC * 100).toFixed(1)}% — share of residual (post level+tier+era) variance attributable to org`)

// empirical-Bayes shrinkage per org
const shrunkOrgs = orgStats
  .map((s) => {
    const Bj = tau2 / (tau2 + sigma2Resid / s.nj) // shrinkage weight, 0=full shrink to grand mean, 1=no shrink
    const shrunkDeviation = Bj * s.meanj // grand mean of residuals is ~0
    return {
      name: s.name,
      n: s.nj,
      rawPctEffect: Math.round((Math.exp(s.meanj) - 1) * 1000) / 10,
      shrinkageWeight: Math.round(Bj * 1000) / 1000,
      shrunkPctEffect: Math.round((Math.exp(shrunkDeviation) - 1) * 1000) / 10,
    }
  })
  .sort((a, b) => a.shrunkPctEffect - b.shrunkPctEffect)
console.log('\nraw vs shrunk per-org pct effect (n = distinct players in org, not rows):')
for (const s of shrunkOrgs) console.log(`${s.name.padEnd(26)} n=${String(s.n).padEnd(3)} raw=${s.rawPctEffect >= 0 ? '+' : ''}${s.rawPctEffect}%  shrink_w=${s.shrinkageWeight}  shrunk=${s.shrunkPctEffect >= 0 ? '+' : ''}${s.shrunkPctEffect}%`)

// ============================================================================
// write output
// ============================================================================
await writeFile(
  join(here, 'org-variance-components.json'),
  JSON.stringify(
    {
      selfTest: {
        chi2_3841_df1: chiSquareUpperTailP(3.841, 1),
        chi2_43773_df29: chiSquareUpperTailP(43.773, 29),
        f_186_df4_30: fUpperTailP(1.86, 4, 30),
        normal_196: normalTwoSidedP(1.96),
      },
      clusterRobust: {
        n: fit1.n, G: G1, p: fit1.p, r2: fit1.r2,
        significantUncorrectedNaive: sigNaive,
        significantUncorrectedClustered: sigClustered,
        significantBHClustered: bhCount,
        bhSurvivors: orgEffectsClusteredBH.filter((e) => e.survivesBH).map((e) => e.name),
        omnibusWaldF: omnibus1,
        orgEffectsNaive: orgEffectsNaiveCI,
        orgEffectsClustered: orgEffectsClusteredCI,
      },
      eraCheck: {
        pooledEraSplit: eraCounts,
        contingency: { chiSq, df: dfContingency, p: pContingency },
        mostSkewedOrgs: skewedOrgs,
        meanAbsCoefficientShiftPts: meanAbsShift,
        largestShift: maxShift,
        r2WithEra: fit2.r2,
        r2WithoutEra: fit1.r2,
        significantClusteredWithEra: sigClusteredWithEra,
        orgEffectsWithEra: orgEffectsWithEraCI,
      },
      varianceComponents: {
        N, q, dfB, dfW, F: Fstat, p: pOmnibusANOVA,
        tau2, sigma2: sigma2Resid, ICC,
        r2LevelTierEraOnly: fit3.r2,
        orgEffects: shrunkOrgs,
      },
    },
    null,
    2,
  ),
)
console.log('\nwrote org-variance-components.json')
