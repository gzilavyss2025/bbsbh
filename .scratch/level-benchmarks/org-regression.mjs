// Follow-up to team-windows.mjs: that script's per-org p25/median/p75 quantile
// check found 0 of 30 orgs whose window sits fully outside the pooled window,
// at both v1 (881) and widened (3,061) sample sizes. docs/team-movement-windows.md's
// "What would change this now" names the real candidate: a regression-based org
// fixed effect that holds level and draft pedigree constant, instead of comparing
// raw per-org quantiles. An org with more prep-pick position players will look
// "slow" on a raw median for reasons that have nothing to do with how it manages
// promotions; a coefficient's own confidence interval, not an ad hoc overlap
// check, is the right test for "does this org actually differ."
//
// Model: log(days+1) ~ level + draftTier + org, all three effect-coded
// (sum-to-zero contrasts) so each org's coefficient is its estimated deviation
// from the GRAND MEAN days-at-level, holding level and pedigree tier constant —
// answering "does this org differ from the pack" directly, with its own CI.
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

function orgForDuration(playerId, level, seasonGuess) {
  const p = playersById.get(playerId)
  if (!p) return null
  const sportId = LEVEL_SPORT[level]
  const rows = p.milb.filter((r) => r.sportId === sportId)
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) if (Math.abs(r.season - seasonGuess) < Math.abs(best.season - seasonGuess)) best = r
  return orgMap.get(`${best.teamId}:${best.season}`) || null
}

// same bucketing dates.mjs uses for allPromotionDates.draftTier, applied to
// allDurations (which doesn't carry the tier directly)
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

// --- assemble the row set ---------------------------------------------------
const rows = []
for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId)) continue
  if (d.days <= 0) continue // log-transform needs strictly positive; dates.mjs already excludes same-day
  const seasonGuess = Number((dates.allPromotionDates.find((pp) => pp.playerId === d.playerId)?.date || '2020').slice(0, 4))
  const org = orgForDuration(d.playerId, d.level, seasonGuess)
  if (!org) continue
  const p = playersById.get(d.playerId)
  rows.push({
    orgId: org.orgId,
    orgName: org.orgName,
    level: d.level,
    tier: draftTier(p?.ped),
    days: d.days,
    logDays: Math.log(d.days),
  })
}
console.log(`rows with org+level+tier resolved: ${rows.length} of ${dates.allDurations.length} allDurations`)

// only trust an org's fixed-effect estimate once it has enough rows across
// levels combined — matches team-windows.mjs's MIN_N=8 per org/level cell,
// scaled up since this pools all three levels per org
const ORG_MIN_N = 20
const orgCounts = new Map()
for (const r of rows) orgCounts.set(r.orgId, (orgCounts.get(r.orgId) || 0) + 1)
const keptRows = rows.filter((r) => orgCounts.get(r.orgId) >= ORG_MIN_N)
const droppedOrgs = [...orgCounts.entries()].filter(([, n]) => n < ORG_MIN_N).length
console.log(`orgs kept (n>=${ORG_MIN_N}): ${new Set(keptRows.map((r) => r.orgId)).size}; dropped for low n: ${droppedOrgs}`)

// --- design matrix: sum-to-zero (effect) coding -----------------------------
// For a k-level factor, pick a reference category (dropped) and give every
// OTHER category its own column (1 if that category, -1 if reference, 0
// otherwise). The reference category's own effect is then -(sum of the
// others) — computed after the fit, not estimated directly, but its
// implied SE is derived from the fitted covariance the same way.
const levels = ['A', 'High-A', 'AA', 'AAA'].filter((l) => keptRows.some((r) => r.level === l))
const tiers = ['Round 1', 'Rounds 2-5', 'Rounds 6-10', 'Round 11+', 'No draft record']
const orgIds = [...new Set(keptRows.map((r) => r.orgId))].sort((a, b) => a - b)
const orgNameById = new Map(keptRows.map((r) => [r.orgId, r.orgName]))

const levelRef = levels[0]
const tierRef = tiers[tiers.length - 1] // 'No draft record'
const orgRef = orgIds[orgIds.length - 1]

const levelCols = levels.filter((l) => l !== levelRef)
const tierCols = tiers.filter((t) => t !== tierRef)
const orgCols = orgIds.filter((o) => o !== orgRef)

function designRow(r) {
  const row = [1] // intercept
  for (const l of levelCols) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
  for (const t of tierCols) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
  for (const o of orgCols) row.push(r.orgId === o ? 1 : r.orgId === orgRef ? -1 : 0)
  return row
}

const X = keptRows.map(designRow)
const y = keptRows.map((r) => r.logDays)
const p = X[0].length
const n = X.length
console.log(`design matrix: ${n} rows x ${p} columns (1 intercept + ${levelCols.length} level + ${tierCols.length} tier + ${orgCols.length} org)`)

// --- OLS via normal equations, solved by Gauss-Jordan elimination ----------
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
    if (Math.abs(A[pivot][col]) < 1e-12) throw new Error(`singular design matrix at column ${col} — check for collinear/empty factor levels`)
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

const XtX = matTMat(X)
const XtXinv = invert(XtX)
const Xty = matTVec(X, y)
const beta = XtXinv.map((row) => row.reduce((s, v, i) => s + v * Xty[i], 0))

const yhat = X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0))
const resid = y.map((v, i) => v - yhat[i])
const ssRes = resid.reduce((s, e) => s + e * e, 0)
const ssTot = (() => {
  const mean = y.reduce((a, b) => a + b, 0) / y.length
  return y.reduce((s, v) => s + (v - mean) ** 2, 0)
})()
const r2 = 1 - ssRes / ssTot
const dof = n - p
const sigma2 = ssRes / dof
const se = XtXinv.map((row, i) => Math.sqrt(sigma2 * row[i]))

console.log(`\nfit: n=${n}, p=${p}, R^2=${r2.toFixed(3)}, residual df=${dof}`)

// --- pull out org effects, incl. the dropped reference org, with CIs -------
// coefficient for org o (o != orgRef) is beta directly; for orgRef it's
// -(sum of all other org coefficients). Var(-(sum)) = sum of variances +
// 2*sum of pairwise covariances — use the full covariance submatrix, not
// just the diagonal, since the org columns aren't orthogonal to each other.
const orgColStart = 1 + levelCols.length + tierCols.length
const orgBeta = new Map()
const orgSE = new Map()
orgCols.forEach((o, i) => {
  orgBeta.set(o, beta[orgColStart + i])
  orgSE.set(o, se[orgColStart + i])
})
// reference org: coefficient = -sum(others); variance from full covariance block
const covBlock = orgCols.map((_, i) => orgCols.map((_, j) => sigma2 * XtXinv[orgColStart + i][orgColStart + j]))
const refBeta = -orgCols.reduce((s, o) => s + orgBeta.get(o), 0)
let refVar = 0
for (let i = 0; i < orgCols.length; i++) for (let j = 0; j < orgCols.length; j++) refVar += covBlock[i][j]
orgBeta.set(orgRef, refBeta)
orgSE.set(orgRef, Math.sqrt(refVar))

const Z95 = 1.96
const orgEffects = orgIds
  .map((o) => {
    const b = orgBeta.get(o)
    const s = orgSE.get(o)
    const lo = b - Z95 * s
    const hi = b + Z95 * s
    return {
      orgId: o,
      name: orgNameById.get(o) || String(o),
      n: orgCounts.get(o),
      pctEffect: Math.round((Math.exp(b) - 1) * 1000) / 10, // % faster(-)/slower(+) than grand mean
      ciLowPct: Math.round((Math.exp(lo) - 1) * 1000) / 10,
      ciHighPct: Math.round((Math.exp(hi) - 1) * 1000) / 10,
      significant: lo > 0 || hi < 0,
    }
  })
  .sort((a, b) => a.pctEffect - b.pctEffect)

console.log(`\n=== org fixed effect on days-at-level, holding level+draft tier constant (n>=${ORG_MIN_N}) ===`)
console.log('(% faster/slower than the grand mean; * = 95% CI excludes 0)')
for (const e of orgEffects) {
  const flag = e.significant ? '*' : ' '
  console.log(`${e.name.padEnd(26)} n=${String(e.n).padEnd(4)} ${e.pctEffect >= 0 ? '+' : ''}${e.pctEffect}% [${e.ciLowPct >= 0 ? '+' : ''}${e.ciLowPct}%, ${e.ciHighPct >= 0 ? '+' : ''}${e.ciHighPct}%] ${flag}`)
}
const sigCount = orgEffects.filter((e) => e.significant).length
console.log(`\norgs with a 95% CI excluding 0 (statistically distinguishable from the grand mean): ${sigCount} of ${orgEffects.length}`)

// --- also report level and tier effects for context -------------------------
function namedEffects(cols, ref, startIdx) {
  const b = new Map()
  const s = new Map()
  cols.forEach((c, i) => {
    b.set(c, beta[startIdx + i])
    s.set(c, se[startIdx + i])
  })
  const block = cols.map((_, i) => cols.map((_, j) => sigma2 * XtXinv[startIdx + i][startIdx + j]))
  const refB = -cols.reduce((sum, c) => sum + b.get(c), 0)
  let refVar = 0
  for (let i = 0; i < cols.length; i++) for (let j = 0; j < cols.length; j++) refVar += block[i][j]
  const all = [...cols, ref]
  return all.map((c) => {
    const beta_ = c === ref ? refB : b.get(c)
    const se_ = c === ref ? Math.sqrt(refVar) : s.get(c)
    return { name: c, pctEffect: Math.round((Math.exp(beta_) - 1) * 1000) / 10 }
  })
}
const levelEffects = namedEffects(levelCols, levelRef, 1)
const tierEffects = namedEffects(tierCols, tierRef, 1 + levelCols.length)
console.log('\n=== level effect (context, not the question this asks) ===')
for (const e of levelEffects) console.log(`${e.name.padEnd(10)} ${e.pctEffect >= 0 ? '+' : ''}${e.pctEffect}%`)
console.log('\n=== draft-tier effect (context) ===')
for (const e of tierEffects) console.log(`${e.name.padEnd(16)} ${e.pctEffect >= 0 ? '+' : ''}${e.pctEffect}%`)

await writeFile(
  join(here, 'org-regression.json'),
  JSON.stringify(
    {
      n,
      p,
      r2,
      residualDof: dof,
      orgMinN: ORG_MIN_N,
      droppedOrgsForLowN: droppedOrgs,
      orgEffects,
      levelEffects,
      tierEffects,
      significantOrgCount: sigCount,
      totalOrgCount: orgEffects.length,
    },
    null,
    2,
  ),
)
console.log('\nwrote org-regression.json')
