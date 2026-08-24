// Step 5, the question this spike exists to answer:
//
//   Are organizations that depend more on homegrown players at the MLB level
//   faster or slower to promote players through the minors?
//
// WHAT THIS DELIBERATELY DOES NOT DO. The obvious shape -- a 30-point scatter
// of "org homegrown share" against "org promotion speed" -- is a
// spurious-finding generator here, and the prior spike is why. Per-org speed
// estimates in this data are unreliable: ICC around 1%, 0 of 30 orgs outside
// the pooled window, and which orgs look significant flips with the SE method
// (docs/team-movement-windows.md). Correlating one unreliable estimate against
// another variable at n=30 would produce a number and no information.
//
// Instead homegrownShare goes in as an org-season COVARIATE in the existing
// player-level duration model, over all the duration rows:
//
//   log(days) ~ level + tier + era3 + homegrownShare[org,S-k] + winPct[org,S-k] + org
//
// Both versions are run and both are reported:
//
//   WITH org fixed effects -- the coefficient is then identified from WITHIN-org
//     variation over time ("when an org's homegrown dependence rises, does it
//     promote faster?"), which controls every time-invariant org difference.
//     This is the clean design. homegrown-precheck.mjs establishes it has power:
//     68% of the variance in homegrownShare is within-org.
//   WITHOUT org fixed effects -- between-org, which is the n=30 problem in
//     disguise. Reported so the difference between the two is visible rather
//     than a methodological choice made off-screen.
//
// THE SE TRAP (Moulton). homegrownShare varies only at org-season level while
// the outcome is per-duration. Clustering by PLAYER -- what every existing
// script in this directory does, correctly, for ITS regressors -- is wrong for
// this one and would badly understate its standard error. So the reported SE is
// two-way clustered on ORG and PLAYER (Cameron-Gelbach-Miller), with the
// org-only and player-only and naive versions printed beside it so the size of
// the correction is visible. Never assume the direction of an SE correction:
// the prior spike found cluster-robust intervals NARROWER than naive for 18 of
// 30 orgs.
//
// LAGGING. Homegrown share in season S is partly the RESULT of past promotion
// decisions -- promote a homegrown player and his playing time raises the share
// that same year. So the primary specification lags the covariate to S-1, with
// contemporaneous and a three-year trailing mean reported beside it. NONE of
// these establish causality. Everything below is association.
//
// ERA FLOOR. The transaction wire has no usable coverage before 2009 and the
// two years after it are truncated by the instrument rather than by behaviour
// (docs/team-movement-windows.md, "A1"). The primary specification floors
// transition years at 2011 for that reason; the unfloored fit is reported as a
// sensitivity, not hidden.
//
// Writes homegrown-duration-model.json.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { here, cached, buildOrgMap } from './homegrown-lib.mjs'
import { selfTest, fitOLS, clusterCov, twoWayClusterCov, jointWaldF, withinBetween, normalTwoSidedP, tTwoSidedP } from './homegrown-stats.mjs'

const fails = selfTest({ verbose: false })
if (fails.length) {
  console.error(`numeric self-test failed (${fails.join(', ')}); refusing to run on real data`)
  process.exit(1)
}
console.log('numeric self-test passed\n')

const raw = JSON.parse(await readFile(join(here, 'raw.json'), 'utf8'))
const dates = JSON.parse(await readFile(join(here, 'dates.json'), 'utf8'))
const findings = JSON.parse(await readFile(join(here, 'findings.json'), 'utf8'))
const panelFile = JSON.parse(await readFile(join(here, 'homegrown-panel.json'), 'utf8'))
const draftCache = JSON.parse(await readFile(join(here, 'draft-cache.json'), 'utf8'))
const disputedIds = new Set(findings.validation.disagree.map((d) => d.playerId))

const orgMap = await buildOrgMap({ seasonMin: 1997, seasonMax: 2023 })

// --- org for a duration, exactly as org-regression.mjs resolves it ------------
// The org here is the club DOING the promoting -- the player's own minor-league
// team at that level, joined against the season-scoped org map, using the exact
// season the transition resolved to (the field dates.mjs stamps; the earlier
// per-player season guess was the adversarial review's bug).
const playersById = new Map(Object.entries(raw.players).map(([id, p]) => [Number(id), p]))
const LEVEL_SPORT = { A: 14, 'High-A': 13, AA: 12, AAA: 11 }
function orgForDuration(playerId, level, season) {
  const p = playersById.get(playerId)
  if (!p) return null
  const rows = (p.milb ?? []).filter((r) => r.sportId === LEVEL_SPORT[level])
  if (!rows.length) return null
  let best = rows[0]
  for (const r of rows) if (Math.abs(r.season - season) < Math.abs(best.season - season)) best = r
  // buildOrgMap stores a [orgId, orgName] tuple, not an object
  const hit = orgMap.get(`${best.teamId}:${best.season}`)
  return hit ? { orgId: hit[0], orgName: hit[1] } : null
}

// --- draft tier, from the CORRECTED draft record ------------------------------
// raw.json's ped.draftRound came from drafts[0], which can be an earlier
// UNSIGNED draft. draft-cache.json holds the full drafts[] array, so the tier
// here uses identity.js's draftInfo() rule instead. How many players that moves
// is measured below rather than assumed to be zero.
function tierFromRound(round) {
  if (!round) return 'No draft record'
  const r = String(round)
  if (r === '1' || r === '1C' || r === 'CB-A' || r === 'C-A') return 'Round 1'
  const n = Number(r)
  if (!Number.isFinite(n)) return 'Round 1'
  if (n <= 5 || r === '2C' || r === 'CB-B') return 'Rounds 2-5'
  if (n <= 10) return 'Rounds 6-10'
  return 'Round 11+'
}
function correctedTier(playerId) {
  const person = draftCache[playerId]
  if (!person) return tierFromRound(playersById.get(playerId)?.ped?.draftRound)
  const drafts = person.drafts ?? []
  const signed = drafts.find((d) => String(d.year) === String(person.draftYear)) ?? (drafts.length ? drafts[drafts.length - 1] : null)
  return tierFromRound(signed?.pickRound)
}
let tierMoved = 0
for (const id of playersById.keys()) {
  if (correctedTier(id) !== tierFromRound(playersById.get(id)?.ped?.draftRound)) tierMoved++
}
console.log(`draft tier: ${tierMoved} of ${playersById.size} cohort players change tier under the corrected draft rule`)

// --- the org-season covariates -------------------------------------------------
const panelByKey = new Map(panelFile.panel.map((r) => [`${r.orgId}:${r.season}`, r]))
function covariatesFor(orgId, season, lag) {
  if (lag === 'trailing3') {
    const vals = []
    const wins = []
    for (let k = 1; k <= 3; k++) {
      const p = panelByKey.get(`${orgId}:${season - k}`)
      if (p) {
        vals.push(p.homegrownShare)
        if (p.winPct != null) wins.push(p.winPct)
      }
    }
    if (vals.length < 3 || wins.length < 3) return null
    return { share: vals.reduce((a, b) => a + b, 0) / 3, winPct: wins.reduce((a, b) => a + b, 0) / 3 }
  }
  const p = panelByKey.get(`${orgId}:${season - lag}`)
  if (!p || p.winPct == null) return null
  return { share: p.homegrownShare, winPct: p.winPct }
}

const ERA3 = (season) => (season <= 2015 ? 'A (<=2015)' : season <= 2020 ? 'B (2016-2020)' : 'C (2021-2023)')

function buildRows(lag) {
  const rows = []
  let noOrg = 0
  let noCov = 0
  for (const d of dates.allDurations) {
    if (disputedIds.has(d.playerId)) continue
    if (d.days <= 0) continue
    const org = orgForDuration(d.playerId, d.level, d.season)
    if (!org) {
      noOrg++
      continue
    }
    const cov = covariatesFor(org.orgId, d.season, lag)
    if (!cov) {
      noCov++
      continue
    }
    rows.push({
      playerId: d.playerId,
      orgId: org.orgId,
      orgName: org.orgName,
      level: d.level,
      tier: correctedTier(d.playerId),
      season: d.season,
      era3: ERA3(d.season),
      days: d.days,
      logDays: Math.log(d.days),
      share: cov.share,
      winPct: cov.winPct,
    })
  }
  return { rows, noOrg, noCov }
}

// --- design + fit --------------------------------------------------------------
const TIERS = ['Round 1', 'Rounds 2-5', 'Rounds 6-10', 'Round 11+', 'No draft record']
const ERAS = ['A (<=2015)', 'B (2016-2020)', 'C (2021-2023)']

function fitSpec(rows, { orgFE, label }) {
  const levels = ['A', 'High-A', 'AA', 'AAA'].filter((l) => rows.some((r) => r.level === l))
  const tiers = TIERS.filter((t) => rows.some((r) => r.tier === t))
  const eras = ERAS.filter((e) => rows.some((r) => r.era3 === e))
  const orgIds = [...new Set(rows.map((r) => r.orgId))].sort((a, b) => a - b)
  const levelRef = levels[levels.length - 1]
  const tierRef = tiers[tiers.length - 1]
  const eraRef = eras[eras.length - 1]
  const orgRef = orgIds[orgIds.length - 1]
  const levelCols = levels.filter((l) => l !== levelRef)
  const tierCols = tiers.filter((t) => t !== tierRef)
  const eraCols = eras.filter((e) => e !== eraRef)
  const orgCols = orgFE ? orgIds.filter((o) => o !== orgRef) : []

  // standardise the two continuous covariates so the coefficients are per-SD and
  // comparable to each other; the per-10-points version is derived after
  const shareMean = rows.reduce((s, r) => s + r.share, 0) / rows.length
  const shareSD = Math.sqrt(rows.reduce((s, r) => s + (r.share - shareMean) ** 2, 0) / rows.length)
  const winMean = rows.reduce((s, r) => s + r.winPct, 0) / rows.length
  const winSD = Math.sqrt(rows.reduce((s, r) => s + (r.winPct - winMean) ** 2, 0) / rows.length)

  const designRow = (r) => {
    const row = [1]
    for (const l of levelCols) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
    for (const t of tierCols) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
    for (const e of eraCols) row.push(r.era3 === e ? 1 : r.era3 === eraRef ? -1 : 0)
    row.push((r.share - shareMean) / shareSD)
    row.push((r.winPct - winMean) / winSD)
    for (const o of orgCols) row.push(r.orgId === o ? 1 : r.orgId === orgRef ? -1 : 0)
    return row
  }
  const shareIdx = 1 + levelCols.length + tierCols.length + eraCols.length
  const winIdx = shareIdx + 1
  const orgStart = winIdx + 1

  const X = rows.map(designRow)
  const y = rows.map((r) => r.logDays)
  const fit = fitOLS(X, y)
  const playerKeys = rows.map((r) => r.playerId)
  const orgKeys = rows.map((r) => r.orgId)
  const orgSeasonKeys = rows.map((r) => `${r.orgId}:${r.season}`)

  const byPlayer = clusterCov(X, fit.resid, playerKeys, fit.XtXinv)
  const byOrg = clusterCov(X, fit.resid, orgKeys, fit.XtXinv)
  const byOrgSeason = clusterCov(X, fit.resid, orgSeasonKeys, fit.XtXinv)
  const twoWay = twoWayClusterCov(X, fit.resid, orgKeys, playerKeys, fit.XtXinv)

  // a coefficient on a standardised regressor, reported four SE ways
  const report = (idx, name) => {
    const b = fit.beta[idx]
    const se = {
      naive: Math.sqrt(fit.naiveCov[idx][idx]),
      byPlayer: Math.sqrt(byPlayer.cov[idx][idx]),
      byOrg: Math.sqrt(byOrg.cov[idx][idx]),
      byOrgSeason: Math.sqrt(byOrgSeason.cov[idx][idx]),
      twoWay: twoWay.cov[idx][idx] > 0 ? Math.sqrt(twoWay.cov[idx][idx]) : null,
    }
    // the org-clustered t uses G-1 df, the honest small-sample charge for 30 clusters
    const dfOrg = byOrg.G - 1
    return {
      name,
      betaPerSD: b,
      pctPerSD: (Math.exp(b) - 1) * 100,
      se,
      z: { naive: b / se.naive, byPlayer: b / se.byPlayer, byOrg: b / se.byOrg, twoWay: se.twoWay ? b / se.twoWay : null },
      pNaive: normalTwoSidedP(b / se.naive),
      pByPlayer: normalTwoSidedP(b / se.byPlayer),
      pByOrgClusterT: tTwoSidedP(b / se.byOrg, dfOrg),
      pTwoWayClusterT: se.twoWay ? tTwoSidedP(b / se.twoWay, dfOrg) : null,
      dfOrgClusters: dfOrg,
    }
  }

  const share = report(shareIdx, 'homegrownShare (per SD)')
  const win = report(winIdx, 'winPct (per SD)')
  // per 10 percentage points of share, the units a reader can hold
  share.pctPer10pts = (Math.exp((share.betaPerSD * 0.1) / shareSD) - 1) * 100
  win.pctPer10pts = (Math.exp((win.betaPerSD * 0.1) / winSD) - 1) * 100

  let orgOmnibus = null
  if (orgFE) {
    const betaBlock = orgCols.map((_, i) => fit.beta[orgStart + i])
    const covBlock = orgCols.map((_, i) => orgCols.map((_, j) => byPlayer.cov[orgStart + i][orgStart + j]))
    orgOmnibus = jointWaldF(betaBlock, covBlock, byPlayer.G - fit.p)
  }

  return {
    label,
    orgFE,
    n: fit.n,
    p: fit.p,
    r2: fit.r2,
    sigma2: fit.sigma2,
    clusters: { players: byPlayer.G, orgs: byOrg.G, orgSeasons: byOrgSeason.G, twoWayIntersect: twoWay.GAB },
    twoWayNonPositive: twoWay.nonPositive.length,
    shareMean,
    shareSD,
    winMean,
    winSD,
    share,
    win,
    orgOmnibus,
  }
}

function printSpec(s) {
  console.log(`\n--- ${s.label} ---`)
  console.log(`n=${s.n} durations, p=${s.p} columns, R^2=${s.r2.toFixed(4)}, sigma^2=${s.sigma2.toFixed(4)}`)
  console.log(`clusters: ${s.clusters.orgs} orgs, ${s.clusters.players} players, ${s.clusters.orgSeasons} org-seasons`)
  for (const c of [s.share, s.win]) {
    console.log(`  ${c.name}`)
    console.log(`    effect: ${c.pctPerSD >= 0 ? '+' : ''}${c.pctPerSD.toFixed(2)}% days per +1 SD  (${c.pctPer10pts >= 0 ? '+' : ''}${c.pctPer10pts.toFixed(2)}% per +10 points)`)
    console.log(`    SE  naive ${c.se.naive.toFixed(4)} | by player ${c.se.byPlayer.toFixed(4)} | by ORG ${c.se.byOrg.toFixed(4)} | two-way ${c.se.twoWay == null ? 'non-positive' : c.se.twoWay.toFixed(4)}`)
    console.log(`    p   naive ${c.pNaive.toExponential(2)} | by player ${c.pByPlayer.toExponential(2)} | by ORG (t, df=${c.dfOrgClusters}) ${c.pByOrgClusterT.toFixed(4)} | two-way ${c.pTwoWayClusterT == null ? 'n/a' : c.pTwoWayClusterT.toFixed(4)}`)
  }
  if (s.orgOmnibus) console.log(`  org block omnibus (player-clustered): F(${s.orgOmnibus.dfNum},${s.orgOmnibus.dfDenom})=${s.orgOmnibus.F.toFixed(3)}, p=${s.orgOmnibus.p.toFixed(4)}`)
}

// --- run ------------------------------------------------------------------------
const out = { specs: [], preChecks: {} }
const LAGS = [
  { lag: 1, name: 'lagged S-1' },
  { lag: 0, name: 'contemporaneous S' },
  { lag: 'trailing3', name: 'trailing 3-year mean' },
]
const YEAR_FLOORS = [
  { floor: 2011, name: 'wire floor 2011' },
  { floor: null, name: 'no year floor' },
]

for (const { lag, name: lagName } of LAGS) {
  const built = buildRows(lag)
  for (const { floor, name: floorName } of YEAR_FLOORS) {
    const rows = floor ? built.rows.filter((r) => r.season >= floor) : built.rows
    if (rows.length < 200) continue
    const label = `${lagName}, ${floorName}`
    if (lag === 1 && floor === 2011) {
      console.log(`\nrow assembly (${label}): ${rows.length} durations kept; ${built.noOrg} dropped for no org, ${built.noCov} for no covariate`)
      // the power pre-check, on the rows actually used
      const cells = [...new Map(rows.map((r) => [`${r.orgId}:${r.season}`, { orgId: r.orgId, season: r.season, share: r.share }])).values()]
      const wb = withinBetween(cells, 'orgId', 'share')
      console.log(`covariate variation on the fitted org-season cells: within-org SD ${wb.withinSD.toFixed(4)} vs between-org SD ${wb.betweenSD.toFixed(4)} (${(wb.withinShareOfVariance * 100).toFixed(1)}% within) over ${wb.n} cells, ${wb.groups} orgs`)
      out.preChecks.fittedCellVariation = wb
    }
    for (const orgFE of [true, false]) {
      const s = fitSpec(rows, { orgFE, label: `${label} | org FE ${orgFE ? 'ON' : 'OFF'}` })
      printSpec(s)
      out.specs.push(s)
    }
  }
}

// ============================================================================
// ROBUSTNESS on the primary specification (lagged S-1, wire floor 2011, org FE)
// ============================================================================
const primaryRows = buildRows(1).rows.filter((r) => r.season >= 2011)
const primaryFE = out.specs.find((s) => s.label.startsWith('lagged S-1, wire floor 2011') && s.orgFE)

// --- how much does the covariate actually buy? --------------------------------
// A significant coefficient and a negligible incremental R^2 are both facts and
// the write-up needs both. Same rows, same design, share column removed.
function fitDropShare(rows) {
  const levels = ['A', 'High-A', 'AA', 'AAA'].filter((l) => rows.some((r) => r.level === l))
  const tiers = TIERS.filter((t) => rows.some((r) => r.tier === t))
  const eras = ERAS.filter((e) => rows.some((r) => r.era3 === e))
  const orgIds = [...new Set(rows.map((r) => r.orgId))].sort((a, b) => a - b)
  const levelRef = levels[levels.length - 1]
  const tierRef = tiers[tiers.length - 1]
  const eraRef = eras[eras.length - 1]
  const orgRef = orgIds[orgIds.length - 1]
  const X = rows.map((r) => {
    const row = [1]
    for (const l of levels.filter((x) => x !== levelRef)) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
    for (const t of tiers.filter((x) => x !== tierRef)) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
    for (const e of eras.filter((x) => x !== eraRef)) row.push(r.era3 === e ? 1 : r.era3 === eraRef ? -1 : 0)
    row.push(r.winPct)
    for (const o of orgIds.filter((x) => x !== orgRef)) row.push(r.orgId === o ? 1 : r.orgId === orgRef ? -1 : 0)
    return row
  })
  return fitOLS(
    X,
    rows.map((r) => r.logDays),
  )
}
const withoutShare = fitDropShare(primaryRows)
console.log('\n=== robustness on the primary spec (lagged S-1, floor 2011, org FE) ===')
console.log(`incremental R^2 from homegrownShare: ${primaryFE.r2.toFixed(5)} - ${withoutShare.r2.toFixed(5)} = ${(primaryFE.r2 - withoutShare.r2).toFixed(5)}`)
out.robustness = { incrementalR2: primaryFE.r2 - withoutShare.r2, r2WithShare: primaryFE.r2, r2WithoutShare: withoutShare.r2 }

// --- leave one org out ---------------------------------------------------------
// 30 clusters is few. If the coefficient rests on one or two organizations, the
// org-clustered p-value is not the whole story and the reader should see which.
console.log('\nleave-one-org-out (coefficient in % days per +1 SD):')
const loo = []
for (const drop of [...new Set(primaryRows.map((r) => r.orgId))].sort((a, b) => a - b)) {
  const sub = primaryRows.filter((r) => r.orgId !== drop)
  const s = fitSpec(sub, { orgFE: true, label: `drop ${drop}` })
  loo.push({ orgId: drop, orgName: primaryRows.find((r) => r.orgId === drop).orgName, pctPerSD: s.share.pctPerSD, pByOrg: s.share.pByOrgClusterT })
}
loo.sort((a, b) => a.pctPerSD - b.pctPerSD)
console.log(`  full sample: ${primaryFE.share.pctPerSD.toFixed(2)}%, p=${primaryFE.share.pByOrgClusterT.toFixed(4)}`)
console.log(`  range across the 30 leave-one-out fits: ${loo[0].pctPerSD.toFixed(2)}% (drop ${loo[0].orgName}) to ${loo[loo.length - 1].pctPerSD.toFixed(2)}% (drop ${loo[loo.length - 1].orgName})`)
const looStillSig = loo.filter((l) => l.pByOrg < 0.05).length
console.log(`  still p<0.05 with org-clustered SE in ${looStillSig} of ${loo.length} leave-one-out fits`)
out.robustness.leaveOneOrgOut = loo

// --- within-org permutation test ------------------------------------------------
// The org-clustered t charges df = G-1 = 29, which is the standard small-sample
// correction, but 30 clusters with a regressor that is constant within an
// org-season is exactly where that correction is known to stay optimistic. So
// the p-value is checked against a randomization distribution instead of taken
// on faith.
//
// The permutation preserves what the fixed-effects design conditions on and
// destroys only what it claims to use: WITHIN each org, the season -> share
// mapping is shuffled across that org's own seasons. Org means are untouched
// (the fixed effects absorb them anyway), each org's marginal distribution of
// shares is untouched, and the alignment between a season's share and that
// season's durations is broken. winPct rides the same permutation, so the pair
// keeps its own correlation.
function mulberry32(a) {
  return function rng() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const PERM_DRAWS = 500
const PERM_SEED = 20260824
const rng = mulberry32(PERM_SEED)
const seasonsByOrg = new Map()
for (const r of primaryRows) {
  if (!seasonsByOrg.has(r.orgId)) seasonsByOrg.set(r.orgId, new Map())
  seasonsByOrg.get(r.orgId).set(r.season, { share: r.share, winPct: r.winPct })
}
const permCoefs = []
for (let draw = 0; draw < PERM_DRAWS; draw++) {
  const remap = new Map()
  for (const [orgId, byS] of seasonsByOrg) {
    const seasonList = [...byS.keys()]
    const vals = [...byS.values()]
    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[vals[i], vals[j]] = [vals[j], vals[i]]
    }
    seasonList.forEach((s, i) => remap.set(`${orgId}:${s}`, vals[i]))
  }
  const shuffled = primaryRows.map((r) => ({ ...r, ...remap.get(`${r.orgId}:${r.season}`) }))
  permCoefs.push(fitSpec(shuffled, { orgFE: true, label: 'perm' }).share.betaPerSD)
}
const observedBeta = primaryFE.share.betaPerSD
const moreExtreme = permCoefs.filter((b) => Math.abs(b) >= Math.abs(observedBeta)).length
const permP = (moreExtreme + 1) / (PERM_DRAWS + 1)
permCoefs.sort((a, b) => a - b)
const pct = (f) => permCoefs[Math.min(permCoefs.length - 1, Math.floor(permCoefs.length * f))]
console.log(`\nwithin-org permutation test, ${PERM_DRAWS} seeded draws:`)
console.log(`  null distribution of the coefficient: p05 ${pct(0.05).toFixed(4)}, median ${pct(0.5).toFixed(4)}, p95 ${pct(0.95).toFixed(4)}`)
console.log(`  observed: ${observedBeta.toFixed(4)}`)
console.log(`  two-sided permutation p = ${permP.toFixed(4)} (${moreExtreme} of ${PERM_DRAWS} draws at least as extreme)`)
console.log(`  for comparison, the org-clustered t gave p = ${primaryFE.share.pByOrgClusterT.toFixed(4)}`)
out.robustness.permutation = { draws: PERM_DRAWS, seed: PERM_SEED, observedBeta, permP, moreExtreme, nullP05: pct(0.05), nullMedian: pct(0.5), nullP95: pct(0.95) }

// --- full season fixed effects instead of the three era buckets --------------------
// The sharpest alternative explanation for the headline coefficient is a
// league-wide time pattern in BOTH series leaking through a coarse control.
// Homegrown share does drift over the span (up into 2011-2014, down after) and
// days-at-level has a time pattern of its own that the prior spike spent a whole
// pass establishing is mostly instrument. Three era buckets cannot absorb that;
// a full set of transition-year dummies can. With org FE and season FE together,
// the coefficient is identified from an org's deviation from ITS OWN average
// relative to the LEAGUE'S deviation that same year, which is the strongest
// version of the design available here.
function fitSeasonFE(rows, { orgFE, label }) {
  const levels = ['A', 'High-A', 'AA', 'AAA'].filter((l) => rows.some((r) => r.level === l))
  const tiers = TIERS.filter((t) => rows.some((r) => r.tier === t))
  const seasons = [...new Set(rows.map((r) => r.season))].sort((a, b) => a - b)
  const orgIds = [...new Set(rows.map((r) => r.orgId))].sort((a, b) => a - b)
  const levelRef = levels[levels.length - 1]
  const tierRef = tiers[tiers.length - 1]
  const seasonRef = seasons[seasons.length - 1]
  const orgRef = orgIds[orgIds.length - 1]
  const mean = rows.reduce((s, r) => s + r.share, 0) / rows.length
  const sd = Math.sqrt(rows.reduce((s, r) => s + (r.share - mean) ** 2, 0) / rows.length)
  const X = rows.map((r) => {
    const row = [1, (r.share - mean) / sd, r.winPct]
    for (const l of levels.filter((x) => x !== levelRef)) row.push(r.level === l ? 1 : r.level === levelRef ? -1 : 0)
    for (const t of tiers.filter((x) => x !== tierRef)) row.push(r.tier === t ? 1 : r.tier === tierRef ? -1 : 0)
    for (const s of seasons.filter((x) => x !== seasonRef)) row.push(r.season === s ? 1 : r.season === seasonRef ? -1 : 0)
    if (orgFE) for (const o of orgIds.filter((x) => x !== orgRef)) row.push(r.orgId === o ? 1 : r.orgId === orgRef ? -1 : 0)
    return row
  })
  const fit = fitOLS(
    X,
    rows.map((r) => r.logDays),
  )
  const byOrg = clusterCov(
    X,
    fit.resid,
    rows.map((r) => r.orgId),
    fit.XtXinv,
  )
  const twoWay = twoWayClusterCov(
    X,
    fit.resid,
    rows.map((r) => r.orgId),
    rows.map((r) => r.playerId),
    fit.XtXinv,
  )
  const b = fit.beta[1]
  const seOrg = Math.sqrt(byOrg.cov[1][1])
  const seTwo = twoWay.cov[1][1] > 0 ? Math.sqrt(twoWay.cov[1][1]) : null
  const pct = (Math.exp(b) - 1) * 100
  console.log(`\n--- ${label} ---`)
  console.log(`n=${fit.n}, p=${fit.p}, R^2=${fit.r2.toFixed(4)}`)
  console.log(`  homegrownShare: ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% days per +1 SD`)
  console.log(`  SE by org ${seOrg.toFixed(4)} (p=${tTwoSidedP(b / seOrg, byOrg.G - 1).toFixed(4)}) | two-way ${seTwo == null ? 'non-positive' : seTwo.toFixed(4)} (p=${seTwo == null ? 'n/a' : tTwoSidedP(b / seTwo, byOrg.G - 1).toFixed(4)})`)
  return { label, n: fit.n, r2: fit.r2, betaPerSD: b, pctPerSD: pct, seOrg, seTwoWay: seTwo, pByOrg: tTwoSidedP(b / seOrg, byOrg.G - 1), pTwoWay: seTwo == null ? null : tTwoSidedP(b / seTwo, byOrg.G - 1) }
}
console.log('\nfull season fixed effects in place of the three era buckets:')
out.robustness.seasonFE = {
  orgFEOn: fitSeasonFE(primaryRows, { orgFE: true, label: 'lagged S-1, floor 2011 | season FE + org FE' }),
  orgFEOff: fitSeasonFE(primaryRows, { orgFE: false, label: 'lagged S-1, floor 2011 | season FE, no org FE' }),
}

// --- split by level ---------------------------------------------------------------
console.log('\nby level (primary spec, org FE):')
for (const lvl of ['High-A', 'AA', 'AAA']) {
  const sub = primaryRows.filter((r) => r.level === lvl)
  if (sub.length < 300) {
    console.log(`  ${lvl}: n=${sub.length}, too thin to fit 30 org effects`)
    continue
  }
  const s = fitSpec(sub, { orgFE: true, label: `level ${lvl} | lagged S-1, wire floor 2011, org FE ON` })
  console.log(`  ${lvl}: n=${s.n}, ${s.share.pctPerSD >= 0 ? '+' : ''}${s.share.pctPerSD.toFixed(2)}% per SD, org-clustered p=${s.share.pByOrgClusterT.toFixed(4)}`)
  out.specs.push(s)
}

await writeFile(join(here, 'homegrown-duration-model.json'), JSON.stringify(out, null, 2))
console.log('\nwrote homegrown-duration-model.json')
