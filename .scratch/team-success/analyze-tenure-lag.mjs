// Spike: give the joint model's fifth signal (org Triple-A tenure) temporal
// separation, per docs/team-success-joint-model.md's "What would move this
// next" section, and test it head-to-head against docs/price-the-blockage.md's
// incumbent-depth measure. See docs/team-success-tenure-lag.md for the writeup.
//
// Run: node .scratch/team-success/analyze-tenure-lag.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { median, mean, zscoreBy, twoTailedP, logistic } from '../blockage/lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const LB = join(ROOT, '.scratch/level-benchmarks')

// ---------------------------------------------------------------------------
// Ordered logit (proportional odds), same construction as the joint model's
// own trade-deadline follow-up spike (.scratch/team-success/analyze-trade-
// deadline.mjs), including its synthetic-data self-check below — copied
// rather than re-derived from scratch, to avoid a second independent chance
// at a transcription bug in the estimator this whole spike leans on.
// ---------------------------------------------------------------------------
function orderedLogitLogLik(params, X, y, J) {
  const p = X[0].length
  const beta = params.slice(0, p)
  const rawCuts = params.slice(p)
  const cuts = []
  let acc = rawCuts[0]
  cuts.push(acc)
  for (let j = 1; j < rawCuts.length; j += 1) {
    acc += Math.exp(rawCuts[j])
    cuts.push(acc)
  }
  const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))))
  let ll = 0
  for (let i = 0; i < X.length; i += 1) {
    let eta = 0
    for (let k = 0; k < p; k += 1) eta += X[i][k] * beta[k]
    const yi = y[i]
    const gLow = yi === 0 ? 0 : sigmoid(cuts[yi - 1] - eta)
    const gHigh = yi === J - 1 ? 1 : sigmoid(cuts[yi] - eta)
    const prob = Math.max(gHigh - gLow, 1e-12)
    ll += Math.log(prob)
  }
  return ll
}

function numGrad(f, params, h = 1e-5) {
  const g = new Array(params.length)
  for (let i = 0; i < params.length; i += 1) {
    const up = params.slice(); up[i] += h
    const down = params.slice(); down[i] -= h
    g[i] = (f(up) - f(down)) / (2 * h)
  }
  return g
}

function numHessian(f, params, h = 1e-4) {
  const n = params.length
  const H = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      const pp = params.slice(); pp[i] += h; pp[j] += h
      const pm = params.slice(); pm[i] += h; pm[j] -= h
      const mp = params.slice(); mp[i] -= h; mp[j] += h
      const mm = params.slice(); mm[i] -= h; mm[j] -= h
      const val = (f(pp) - f(pm) - f(mp) + f(mm)) / (4 * h * h)
      H[i][j] = val
      H[j][i] = val
    }
  }
  return { H }
}

function invertSmall(M) {
  const n = M.length
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let r = col + 1; r < n; r += 1) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r
    if (Math.abs(A[pivot][col]) < 1e-10) return null
    const tmp = A[col]; A[col] = A[pivot]; A[pivot] = tmp
    const pv = A[col][col]
    for (let j = 0; j < 2 * n; j += 1) A[col][j] /= pv
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue
      const f = A[r][col]
      if (f === 0) continue
      for (let j = 0; j < 2 * n; j += 1) A[r][j] -= f * A[col][j]
    }
  }
  return A.map((row) => row.slice(n))
}

function fitOrderedLogit(X, y, J, featureNames) {
  const p = X[0].length
  const counts = new Array(J).fill(0)
  y.forEach((yi) => { counts[yi] += 1 })
  let cum = 0
  const initCuts = []
  for (let j = 0; j < J - 1; j += 1) {
    cum += counts[j]
    const frac = Math.min(Math.max(cum / y.length, 0.01), 0.99)
    initCuts.push(Math.log(frac / (1 - frac)))
  }
  const rawCuts = [initCuts[0]]
  for (let j = 1; j < initCuts.length; j += 1) {
    const diff = initCuts[j] - rawCuts.reduce((a, v, i) => (i === 0 ? v : a + Math.exp(v)), 0)
    rawCuts.push(Math.log(Math.max(diff, 1e-3)))
  }
  let params = [...new Array(p).fill(0), ...rawCuts]
  const f = (pr) => orderedLogitLogLik(pr, X, y, J)

  let ll = f(params)
  for (let iter = 0; iter < 3000; iter += 1) {
    const g = numGrad(f, params)
    const gnorm = Math.sqrt(g.reduce((a, v) => a + v * v, 0))
    if (gnorm < 1e-5) break
    let step = 1
    let accepted = false
    for (let tries = 0; tries < 40; tries += 1) {
      const cand = params.map((v, i) => v + step * g[i])
      const llCand = f(cand)
      if (llCand > ll) { params = cand; ll = llCand; accepted = true; break }
      step *= 0.5
    }
    if (!accepted) break
  }

  const { H } = numHessian(f, params)
  const negH = H.map((row) => row.map((v) => -v))
  const cov = invertSmall(negH)
  const wellIdentified = cov != null && cov.every((row, i) => row[i] > 0 && Number.isFinite(row[i]))
  const se = cov ? params.map((_, i) => Math.sqrt(Math.max(cov[i][i], 0))) : params.map(() => NaN)

  const betaTerms = featureNames.map((nm, i) => ({
    name: nm,
    beta: params[i],
    se: se[i],
    z: params[i] / se[i],
    p: twoTailedP(params[i] / se[i]),
    oddsRatio: Math.exp(params[i]),
  }))
  return { params, ll, wellIdentified, betaTerms, se }
}

// Sanity-check the optimizer on synthetic data with known coefficients
// before trusting it on the real, small sample below (same check the
// trade-deadline spike ran).
function seedRandomSC(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
function syntheticCheck() {
  const rngS = seedRandomSC(777)
  const n = 2000
  const trueBeta = [0.8, -0.3]
  const trueCuts = [-1.5, -0.3, 0.5, 1.2, 2.2]
  const Xs = []
  const ys = []
  for (let i = 0; i < n; i += 1) {
    const x1 = (rngS() - 0.5) * 4
    const x2 = rngS() < 0.5 ? 1 : 0
    const eta = x1 * trueBeta[0] + x2 * trueBeta[1]
    const u = rngS()
    const latent = eta + Math.log(u / (1 - u))
    let cat = 0
    while (cat < trueCuts.length && latent > trueCuts[cat]) cat += 1
    Xs.push([x1, x2]); ys.push(cat)
  }
  const fit = fitOrderedLogit(Xs, ys, 6, ['x1', 'x2'])
  return { trueBeta, recovered: fit.betaTerms.map((t) => t.beta) }
}
const scCheck = syntheticCheck()
console.log('Ordered-logit optimizer self-check on synthetic n=2000 data with known coefficients:')
console.log(`  true beta:      [${scCheck.trueBeta.map((v) => v.toFixed(3)).join(', ')}]`)
console.log(`  recovered beta: [${scCheck.recovered.map((v) => v.toFixed(3)).join(', ')}]`)

// ---------------------------------------------------------------------------
// Load cached sources. No new statsapi pull beyond the two 15-season fielding
// pulls already run (.scratch/team-success/{mlb,milb}-field-cache.json,
// pull-fielding-for-depth.mjs) — everything else here is already-committed
// research-diary data.
// ---------------------------------------------------------------------------
const raw = JSON.parse(readFileSync(join(LB, 'raw.json'), 'utf8')).players
const datesDoc = JSON.parse(readFileSync(join(LB, 'dates.json'), 'utf8'))
const findings = JSON.parse(readFileSync(join(LB, 'findings.json'), 'utf8'))
const orgmapWide = JSON.parse(readFileSync(join(LB, 'orgmap-wide.json'), 'utf8'))
const teamWindows = JSON.parse(readFileSync(join(LB, 'team-windows.json'), 'utf8'))
const ladderDoc = JSON.parse(readFileSync(join(ROOT, '.scratch/team-success/outcome-ladder.json'), 'utf8'))
const mlbField = JSON.parse(readFileSync(join(__dirname, 'mlb-field-cache.json'), 'utf8'))
const milbField = JSON.parse(readFileSync(join(__dirname, 'milb-field-cache.json'), 'utf8'))

const disputedIds = new Set(findings.validation.disagree.map((d) => d.playerId))

// ---------------------------------------------------------------------------
// PART 1 — org attribution for the tenure measure, replicating
// .scratch/level-benchmarks/team-windows.mjs's own method exactly (so the
// only thing this spike changes is which debuts count, not how an org gets
// assigned to a duration record).
// ---------------------------------------------------------------------------
function orgForDuration(playerId, sportId, seasonGuess) {
  const p = raw[String(playerId)]
  if (!p) return null
  const rows = p.milb.filter((r) => r.sportId === sportId)
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) {
    if (Math.abs(r.season - seasonGuess) < Math.abs(best.season - seasonGuess)) best = r
  }
  const hit = orgmapWide[`${best.teamId}:${best.season}`]
  return hit ? { orgId: hit[0], orgName: hit[1] } : null
}

const aaaRecords = [] // { playerId, orgId, orgName, days, debutYear }
for (const d of datesDoc.allDurations) {
  if (d.level !== 'AAA') continue
  if (disputedIds.has(d.playerId)) continue
  const promo = datesDoc.allPromotionDates.find((pp) => pp.playerId === d.playerId)
  const seasonGuess = Number((promo?.date || '2020').slice(0, 4))
  const org = orgForDuration(d.playerId, 11, seasonGuess)
  if (!org) continue
  aaaRecords.push({
    playerId: d.playerId,
    orgId: org.orgId,
    orgName: org.orgName,
    days: d.days,
    debutYear: Number(d.debutDate.slice(0, 4)),
  })
}
console.log(`AAA duration records with resolved org: ${aaaRecords.length} of ${datesDoc.allDurations.filter((d) => d.level === 'AAA').length}`)

// --- Replication check against the published, contemporaneous team-windows.json ---
const byOrgAll = new Map()
for (const r of aaaRecords) {
  if (!byOrgAll.has(r.orgId)) byOrgAll.set(r.orgId, { name: r.orgName, days: [] })
  byOrgAll.get(r.orgId).days.push(r.days)
}
const publishedAAA = new Map(teamWindows.byLevel.AAA.map((r) => [r.name, r]))
let repMatches = 0
let repChecked = 0
for (const [, v] of byOrgAll) {
  const pub = publishedAAA.get(v.name)
  if (!pub || v.days.length < teamWindows.minN) continue
  repChecked += 1
  const myMedian = median(v.days)
  if (Math.abs(myMedian - pub.median) <= 1) repMatches += 1
}
console.log(`Replication check vs published team-windows.json AAA medians: ${repMatches}/${repChecked} orgs match within +/-1 day (n=${repChecked} orgs with minN>=${teamWindows.minN})`)

// ---------------------------------------------------------------------------
// PART 2 — the lagged (temporally separated) tenure covariate: for target
// ladder year Y and organization, use only AAA duration records whose
// player's MLB debut happened strictly BEFORE year Y (an expanding window,
// not the contemporaneous single pooled number team-windows.json reports).
// ---------------------------------------------------------------------------
const MIN_N_LAG = 6
const LADDER_YEARS = ladderDoc.seasons.map((s) => s.year).filter((y) => y !== 2020)
const orgIds = [...new Set(aaaRecords.map((r) => r.orgId))]

const laggedTenure = new Map() // `${orgId}:${year}` -> { median, n }
for (const year of LADDER_YEARS) {
  for (const orgId of orgIds) {
    const pool = aaaRecords.filter((r) => r.orgId === orgId && r.debutYear < year)
    if (pool.length < MIN_N_LAG) continue
    laggedTenure.set(`${orgId}:${year}`, { median: median(pool.map((r) => r.days)), n: pool.length })
  }
}
const yearsWithCoverage = LADDER_YEARS.filter((y) => orgIds.some((o) => laggedTenure.has(`${o}:${y}`)))
console.log(`Lagged tenure: years with >=1 org meeting n>=${MIN_N_LAG}: ${Math.min(...yearsWithCoverage)}-${Math.max(...yearsWithCoverage)}`)
for (const y of yearsWithCoverage) {
  const covered = orgIds.filter((o) => laggedTenure.has(`${o}:${y}`)).length
  console.log(`  ${y}: ${covered}/30 orgs covered`)
}

// ---------------------------------------------------------------------------
// PART 3 — org-season incumbent depth, mirroring docs/price-the-blockage.md's
// own per-stay measure (build.mjs's incumbentAt().depth: count of MLB
// teammates with >=20 games started at the same position group that season,
// EXCLUDING the prospect himself), averaged across that org's Triple-A
// hitter cohort in that same season. Hitters only (matches confound.mjs's
// 458-stay "moved down the ladder" model, the one this spike tests against).
// ---------------------------------------------------------------------------
const GROUP = { C: 'C', '1B': '1B', '2B': '2B', '3B': '3B', SS: 'SS', CF: 'CF', LF: 'COF', RF: 'COF', DH: 'DH' }

const mlbFieldByOrgSeason = new Map()
for (const [seasonStr, rows] of Object.entries(mlbField)) {
  const season = Number(seasonStr)
  for (const r of rows) {
    const k = `${r.t}:${season}`
    if (!mlbFieldByOrgSeason.has(k)) mlbFieldByOrgSeason.set(k, [])
    mlbFieldByOrgSeason.get(k).push(r)
  }
}
const milbFieldByPlayerSeason = new Map()
for (const [seasonStr, rows] of Object.entries(milbField)) {
  const season = Number(seasonStr)
  for (const r of rows) {
    const k = `${r.p}:${season}`
    if (!milbFieldByPlayerSeason.has(k)) milbFieldByPlayerSeason.set(k, [])
    milbFieldByPlayerSeason.get(k).push(r)
  }
}

function posGroupFromFielding(rows) {
  if (!rows || !rows.length) return null
  const byGroup = new Map()
  for (const r of rows) {
    const g = GROUP[r.pos]
    if (!g) continue
    byGroup.set(g, (byGroup.get(g) || 0) + (r.gs || 0))
  }
  let best = null
  let bestGs = -1
  for (const [g, gs] of byGroup) if (gs > bestGs) { best = g; bestGs = gs }
  return bestGs > 0 ? best : null
}

function depthAt(orgId, season, group, selfId) {
  const rows = mlbFieldByOrgSeason.get(`${orgId}:${season}`) || []
  const byPlayer = new Map()
  for (const r of rows) {
    if (GROUP[r.pos] !== group) continue
    if (r.p === selfId) continue
    byPlayer.set(r.p, (byPlayer.get(r.p) || 0) + (r.gs || 0))
  }
  return [...byPlayer.values()].filter((gs) => gs >= 20).length
}

// build.mjs's own org attribution for a STAY (season-matched, not the
// debut-year-guess method PART 1 uses) — reused faithfully because depth is
// inherently tied to "the org this player's Triple-A season belonged to."
function orgForStay(playerId, season) {
  const p = raw[String(playerId)]
  if (!p) return null
  const aaaRows = p.milb.filter((r) => r.sportId === 11)
  const inSeason = aaaRows.filter((r) => r.season === season)
  const pool = inSeason.length ? inSeason : aaaRows
  const teamRow = pool.slice().sort((a, b) => {
    const av = (a.stat && a.stat.plateAppearances) || 0
    const bv = (b.stat && b.stat.plateAppearances) || 0
    return bv - av
  })[0]
  if (!teamRow) return null
  for (let s = teamRow.season; s >= teamRow.season - 2; s -= 1) {
    const hit = orgmapWide[`${teamRow.teamId}:${s}`]
    if (hit) return { orgId: hit[0], teamId: teamRow.teamId, season: teamRow.season }
  }
  return null
}

const depthByStay = []
let dropsNoPlayer = 0, dropsPitcher = 0, dropsNoOrg = 0, dropsNoGroup = 0
for (const d of datesDoc.allDurations) {
  if (d.level !== 'AAA') continue
  const p = raw[String(d.playerId)]
  if (!p) { dropsNoPlayer += 1; continue }
  if (p.group === 'pitching') { dropsPitcher += 1; continue }
  const orgHit = orgForStay(d.playerId, d.season)
  if (!orgHit) { dropsNoOrg += 1; continue }
  const aaaPos = posGroupFromFielding(milbFieldByPlayerSeason.get(`${d.playerId}:${d.season}`))
    || posGroupFromFielding(milbFieldByPlayerSeason.get(`${d.playerId}:${d.season - 1}`))
    || GROUP[p.ped && p.ped.posAbbr] || null
  if (!aaaPos) { dropsNoGroup += 1; continue }
  const depth = depthAt(orgHit.orgId, d.season, aaaPos, d.playerId)
  depthByStay.push({ playerId: d.playerId, orgId: orgHit.orgId, season: d.season, aaaPos, depth })
}
console.log(`\nDepth-by-stay built: ${depthByStay.length} (drops: noPlayer=${dropsNoPlayer} pitcher=${dropsPitcher} noOrg=${dropsNoOrg} noGroup=${dropsNoGroup})`)

const depthByOrgSeason = new Map() // `${orgId}:${season}` -> [depths]
for (const s of depthByStay) {
  const k = `${s.orgId}:${s.season}`
  if (!depthByOrgSeason.has(k)) depthByOrgSeason.set(k, [])
  depthByOrgSeason.get(k).push(s.depth)
}
const MIN_N_DEPTH = 2
const orgSeasonDepth = new Map()
for (const [k, vals] of depthByOrgSeason) {
  if (vals.length < MIN_N_DEPTH) continue
  orgSeasonDepth.set(k, { mean: mean(vals), n: vals.length })
}
console.log(`Org-seasons with a depth value (n stays >= ${MIN_N_DEPTH}): ${orgSeasonDepth.size}`)

// ---------------------------------------------------------------------------
// PART 4 — join to the outcome ladder, standardize both covariates as
// league-average-relative (z-scored WITHIN season, per house style), fit.
// ---------------------------------------------------------------------------
const ladderByYearTeam = new Map()
for (const season of ladderDoc.seasons) {
  if (season.year === 2020) continue
  for (const [teamId, info] of Object.entries(season.teams)) {
    ladderByYearTeam.set(`${season.year}:${teamId}`, { ...info, era: season.era, year: season.year, teamId: Number(teamId) })
  }
}

// --- Wide sample: lagged tenure only, NOT restricted to depth coverage ---
// this isolates whether a weaker result below is the LAG or the much
// smaller depth-availability subsample.
const wideRows = []
for (const [, info] of ladderByYearTeam) {
  const { year, teamId } = info
  const t = laggedTenure.get(`${teamId}:${year}`)
  if (!t) continue
  wideRows.push({
    year, teamId, ladder: info.ladder, madePostseason: info.madePostseason,
    era: info.era, tenureLagDays: t.median, tenureLagN: t.n,
  })
}
console.log(`\nWide sample (lagged tenure only, no depth requirement): n=${wideRows.length}`)

const joined = []
for (const [, info] of ladderByYearTeam) {
  const { year, teamId } = info
  const t = laggedTenure.get(`${teamId}:${year}`)
  const dep = orgSeasonDepth.get(`${teamId}:${year}`)
  if (!t || !dep) continue
  joined.push({
    year, teamId, ladder: info.ladder, madePostseason: info.madePostseason,
    era: info.era, tenureLagDays: t.median, tenureLagN: t.n,
    depthMean: dep.mean, depthN: dep.n,
  })
}
console.log(`\nJoined team-seasons with BOTH covariates present: n=${joined.length}`)
const joinedYears = [...new Set(joined.map((r) => r.year))].sort((a, b) => a - b)
console.log(`years covered: ${joinedYears.join(', ')}`)

// --- Same-subsample comparison: on the EXACT n=104 rows the joint model
// uses, what does the ORIGINAL contemporaneous (unlagged, single pooled
// per-org number) tenure measure look like? Isolates "the lag weakened it"
// from "this particular subsample is just thinner/different."
const contemporaneousTenureByOrg = new Map()
for (const [orgId, v] of byOrgAll) contemporaneousTenureByOrg.set(orgId, median(v.days))
for (const r of joined) r.tenureContemporaneousDays = contemporaneousTenureByOrg.get(r.teamId) ?? null

if (joined.length < 30) {
  console.log('\nTOO FEW ROWS to fit — writing what was found and stopping.')
  writeFileSync(join(__dirname, 'tenure-lag-panel.json'), JSON.stringify({ joined, wideRows, note: 'insufficient n to fit' }, null, 2))
  process.exit(0)
}

const tenureZ = zscoreBy(joined, (r) => r.year, (r) => r.tenureLagDays)
const depthZ = zscoreBy(joined, (r) => r.year, (r) => r.depthMean)
joined.forEach((r, i) => { r.tenureLagZ = tenureZ[i]; r.depthZ = depthZ[i] })

// Only dummy-code era levels that actually appear among the JOINED rows
// (the lagged-tenure coverage floor of 2012-13 already excludes
// pre-wildcard-game, and 2020 is dropped outright per house style) —
// a constant-zero column for an absent level makes the design matrix
// singular.
const eraLevelsPresent = [...new Set(joined.map((r) => r.era))].sort()
const ERA_REFERENCE = eraLevelsPresent[0]
const ERA_LEVELS = eraLevelsPresent.slice(1)
console.log(`\nEra levels present in the joined sample: ${eraLevelsPresent.join(', ')} (reference: ${ERA_REFERENCE})`)
function eraDummies(era) { return ERA_LEVELS.map((lvl) => (era === lvl ? 1 : 0)) }

const ladderArr = joined.map((r) => r.ladder)
const madeArr = joined.map((r) => (r.madePostseason ? 1 : 0))

function corr(a, b) {
  const ma = mean(a), mb = mean(b)
  let cov = 0, va = 0, vb = 0
  for (let i = 0; i < a.length; i += 1) { cov += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2 }
  return cov / Math.sqrt(va * vb)
}
const tenureDepthCorr = corr(joined.map((r) => r.tenureLagZ), joined.map((r) => r.depthZ))
console.log(`\nCorrelation(laggedTenure_z, depth_z), n=${joined.length}: r=${tenureDepthCorr.toFixed(4)}`)

// --- Model (a): lagged tenure alone ---
function buildX(rows, includeDepth) {
  return rows.map((r) => {
    const base = [r.tenureLagZ]
    if (includeDepth) base.push(r.depthZ)
    return [...base, ...eraDummies(r.era)]
  })
}
const eraNames = ERA_LEVELS.map((lvl) => `era_${lvl}`)
const namesAlone = ['tenureLag_z', ...eraNames]
const namesJoint = ['tenureLag_z', 'depth_z', ...eraNames]

const Xalone = buildX(joined, false)
const Xjoint = buildX(joined, true)

const fitAloneOrd = fitOrderedLogit(Xalone, ladderArr, 6, namesAlone)
const fitJointOrd = fitOrderedLogit(Xjoint, ladderArr, 6, namesJoint)

const fitAloneLogit = logistic(Xalone.map((r) => [1, ...r]), madeArr, ['intercept', ...namesAlone])
const fitJointLogit = logistic(Xjoint.map((r) => [1, ...r]), madeArr, ['intercept', ...namesJoint])

console.log(`\n=== Ordered logit, ladder(0-5) ~ tenureLag_z + era, n=${joined.length} ===`)
console.log(`well-identified: ${fitAloneOrd.wellIdentified}`)
for (const t of fitAloneOrd.betaTerms) console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)

console.log(`\n=== Ordered logit, ladder(0-5) ~ tenureLag_z + depth_z + era, n=${joined.length} ===`)
console.log(`well-identified: ${fitJointOrd.wellIdentified}`)
for (const t of fitJointOrd.betaTerms) console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)

console.log(`\n=== Logistic, madePostseason ~ tenureLag_z + era, n=${joined.length} ===`)
for (const t of fitAloneLogit.terms) console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)
console.log(`  McFadden: ${fitAloneLogit.mcFadden.toFixed(4)}`)

console.log(`\n=== Logistic, madePostseason ~ tenureLag_z + depth_z + era, n=${joined.length} ===`)
for (const t of fitJointLogit.terms) console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)
console.log(`  McFadden: ${fitJointLogit.mcFadden.toFixed(4)}`)

// ---------------------------------------------------------------------------
// Two diagnostic fits that isolate WHY the joint-model n=104 result above
// reads weaker than the joint model's published contemporaneous +0.298
// (p=0.0003): is it the lag, the much smaller depth-availability
// subsample, or both?
// ---------------------------------------------------------------------------
// (i) The wide sample: lagged tenure alone, every team-season with lagged-
// tenure coverage, NOT restricted to org-seasons where a depth value also
// exists.
const wideEraLevels = [...new Set(wideRows.map((r) => r.era))].sort()
const wideEraRef = wideEraLevels[0]
const wideEraDummyLevels = wideEraLevels.slice(1)
function wideEraDummies(era) { return wideEraDummyLevels.map((lvl) => (era === lvl ? 1 : 0)) }
const wideTenureZ = zscoreBy(wideRows, (r) => r.year, (r) => r.tenureLagDays)
wideRows.forEach((r, i) => { r.tenureLagZ = wideTenureZ[i] })
const wideNames = ['tenureLag_z', ...wideEraDummyLevels.map((l) => `era_${l}`)]
const Xwide = wideRows.map((r) => [r.tenureLagZ, ...wideEraDummies(r.era)])
const fitWideOrd = fitOrderedLogit(Xwide, wideRows.map((r) => r.ladder), 6, wideNames)
console.log(`\n=== DIAGNOSTIC (i): wide sample, ladder ~ tenureLag_z + era, n=${wideRows.length} (era ref=${wideEraRef}) ===`)
console.log(`well-identified: ${fitWideOrd.wellIdentified}`)
for (const t of fitWideOrd.betaTerms) console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)

// (ii) Same n=104 subsample as the joint model, but using the ORIGINAL
// contemporaneous (unlagged, single pooled-over-2005-2023 org number)
// tenure value instead of the lagged one — isolates the effect of the LAG
// itself, holding the subsample fixed.
const contempZ = zscoreBy(joined, (r) => r.year, (r) => r.tenureContemporaneousDays)
const Xcontemp = joined.map((r, i) => [contempZ[i], ...eraDummies(r.era)])
const fitContempOrd = fitOrderedLogit(Xcontemp, ladderArr, 6, ['tenureContemporaneous_z', ...eraNames])
console.log(`\n=== DIAGNOSTIC (ii): SAME n=${joined.length} subsample, ladder ~ tenureCONTEMPORANEOUS_z + era ===`)
console.log(`well-identified: ${fitContempOrd.wellIdentified}`)
for (const t of fitContempOrd.betaTerms) console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)

// Robustness on the WIDE sample (n=327, the best-powered fair test of
// "lagged tenure alone predicts the ladder") — leave-one-org-out and a
// within-season permutation test, same design as PART 5 below.
function seedRandomWide(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }
console.log(`\n=== Robustness on the WIDE sample (n=${wideRows.length}), tenureLag_z alone ===`)
const wideLooResults = []
for (const orgId of [...new Set(wideRows.map((r) => r.teamId))]) {
  const sub = wideRows.filter((r) => r.teamId !== orgId)
  const Xsub = sub.map((r) => [r.tenureLagZ, ...wideEraDummies(r.era)])
  const fit = fitOrderedLogit(Xsub, sub.map((r) => r.ladder), 6, wideNames)
  const term = fit.betaTerms[0]
  wideLooResults.push({ excludedOrg: orgId, beta: term.beta, p: term.p, sameSign: Math.sign(term.beta) === Math.sign(fitWideOrd.betaTerms[0].beta) })
}
const wideLooSameSign = wideLooResults.filter((r) => r.sameSign).length
console.log(`leave-one-org-out: same sign ${wideLooSameSign}/${wideLooResults.length}, beta range [${Math.min(...wideLooResults.map((r) => r.beta)).toFixed(4)}, ${Math.max(...wideLooResults.map((r) => r.beta)).toFixed(4)}]`)

const wideYearGroups = new Map()
wideRows.forEach((r, i) => { if (!wideYearGroups.has(r.year)) wideYearGroups.set(r.year, []); wideYearGroups.get(r.year).push(i) })
const wideRng = seedRandomWide(20260826)
const wideTrueBeta = fitWideOrd.betaTerms[0].beta
let wideCountGE = 0
const NPERM_WIDE = 2000
for (let rep = 0; rep < NPERM_WIDE; rep += 1) {
  const shuffled = new Array(wideRows.length)
  for (const [, idxs] of wideYearGroups) {
    const vals = idxs.map((i) => wideRows[i].tenureLagZ)
    for (let i = vals.length - 1; i > 0; i -= 1) {
      const j = Math.floor(wideRng() * (i + 1))
      ;[vals[i], vals[j]] = [vals[j], vals[i]]
    }
    idxs.forEach((idx, k) => { shuffled[idx] = vals[k] })
  }
  const Xperm = wideRows.map((r, i) => [shuffled[i], ...wideEraDummies(r.era)])
  const fit = fitOrderedLogit(Xperm, wideRows.map((r) => r.ladder), 6, wideNames)
  if (Math.abs(fit.betaTerms[0].beta) >= Math.abs(wideTrueBeta)) wideCountGE += 1
}
const widePermP = wideCountGE / NPERM_WIDE
console.log(`permutation p (${NPERM_WIDE} reshuffles within season): ${widePermP.toFixed(4)}`)

// ---------------------------------------------------------------------------
// PART 5 — robustness: leave-one-org-out, permutation test.
// ---------------------------------------------------------------------------
function seedRandom(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

console.log('\n=== Leave-one-org-out (ordered logit, tenureLag_z term, JOINT model with depth) ===')
const looResults = []
for (const orgId of [...new Set(joined.map((r) => r.teamId))]) {
  const idxs = joined.map((r, i) => (r.teamId !== orgId ? i : -1)).filter((i) => i >= 0)
  const sub = idxs.map((i) => joined[i])
  const Xsub = buildX(sub, true)
  const ysub = sub.map((r) => r.ladder)
  const fit = fitOrderedLogit(Xsub, ysub, 6, namesJoint)
  const term = fit.betaTerms[0]
  looResults.push({ excludedOrg: orgId, beta: term.beta, p: term.p, sameSign: Math.sign(term.beta) === Math.sign(fitJointOrd.betaTerms[0].beta) })
}
const looSameSign = looResults.filter((r) => r.sameSign).length
console.log(`same sign as full sample: ${looSameSign}/${looResults.length}`)
console.log(`beta range: [${Math.min(...looResults.map((r) => r.beta)).toFixed(4)}, ${Math.max(...looResults.map((r) => r.beta)).toFixed(4)}]`)
const looAllSig = looResults.every((r) => r.p < 0.05)
console.log(`p<0.05 in every leave-one-out refit: ${looAllSig}`)

console.log('\n=== Permutation test: shuffle which org gets which lagged-tenure value, within season (ordered logit, joint model) ===')
const NPERM = 2000
const rng = seedRandom(20260826)
const trueBeta = fitJointOrd.betaTerms[0].beta
let countGE = 0
const permBetas = []
const yearGroups = new Map()
joined.forEach((r, i) => {
  if (!yearGroups.has(r.year)) yearGroups.set(r.year, [])
  yearGroups.get(r.year).push(i)
})
for (let rep = 0; rep < NPERM; rep += 1) {
  const shuffledTenure = new Array(joined.length)
  for (const [, idxs] of yearGroups) {
    const vals = idxs.map((i) => joined[i].tenureLagZ)
    for (let i = vals.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[vals[i], vals[j]] = [vals[j], vals[i]]
    }
    idxs.forEach((idx, k) => { shuffledTenure[idx] = vals[k] })
  }
  const Xperm = joined.map((r, i) => [shuffledTenure[i], r.depthZ, ...eraDummies(r.era)])
  const fit = fitOrderedLogit(Xperm, ladderArr, 6, namesJoint)
  const b = fit.betaTerms[0].beta
  permBetas.push(b)
  if (Math.abs(b) >= Math.abs(trueBeta)) countGE += 1
}
const permP = countGE / NPERM
console.log(`permutation p (${NPERM} reshuffles within season): ${permP.toFixed(4)}`)

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
const out = {
  generatedAt: new Date().toISOString(),
  source: [
    '.scratch/level-benchmarks/{raw,dates,findings,orgmap-wide,team-windows}.json',
    '.scratch/team-success/outcome-ladder.json',
    '.scratch/team-success/{mlb,milb}-field-cache.json (new, this spike)',
  ],
  method: {
    minNLagTenure: MIN_N_LAG,
    minNDepthStays: MIN_N_DEPTH,
    tenureMeasure: 'median calendar days at Triple-A, org expanding-window over debuts strictly before the target ladder year',
    depthMeasure: 'mean, across that org-season\'s Triple-A HITTER stays, of count of MLB teammates with >=20 GS at the same position group that season (excludes the prospect)',
  },
  replicationCheck: { repMatches, repChecked, minN: teamWindows.minN },
  n: joined.length,
  yearsCovered: joinedYears,
  tenureDepthCorr,
  panel: joined,
  diagnostics: {
    wideSampleN: wideRows.length,
    wideSampleOrderedLogit: fitWideOrd.betaTerms,
    wideSampleWellIdentified: fitWideOrd.wellIdentified,
    wideSampleLeaveOneOrgOut: wideLooResults,
    wideSampleLeaveOneOrgOutSameSignCount: wideLooSameSign,
    wideSamplePermutationP: widePermP,
    wideSamplePermutationReps: NPERM_WIDE,
    sameSubsampleContemporaneousOrderedLogit: fitContempOrd.betaTerms,
    sameSubsampleContemporaneousWellIdentified: fitContempOrd.wellIdentified,
  },
  findings: {
    orderedLogitAlone: fitAloneOrd.betaTerms,
    orderedLogitAloneWellIdentified: fitAloneOrd.wellIdentified,
    orderedLogitJoint: fitJointOrd.betaTerms,
    orderedLogitJointWellIdentified: fitJointOrd.wellIdentified,
    logisticMadePostseasonAlone: fitAloneLogit.terms,
    logisticMadePostseasonAloneMcFadden: fitAloneLogit.mcFadden,
    logisticMadePostseasonJoint: fitJointLogit.terms,
    logisticMadePostseasonJointMcFadden: fitJointLogit.mcFadden,
    leaveOneOrgOut: looResults,
    leaveOneOrgOutSameSignCount: looSameSign,
    leaveOneOrgOutTotal: looResults.length,
    leaveOneOrgOutAllSignificant: looAllSig,
    permutationP: permP,
    permutationReps: NPERM,
  },
}
writeFileSync(join(__dirname, 'tenure-lag-panel.json'), JSON.stringify(out, null, 2))
console.log(`\nWrote ${join(__dirname, 'tenure-lag-panel.json')}`)
