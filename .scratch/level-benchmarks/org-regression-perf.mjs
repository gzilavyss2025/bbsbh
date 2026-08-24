// Follow-up to the adversarial review's section 5: "an org whose players
// simply hit or pitch better in this cohort would look 'fast' for reasons
// that have nothing to do with how it manages promotions" — named as an
// unmeasured confound, not tested. This script adds an in-level performance
// covariate to org-regression.mjs's model and checks whether the org term's
// significance count or R² changes once it's controlled for.
//
// Performance covariate: each duration's player gets a percentile rank
// (0-100, higher = better) within the FULL population at that (level,
// season) — OPS percentile for hitters, ERA percentile (inverted: lower ERA
// = higher percentile) for pitchers. See perf-pull.mjs for why this needs
// its own pull (raw.json's cohort-only pool would be survivorship-biased)
// and where playerPool=all comes from.
//
// Deliberately does NOT touch org-regression.mjs or org-variance-
// components.mjs — separate script, per coordination with the peer session
// building those.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from '../../scripts/lib/statsapi.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const dates = JSON.parse(await readFile(join(here, 'dates.json'), 'utf8'))
const findings = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
const perfPool = JSON.parse(await readFile(join(here, 'perf-pool.json'), 'utf8'))
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

const playersById = new Map(Object.entries(raw.players).map(([id, p]) => [Number(id), p]))
const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }

function bestMilbRow(playerId, level, season) {
  const p = playersById.get(playerId)
  if (!p) return null
  const sportId = LEVEL_SPORT[level]
  const rows = p.milb.filter((r) => r.sportId === sportId)
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) if (Math.abs(r.season - season) < Math.abs(best.season - season)) best = r
  return best
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

// pool inclusion floor: drop true non-entries (didn't really play) from the
// RANKING population, so a wall of 0-PA/0-IP roster filler doesn't compress
// everyone else's percentile toward the bottom
const POOL_MIN_PA = 1
const POOL_MIN_IP = 1
// cohort-row inclusion floor: a duration's own stat line needs enough
// volume that its percentile means something (a 4-PA cameo isn't "10th
// percentile," it's noise) — well below "qualified" (rewards small samples
// with useful signal since a promotion can happen well before qualifying)
const ROW_MIN_PA = 20
const ROW_MIN_IP = 10

function percentile(playerId, sportId, season, group, value) {
  const pool = (perfPool[`${sportId}:${season}:${group}`] || []).filter((r) =>
    group === 'hitting' ? r.plateAppearances >= POOL_MIN_PA && r.ops != null : r.inningsPitched >= POOL_MIN_IP && r.era != null,
  )
  if (pool.length < 20) return null // too small a level-season pool to rank against meaningfully
  const values = pool.map((r) => (group === 'hitting' ? r.ops : r.era)).sort((a, b) => a - b)
  // rank = fraction of pool with a WORSE-or-equal value; higher percentile = better performance
  let below, atOrBelow
  if (group === 'hitting') {
    below = values.filter((v) => v < value).length
    atOrBelow = values.filter((v) => v <= value).length
  } else {
    // ERA: lower is better, so invert — count values WORSE (higher) than this one
    below = values.filter((v) => v > value).length
    atOrBelow = values.filter((v) => v >= value).length
  }
  const midRank = (below + atOrBelow) / 2 // ties split the difference
  return (midRank / values.length) * 100
}

// --- assemble the row set ---------------------------------------------------
const rows = []
let noPerfPool = 0, belowRowFloor = 0
for (const d of dates.allDurations) {
  if (disputedIds.has(d.playerId)) continue
  if (d.days <= 0) continue
  const p = playersById.get(d.playerId)
  if (!p) continue
  const sportId = LEVEL_SPORT[d.level]
  const best = bestMilbRow(d.playerId, d.level, d.season)
  if (!best) continue
  const org = orgMap.get(`${best.teamId}:${best.season}`)
  if (!org) continue

  const group = p.group // 'hitting' | 'pitching'
  const stat = best.stat || {}
  if (group === 'hitting') {
    if (!stat.plateAppearances || stat.plateAppearances < ROW_MIN_PA || stat.ops == null) { belowRowFloor++; continue }
  } else {
    const ip = stat.inningsPitched != null ? Number(stat.inningsPitched) : 0
    if (ip < ROW_MIN_IP || stat.era == null) { belowRowFloor++; continue }
  }
  const value = group === 'hitting' ? Number(stat.ops) : Number(stat.era)
  const pct = percentile(d.playerId, sportId, best.season, group, value)
  if (pct == null) { noPerfPool++; continue }

  rows.push({
    orgId: org.orgId,
    orgName: org.orgName,
    level: d.level,
    tier: draftTier(p?.ped),
    days: d.days,
    logDays: Math.log(d.days),
    perfPctile: pct,
  })
}
console.log(`rows with org+level+tier+performance resolved: ${rows.length} of ${dates.allDurations.length} allDurations`)
console.log(`dropped: ${belowRowFloor} below PA/IP floor, ${noPerfPool} with no usable level-season pool`)

const ORG_MIN_N = 20
const orgCounts = new Map()
for (const r of rows) orgCounts.set(r.orgId, (orgCounts.get(r.orgId) || 0) + 1)
const keptRows = rows.filter((r) => orgCounts.get(r.orgId) >= ORG_MIN_N)
const droppedOrgs = [...orgCounts.entries()].filter(([, n]) => n < ORG_MIN_N).length
console.log(`orgs kept (n>=${ORG_MIN_N}): ${new Set(keptRows.map((r) => r.orgId)).size}; dropped for low n: ${droppedOrgs}`)

// --- design matrix: sum-to-zero (effect) coding, with an optional perfPctile column
const levels = ['A', 'High-A', 'AA', 'AAA'].filter((l) => keptRows.some((r) => r.level === l))
const tiers = ['Round 1', 'Rounds 2-5', 'Rounds 6-10', 'Round 11+', 'No draft record']
const orgIds = [...new Set(keptRows.map((r) => r.orgId))].sort((a, b) => a - b)
const orgNameById = new Map(keptRows.map((r) => [r.orgId, r.orgName]))

const levelRef = levels[0]
const tierRef = tiers[tiers.length - 1]
const orgRef = orgIds[orgIds.length - 1]
const levelCols = levels.filter((l) => l !== levelRef)
const tierCols = tiers.filter((t) => t !== tierRef)
const orgCols = orgIds.filter((o) => o !== orgRef)

function designRow(r, withPerf) {
  const row = [1]
  for (const l of levelCols) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
  for (const t of tierCols) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
  for (const o of orgCols) row.push(r.orgId === o ? 1 : r.orgId === orgRef ? -1 : 0)
  if (withPerf) row.push((r.perfPctile - 50) / 10) // centered, scaled to ~unit range for readable coefficients
  return row
}

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

function fit(withPerf) {
  const X = keptRows.map((r) => designRow(r, withPerf))
  const y = keptRows.map((r) => r.logDays)
  const p = X[0].length
  const n = X.length
  const XtX = matTMat(X)
  const XtXinv = invert(XtX)
  const Xty = matTVec(X, y)
  const beta = XtXinv.map((row) => row.reduce((s, v, i) => s + v * Xty[i], 0))
  const yhat = X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0))
  const resid = y.map((v, i) => v - yhat[i])
  const ssRes = resid.reduce((s, e) => s + e * e, 0)
  const mean = y.reduce((a, b) => a + b, 0) / y.length
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0)
  const r2 = 1 - ssRes / ssTot
  const dof = n - p
  const sigma2 = ssRes / dof
  const se = XtXinv.map((row, i) => Math.sqrt(sigma2 * row[i]))

  const orgColStart = 1 + levelCols.length + tierCols.length
  const orgBeta = new Map(), orgSE = new Map()
  orgCols.forEach((o, i) => { orgBeta.set(o, beta[orgColStart + i]); orgSE.set(o, se[orgColStart + i]) })
  const covBlock = orgCols.map((_, i) => orgCols.map((_, j) => sigma2 * XtXinv[orgColStart + i][orgColStart + j]))
  const refBeta = -orgCols.reduce((s, o) => s + orgBeta.get(o), 0)
  let refVar = 0
  for (let i = 0; i < orgCols.length; i++) for (let j = 0; j < orgCols.length; j++) refVar += covBlock[i][j]
  orgBeta.set(orgRef, refBeta)
  orgSE.set(orgRef, Math.sqrt(refVar))

  const Z95 = 1.96
  const orgEffects = orgIds
    .map((o) => {
      const b = orgBeta.get(o), s = orgSE.get(o)
      const lo = b - Z95 * s, hi = b + Z95 * s
      return { orgId: o, name: orgNameById.get(o) || String(o), n: orgCounts.get(o), beta: b, pctEffect: Math.round((Math.exp(b) - 1) * 1000) / 10, significant: lo > 0 || hi < 0 }
    })
    .sort((a, b) => a.pctEffect - b.pctEffect)
  const sigCount = orgEffects.filter((e) => e.significant).length

  let perfCoef = null
  if (withPerf) {
    const perfIdx = p - 1
    perfCoef = { beta: beta[perfIdx], se: se[perfIdx], pctPer10Pctile: Math.round((Math.exp(beta[perfIdx]) - 1) * 1000) / 10 }
  }
  return { n, p, r2, dof, orgEffects, sigCount, perfCoef }
}

console.log(`\n=== baseline: log(days) ~ level + tier + org (n=${keptRows.length}) ===`)
const baseline = fit(false)
console.log(`R^2=${baseline.r2.toFixed(4)}, orgs significant uncorrected: ${baseline.sigCount} of ${baseline.orgEffects.length}`)

console.log(`\n=== augmented: log(days) ~ level + tier + org + perfPctile (same ${keptRows.length} rows) ===`)
const augmented = fit(true)
console.log(`R^2=${augmented.r2.toFixed(4)}, orgs significant uncorrected: ${augmented.sigCount} of ${augmented.orgEffects.length}`)
console.log(`perfPctile coefficient: ${augmented.perfCoef.pctPer10Pctile}% days per +10 percentile points (beta=${augmented.perfCoef.beta.toFixed(4)}, se=${augmented.perfCoef.se.toFixed(4)}, z=${(augmented.perfCoef.beta / augmented.perfCoef.se).toFixed(2)})`)

console.log('\n=== org coefficient shift, baseline -> augmented (sorted by |shift|) ===')
const baseByOrg = new Map(baseline.orgEffects.map((e) => [e.orgId, e]))
const shifts = augmented.orgEffects
  .map((e) => ({ name: e.name, base: baseByOrg.get(e.orgId).pctEffect, aug: e.pctEffect, shift: e.pctEffect - baseByOrg.get(e.orgId).pctEffect, signFlip: Math.sign(e.pctEffect) !== Math.sign(baseByOrg.get(e.orgId).pctEffect) }))
  .sort((a, b) => Math.abs(b.shift) - Math.abs(a.shift))
for (const s of shifts.slice(0, 10)) console.log(`${s.name.padEnd(26)} ${s.base >= 0 ? '+' : ''}${s.base}% -> ${s.aug >= 0 ? '+' : ''}${s.aug}%  (shift ${s.shift >= 0 ? '+' : ''}${s.shift.toFixed(1)})${s.signFlip ? '  SIGN FLIP' : ''}`)
const meanAbsShift = shifts.reduce((s, x) => s + Math.abs(x.shift), 0) / shifts.length
const flips = shifts.filter((s) => s.signFlip).length
console.log(`\nmean |shift| across all ${shifts.length} orgs: ${meanAbsShift.toFixed(2)} points; sign flips: ${flips}`)

await writeFile(
  join(here, 'org-regression-perf.json'),
  JSON.stringify({ rowsUsed: keptRows.length, droppedBelowFloor: belowRowFloor, droppedNoPool: noPerfPool, baseline, augmented, shifts, meanAbsShift, flips }, null, 2),
)
console.log('\nwrote org-regression-perf.json')
