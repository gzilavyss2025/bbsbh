// Contender Diary spike: does an organization-season's MIX of Triple-A exit
// reasons (merit-based promotion share vs. injury/roster-rule/trade combined,
// per docs/price-the-blockage.md's own classification) predict how far that
// org's major-league club goes on the 0-5 outcome ladder?
//
// Deliberately NOT the homegrown-share question (docs/team-success-homegrown.md)
// and NOT the org-tenure/speed question (a sibling spike) - this is about WHY
// a stint ends, not how much of the roster is homegrown or how long it took.
//
// Data: .scratch/team-success/exit-reason-mix.json (built by
// build-exit-reason-mix.mjs in this same directory, from
// .scratch/blockage/exits.json - the 962-stay, 2009-2023 cohort) joined to
// .scratch/team-success/outcome-ladder.json on (year, teamId).
//
// Method follows docs/team-success-research.md's "Statistical approach":
// ordered logit on the 0-5 ladder, era control, league(season)-relative
// version of the factor, leave-one-out + permutation robustness, a
// volume/playing-time-style control on the SHARE measure, and the
// division-winner-vs-wild-card cut.
//
// Run: node .scratch/team-success/analyze-exit-reason-mix.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logistic, twoTailedP, mean, median, zscoreBy } from '../blockage/lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

const mix = JSON.parse(readFileSync(join(__dirname, 'exit-reason-mix.json'), 'utf8'))
const ladderDoc = JSON.parse(readFileSync(join(ROOT, '.scratch/team-success/outcome-ladder.json'), 'utf8'))

const YEARS = []
for (let y = 2009; y <= 2023; y += 1) YEARS.push(y)

const ladderByKey = new Map()
for (const season of ladderDoc.seasons) {
  if (!YEARS.includes(season.year)) continue
  for (const [teamId, info] of Object.entries(season.teams)) {
    ladderByKey.set(`${season.year}:${teamId}`, { ...info, era: season.era, shortSeason: !!season.shortSeason })
  }
}

// ---------------------------------------------------------------------------
// Join. An org-season with a classified exit but NOT in the ladder map would
// mean a franchise id mismatch - assert none.
// ---------------------------------------------------------------------------
const rows = []
for (const o of mix.orgSeasons) {
  const key = `${o.season}:${o.teamId}`
  const l = ladderByKey.get(key)
  if (!l) { console.error(`NO LADDER ROW for ${key} (total=${o.total})`); continue }
  rows.push({ ...o, ...l })
}
console.log(`${rows.length} of ${mix.orgSeasons.length} organization-seasons joined to the ladder (should be all)`)

// ---------------------------------------------------------------------------
// Spearman rho (rank correlation), matching the homegrown-share spike's own
// primary test.
// ---------------------------------------------------------------------------
function rankOf(arr) {
  const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
  const ranks = new Array(arr.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j += 1
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k += 1) ranks[idx[k][1]] = avgRank
    i = j + 1
  }
  return ranks
}
function pearson(a, b) {
  const ma = mean(a); const mb = mean(b)
  let num = 0; let da = 0; let db = 0
  for (let i = 0; i < a.length; i += 1) {
    num += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return num / Math.sqrt(da * db)
}
function spearman(a, b) { return pearson(rankOf(a), rankOf(b)) }
function partialCorr(rXY, rXZ, rYZ) {
  return (rXY - rXZ * rYZ) / Math.sqrt((1 - rXZ ** 2) * (1 - rYZ ** 2))
}

function seedRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function permutationP(values, ladder, seasons, draws = 5000, seed = 20260826) {
  const rng = seedRandom(seed)
  const obs = spearman(values, ladder)
  const bySeasonIdx = new Map()
  seasons.forEach((s, i) => {
    if (!bySeasonIdx.has(s)) bySeasonIdx.set(s, [])
    bySeasonIdx.get(s).push(i)
  })
  let extreme = 0
  for (let d = 0; d < draws; d += 1) {
    const shuffled = values.slice()
    for (const idxs of bySeasonIdx.values()) {
      const vals = idxs.map((i) => shuffled[i])
      for (let i = vals.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1))
        ;[vals[i], vals[j]] = [vals[j], vals[i]]
      }
      idxs.forEach((idx, k) => { shuffled[idx] = vals[k] })
    }
    const r = spearman(shuffled, ladder)
    if (Math.abs(r) >= Math.abs(obs)) extreme += 1
  }
  return { obs, p: extreme / draws }
}

// ---------------------------------------------------------------------------
// Main measure: meritShare = merit / (merit + rosterRule + injury + traded),
// restricted to org-seasons with >=1 classified exit. total = volume of
// classified exits that season (the SHARE's playing-time-style control,
// per docs/team-success-postseason-usage.md's rule for any share measure).
// ---------------------------------------------------------------------------
function runCut(cutRows, label) {
  const meritShare = cutRows.map((r) => r.meritShare)
  const ladder = cutRows.map((r) => r.ladder)
  const total = cutRows.map((r) => r.total)
  const seasons = cutRows.map((r) => r.season)

  const rhoRaw = spearman(meritShare, ladder)
  const perm = permutationP(meritShare, ladder, seasons)
  const rhoShareTotal = spearman(meritShare, total)
  const rhoTotalLadder = spearman(total, ladder)
  const partial = partialCorr(rhoRaw, rhoShareTotal, rhoTotalLadder)

  console.log(`\n--- ${label} (n=${cutRows.length}) ---`)
  console.log(`  Spearman rho vs ladder: ${rhoRaw.toFixed(4)}  (permutation p, 5000 draws, shuffled within season: ${perm.p.toFixed(4)})`)
  console.log(`  rho(meritShare, exit volume): ${rhoShareTotal.toFixed(4)}   rho(exit volume, ladder): ${rhoTotalLadder.toFixed(4)}`)
  console.log(`  PARTIAL rho controlling for exit volume: ${partial.toFixed(4)}`)

  // leave-one-season-out
  const uniqSeasons = [...new Set(seasons)]
  let sameSign = 0
  for (const s of uniqSeasons) {
    const keep = cutRows.map((r, i) => i).filter((i) => seasons[i] !== s)
    const r = spearman(keep.map((i) => meritShare[i]), keep.map((i) => ladder[i]))
    if (Math.sign(r) === Math.sign(rhoRaw)) sameSign += 1
  }
  console.log(`  leave-one-season-out: same sign in ${sameSign}/${uniqSeasons.length} refits`)

  // leave-one-org-out
  const uniqOrgs = [...new Set(cutRows.map((r) => r.teamId))]
  let sameSignOrg = 0
  for (const t of uniqOrgs) {
    const keep = cutRows.map((r, i) => i).filter((i) => cutRows[i].teamId !== t)
    const r = spearman(keep.map((i) => meritShare[i]), keep.map((i) => ladder[i]))
    if (Math.sign(r) === Math.sign(rhoRaw)) sameSignOrg += 1
  }
  console.log(`  leave-one-organization-out: same sign in ${sameSignOrg}/${uniqOrgs.length} refits`)

  return { label, n: cutRows.length, rho: rhoRaw, permP: perm.p, partial, sameSignSeason: `${sameSign}/${uniqSeasons.length}`, sameSignOrg: `${sameSignOrg}/${uniqOrgs.length}` }
}

console.log('=== Organization-season exit-reason mix vs the 0-5 outcome ladder ===')
console.log(`Window: 2009-2023 (docs/price-the-blockage.md's own floor), ${rows.length} organization-seasons carry >=1 classified exit out of a possible ${YEARS.length * 30} cells`)

const rungCounts = new Array(6).fill(0)
rows.forEach((r) => { rungCounts[r.ladder] += 1 })
console.log(`rung counts among these organization-seasons: [${rungCounts.join(', ')}]`)

const main = runCut(rows, 'ALL organization-seasons, total classified exits >= 1')
const geq2 = runCut(rows.filter((r) => r.total >= 2), 'total classified exits >= 2')
const geq3 = runCut(rows.filter((r) => r.total >= 3), 'total classified exits >= 3')

// ---------------------------------------------------------------------------
// Band comparisons, same convention as docs/team-success-homegrown.md
// ---------------------------------------------------------------------------
function banded(cutRows, predFn, label, draws = 5000, seed = 555) {
  const inGroup = cutRows.filter(predFn)
  const outGroup = cutRows.filter((r) => !predFn(r))
  const mIn = mean(inGroup.map((r) => r.meritShare))
  const mOut = mean(outGroup.map((r) => r.meritShare))
  const obsDiff = mIn - mOut
  const rng = seedRandom(seed)
  const all = cutRows.map((r) => r.meritShare)
  const nIn = inGroup.length
  let extreme = 0
  for (let d = 0; d < draws; d += 1) {
    const shuffled = all.slice()
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const diff = mean(shuffled.slice(0, nIn)) - mean(shuffled.slice(nIn))
    if (Math.abs(diff) >= Math.abs(obsDiff)) extreme += 1
  }
  console.log(`  ${label}: in=${(mIn * 100).toFixed(1)}% (n=${inGroup.length}) vs out=${(mOut * 100).toFixed(1)}% (n=${outGroup.length}), diff=${(obsDiff * 100).toFixed(1)}pp, permutation p=${(extreme / draws).toFixed(4)}`)
  return { label, mIn, mOut, nIn: inGroup.length, nOut: outGroup.length, diff: obsDiff, p: extreme / draws }
}

console.log('\n--- Band comparisons (meritShare, mean, total>=1) ---')
const bandMade = banded(rows, (r) => r.madePostseason, 'Made the postseason at all')
const bandLcs = banded(rows, (r) => r.ladder >= 3, 'Reached the LCS or better (ladder>=3)')
const bandWs = banded(rows, (r) => r.ladder === 5, 'Won the World Series (ladder==5)')

// ---------------------------------------------------------------------------
// The division-winner vs wild-card cut, restricted to postseason org-seasons
// ---------------------------------------------------------------------------
const psRows = rows.filter((r) => r.madePostseason)
console.log(`\n--- Division winner vs wild card, postseason organization-seasons only (n=${psRows.length}) ---`)
const divWinners = psRows.filter((r) => r.wonDivision)
const wildCards = psRows.filter((r) => !r.wonDivision)
console.log(`  division winners: n=${divWinners.length}, mean meritShare=${(mean(divWinners.map((r) => r.meritShare)) * 100).toFixed(1)}%`)
console.log(`  wild card: n=${wildCards.length}, mean meritShare=${(mean(wildCards.map((r) => r.meritShare)) * 100).toFixed(1)}%`)
const divCut = banded(psRows, (r) => r.wonDivision, 'wonDivision', 5000, 999)

// Logistic wonDivision ~ meritShare_z + era, among postseason org-seasons,
// following the house convention (era control, standardized predictor).
const eraLevels = [...new Set(psRows.map((r) => r.era))]
const meritZps = zscoreBy(psRows, () => 'all', (r) => r.meritShare)
const eraRef = eraLevels[0]
const eraDummiesPs = eraLevels.slice(1).map((lvl) => psRows.map((r) => (r.era === lvl ? 1 : 0)))
const X_div = psRows.map((_, i) => [1, meritZps[i], ...eraDummiesPs.map((d) => d[i])])
const y_div = psRows.map((r) => (r.wonDivision ? 1 : 0))
const namesDiv = ['intercept', 'meritShare_z', ...eraLevels.slice(1).map((l) => `era_${l}`)]
const fitDiv = logistic(X_div, y_div, namesDiv)
console.log(`\nLogistic: wonDivision ~ meritShare_z + era, postseason org-seasons only (n=${psRows.length}, era reference=${eraRef})`)
for (const t of fitDiv.terms) console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)
console.log(`  McFadden pseudo-R2: ${fitDiv.mcFadden.toFixed(4)}`)

// ---------------------------------------------------------------------------
// Ordered logit (proportional odds) on the full ladder, era-controlled,
// season-relative meritShare, volume control. Optimizer lifted from
// .scratch/team-success/analyze-trade-deadline.mjs's own orderedLogit (same
// program, same house convention), copied here rather than imported since
// that file is a sibling spike's own script, not a shared library.
// ---------------------------------------------------------------------------
function orderedLogitLogLik(params, X, y, J) {
  const p = X[0].length
  const beta = params.slice(0, p)
  const rawCuts = params.slice(p)
  const cuts = []
  let acc = rawCuts[0]
  cuts.push(acc)
  for (let j = 1; j < rawCuts.length; j += 1) { acc += Math.exp(rawCuts[j]); cuts.push(acc) }
  const sigmoid = (z) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))))
  let ll = 0
  for (let i = 0; i < X.length; i += 1) {
    let eta = 0
    for (let k = 0; k < p; k += 1) eta += X[i][k] * beta[k]
    const yi = y[i]
    const gLow = yi === 0 ? 0 : sigmoid(cuts[yi - 1] - eta)
    const gHigh = yi === J - 1 ? 1 : sigmoid(cuts[yi] - eta)
    ll += Math.log(Math.max(gHigh - gLow, 1e-12))
  }
  return ll
}
function numGrad(f, params, h = 1e-5) {
  return params.map((_, i) => {
    const up = params.slice(); up[i] += h
    const down = params.slice(); down[i] -= h
    return (f(up) - f(down)) / (2 * h)
  })
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
      H[i][j] = val; H[j][i] = val
    }
  }
  return H
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
    let step = 1; let accepted = false
    for (let tries = 0; tries < 40; tries += 1) {
      const cand = params.map((v, i) => v + step * g[i])
      const llCand = f(cand)
      if (llCand > ll) { params = cand; ll = llCand; accepted = true; break }
      step *= 0.5
    }
    if (!accepted) break
  }
  const H = numHessian(f, params)
  const negH = H.map((row) => row.map((v) => -v))
  const cov = invertSmall(negH)
  const wellIdentified = cov != null && cov.every((row, i) => row[i] > 0 && Number.isFinite(row[i]))
  const se = cov ? params.map((_, i) => Math.sqrt(Math.max(cov[i][i], 0))) : params.map(() => NaN)
  const betaTerms = featureNames.map((nm, i) => ({
    name: nm, beta: params[i], se: se[i], z: params[i] / se[i], p: twoTailedP(params[i] / se[i]), oddsRatio: Math.exp(params[i]),
  }))
  return { ll, wellIdentified, betaTerms }
}

console.log('\n--- Ordered logit: ladder(0-5) ~ meritShare_z + log(exitVolume)_z + era, total>=1 (n=%d) ---', rows.length)
const meritZ = zscoreBy(rows, (r) => r.season, (r) => r.meritShare)
const volZ = zscoreBy(rows, (r) => r.season, (r) => Math.log1p(r.total))
const eraLevelsAll = [...new Set(rows.map((r) => r.era))]
const eraRefAll = eraLevelsAll[0]
const eraDummiesAll = eraLevelsAll.slice(1).map((lvl) => rows.map((r) => (r.era === lvl ? 1 : 0)))
const X_ord = rows.map((_, i) => [meritZ[i], volZ[i], ...eraDummiesAll.map((d) => d[i])])
const y_ord = rows.map((r) => r.ladder)
const namesOrd = ['meritShare_z', 'logExitVolume_z', ...eraLevelsAll.slice(1).map((l) => `era_${l}`)]
console.log(`  era reference level: ${eraRefAll}`)
const ordFit = fitOrderedLogit(X_ord, y_ord, 6, namesOrd)
console.log(`  well-identified: ${ordFit.wellIdentified}`)
for (const t of ordFit.betaTerms) console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)

// Same model, dropping 2020 explicitly (house style's alternative to an era dummy)
const rowsNo2020 = rows.filter((r) => r.season !== 2020)
console.log(`\n--- Same ordered logit, 2020 dropped instead of dummied (n=${rowsNo2020.length}) ---`)
const meritZ2 = zscoreBy(rowsNo2020, (r) => r.season, (r) => r.meritShare)
const volZ2 = zscoreBy(rowsNo2020, (r) => r.season, (r) => Math.log1p(r.total))
const eraLevels2 = [...new Set(rowsNo2020.map((r) => r.era))]
const eraDummies2 = eraLevels2.slice(1).map((lvl) => rowsNo2020.map((r) => (r.era === lvl ? 1 : 0)))
const X_ord2 = rowsNo2020.map((_, i) => [meritZ2[i], volZ2[i], ...eraDummies2.map((d) => d[i])])
const y_ord2 = rowsNo2020.map((r) => r.ladder)
const names2 = ['meritShare_z', 'logExitVolume_z', ...eraLevels2.slice(1).map((l) => `era_${l}`)]
const ordFit2 = fitOrderedLogit(X_ord2, y_ord2, 6, names2)
console.log(`  well-identified: ${ordFit2.wellIdentified}`)
for (const t of ordFit2.betaTerms) console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)

// ---------------------------------------------------------------------------
// Organization-level pooled sensitivity check (30 orgs, all seasons 2009-2023
// combined) - the sturdier grain given how thin the org-season cells are.
// Ladder value per org = mean ladder rung across its own 2009-2023 seasons.
// ---------------------------------------------------------------------------
const orgLadderMean = new Map()
for (const [key, l] of ladderByKey) {
  const [, teamId] = key.split(':')
  const t = Number(teamId)
  if (!orgLadderMean.has(t)) orgLadderMean.set(t, [])
  orgLadderMean.get(t).push(l.ladder)
}
const orgRows = mix.orgs.filter((o) => o.total >= 1 && orgLadderMean.has(o.teamId)).map((o) => ({
  ...o, ladderMean: mean(orgLadderMean.get(o.teamId)),
}))
console.log(`\n--- Organization-level pooled sensitivity check (n=${orgRows.length} organizations, meritShare pooled 2009-2023 vs. mean ladder rung over the same window) ---`)
const orgRho = spearman(orgRows.map((r) => r.meritShare), orgRows.map((r) => r.ladderMean))
console.log(`  Spearman rho: ${orgRho.toFixed(4)}`)
const sortedOrgs = [...orgRows].sort((a, b) => b.meritShare - a.meritShare)
console.log('  highest merit-share organizations:')
for (const o of sortedOrgs.slice(0, 5)) console.log(`    ${o.teamName}: meritShare=${(o.meritShare * 100).toFixed(1)}% (n=${o.total}), mean ladder=${o.ladderMean.toFixed(2)}`)
console.log('  lowest merit-share organizations:')
for (const o of sortedOrgs.slice(-5)) console.log(`    ${o.teamName}: meritShare=${(o.meritShare * 100).toFixed(1)}% (n=${o.total}), mean ladder=${o.ladderMean.toFixed(2)}`)

// ---------------------------------------------------------------------------
// PR #904 named two specific confounds in this exact data: transaction-wire
// noise conflating merit/injury/rosterRule, and a joint-multinomial-vs-
// separate-fits difference for "traded". Probe both at this grain.
//
// "traded" is 2 of 962 stays in the whole cohort (0.2%) - mechanically too
// small to move an organization-season aggregate; confirmed below rather
// than assumed.
//
// The wire-noise confound cannot be independently re-verified here (that
// would mean re-deriving the underlying stay-level classification, which
// this spike does not have the cached inputs to redo without a fresh
// statsapi pull). What CAN be checked without re-pulling anything: does the
// result depend on lumping injury in with rosterRule? A forced roster-rule
// event (DFA/trade/release/waiver on the incumbent) is a cleaner "the
// organization opened this spot on purpose" signal than an injury (pure
// misfortune) - if the pooled "other" bucket's null is hiding two opposite
// signs that cancel, splitting them should show it.
// ---------------------------------------------------------------------------
const tradedCount = rows.reduce((s, r) => s + r.traded, 0)
console.log(`\n--- PR #904 confound probes ---`)
console.log(`  "traded" exits in this cohort: ${tradedCount} of ${rows.reduce((s, r) => s + r.total, 0)} classified (organization-season grain) - too small to matter mechanically`)

const rrOnlyRows = rows.filter((r) => r.merit + r.rosterRule > 0).map((r) => ({
  ...r, meritShareRR: r.merit / (r.merit + r.rosterRule),
}))
const rhoRR = spearman(rrOnlyRows.map((r) => r.meritShareRR), rrOnlyRows.map((r) => r.ladder))
console.log(`  merit vs rosterRule ONLY (injury and traded excluded), n=${rrOnlyRows.length}: Spearman rho=${rhoRR.toFixed(4)}`)

const injOnlyRows = rows.filter((r) => r.merit + r.injury > 0).map((r) => ({
  ...r, meritShareInj: r.merit / (r.merit + r.injury),
}))
const rhoInj = spearman(injOnlyRows.map((r) => r.meritShareInj), injOnlyRows.map((r) => r.ladder))
console.log(`  merit vs injury ONLY (rosterRule and traded excluded), n=${injOnlyRows.length}: Spearman rho=${rhoInj.toFixed(4)}`)
console.log(`  (pooled "merit vs all three" rho was ${main.rho.toFixed(4)} - if these two run opposite signs of any size, the pooled null could be masking something; if not, splitting them buys nothing)`)

// ---------------------------------------------------------------------------
// Save distilled findings
// ---------------------------------------------------------------------------
writeFileSync(join(__dirname, 'exit-reason-mix-findings.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  n: rows.length,
  cuts: [main, geq2, geq3],
  bands: [bandMade, bandLcs, bandWs],
  divisionCut: divCut,
  orderedLogit: { terms: ordFit.betaTerms, wellIdentified: ordFit.wellIdentified },
  orderedLogitNo2020: { terms: ordFit2.betaTerms, wellIdentified: ordFit2.wellIdentified },
  wonDivisionLogistic: { terms: fitDiv.terms, mcFadden: fitDiv.mcFadden },
  orgLevel: { n: orgRows.length, rho: orgRho },
  confoundProbes: { tradedCount, rhoRosterRuleOnly: rhoRR, nRosterRuleOnly: rrOnlyRows.length, rhoInjuryOnly: rhoInj, nInjuryOnly: injOnlyRows.length },
}, null, 2))
console.log('\nWrote .scratch/team-success/exit-reason-mix-findings.json')
