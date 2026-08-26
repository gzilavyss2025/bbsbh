// Spike #7 (partial): does net WAR acquired at the trade deadline predict how
// far a team goes that same season? Reads public/data/trade-deadline/{2021..2025}.json
// directly (no shared DuckDB view exists yet for this panel) and
// public/data/war-history/*.json for each named player's season WAR. Joins
// against the existing outcome ladder (.scratch/team-success/outcome-ladder.json).
//
// Deliberately bounded to 2021-2025 (trade-deadline data's own floor) — see
// docs/team-success-trade-deadline.md for the full write-up and caveats.
//
// Run: node .scratch/team-success/analyze-trade-deadline.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logistic, twoTailedP, mean } from '../blockage/lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

const YEARS = [2021, 2022, 2023, 2024, 2025]

// ---------------------------------------------------------------------------
// WAR lookup: public/data/war-history/{personId % 100}.json, keyed by
// personId, { [year]: warValue }. A two-way player (rare in this window) has
// entries in both `bat` and `pit`; sum both, since a trade evaluates the
// whole player, not one side of him.
// ---------------------------------------------------------------------------
function shardKey100(personId) {
  return String(Math.abs(Number(personId) || 0) % 100).padStart(2, '0')
}

const shardCache = new Map()
function loadShard(personId) {
  const key = shardKey100(personId)
  if (!shardCache.has(key)) {
    const p = join(ROOT, 'public/data/war-history', `${key}.json`)
    shardCache.set(key, JSON.parse(readFileSync(p, 'utf8')))
  }
  return shardCache.get(key)
}

function playerWarForYear(personId, year) {
  const shard = loadShard(personId)
  const bat = shard.bat?.[String(personId)]?.[String(year)]
  const pit = shard.pit?.[String(personId)]?.[String(year)]
  let total = 0
  let found = false
  if (typeof bat === 'number') { total += bat; found = true }
  if (typeof pit === 'number') { total += pit; found = true }
  return { war: found ? total : 0, found }
}

// ---------------------------------------------------------------------------
// Outcome ladder
// ---------------------------------------------------------------------------
const ladderDoc = JSON.parse(
  readFileSync(join(ROOT, '.scratch/team-success/outcome-ladder.json'), 'utf8'),
)
const ladderByYearTeam = new Map()
const teamIdsByYear = new Map()
for (const season of ladderDoc.seasons) {
  if (!YEARS.includes(season.year)) continue
  teamIdsByYear.set(season.year, Object.keys(season.teams))
  for (const [teamId, info] of Object.entries(season.teams)) {
    ladderByYearTeam.set(`${season.year}:${teamId}`, { ...info, era: season.era })
  }
}

// ---------------------------------------------------------------------------
// Team names, for the narrative
// ---------------------------------------------------------------------------
const teamsDoc = JSON.parse(readFileSync(join(ROOT, 'public/data/teams.json'), 'utf8'))
const teamNameById = new Map()
for (const list of Object.values(teamsDoc.bySportId)) {
  for (const t of list) teamNameById.set(t.id, t.name)
}

// ---------------------------------------------------------------------------
// Walk every deadline trade, accumulate net WAR acquired per (year, teamId).
// ---------------------------------------------------------------------------
const rowsByKey = new Map()
function ensure(year, teamId) {
  const key = `${year}:${teamId}`
  if (!rowsByKey.has(key)) {
    rowsByKey.set(key, {
      year,
      teamId: Number(teamId),
      received: 0,
      sent: 0,
      playersReceived: 0,
      playersSent: 0,
      receivedMissing: 0,
      sentMissing: 0,
      tradeIds: new Set(),
    })
  }
  return rowsByKey.get(key)
}

const missingLog = []
let totalTrades = 0
let totalTeamEntries = 0

for (const year of YEARS) {
  const doc = JSON.parse(
    readFileSync(join(ROOT, 'public/data/trade-deadline', `${year}.json`), 'utf8'),
  )
  totalTrades += doc.trades.length
  for (const trade of doc.trades) {
    for (const teamEntry of trade.teams) {
      totalTeamEntries += 1
      const rec = ensure(year, teamEntry.teamId)
      rec.tradeIds.add(trade.id)
      for (const player of teamEntry.sends || []) {
        const { war, found } = playerWarForYear(player.playerId, year)
        rec.sent += war
        rec.playersSent += 1
        if (!found) {
          rec.sentMissing += 1
          missingLog.push({ year, teamId: teamEntry.teamId, dir: 'sent', name: player.name, playerId: player.playerId })
        }
      }
      for (const player of teamEntry.receives || []) {
        const { war, found } = playerWarForYear(player.playerId, year)
        rec.received += war
        rec.playersReceived += 1
        if (!found) {
          rec.receivedMissing += 1
          missingLog.push({ year, teamId: teamEntry.teamId, dir: 'received', name: player.name, playerId: player.playerId })
        }
      }
    }
  }
  // Ensure every team in the league gets a row even with zero deadline activity.
  for (const teamId of teamIdsByYear.get(year)) ensure(year, teamId)
}

const rows = [...rowsByKey.values()].map((r) => {
  const ladder = ladderByYearTeam.get(`${r.year}:${r.teamId}`)
  return {
    year: r.year,
    teamId: r.teamId,
    teamName: teamNameById.get(r.teamId) || `Team ${r.teamId}`,
    received: r.received,
    sent: r.sent,
    net: r.received - r.sent,
    playersReceived: r.playersReceived,
    playersSent: r.playersSent,
    receivedMissing: r.receivedMissing,
    sentMissing: r.sentMissing,
    tradeCount: r.tradeIds.size,
    ladder: ladder.ladder,
    madePostseason: ladder.madePostseason,
    wonDivision: ladder.wonDivision,
    era: ladder.era,
  }
})

console.log(`n team-seasons: ${rows.length} (expect 150 = 30 x 5)`)
console.log(`trades read: ${totalTrades}, team-sides: ${totalTeamEntries}`)
console.log(`players with no MLB WAR that season (treated as 0): ${missingLog.length}`)

// Zero-sum sanity check: every trade transfers WAR between teams (or from a
// team to a "prospect with no WAR yet," which is 0 on both books), so the
// SUM of net WAR acquired across the whole league in one season must be ~0.
// That also means the raw net-WAR number is already league-average-relative
// (the league average is 0 by construction, every season) — no separate
// standardization step is needed for that half of the house style rule.
console.log('\nPer-year sum of net WAR acquired (should be ~0, confirms zero-sum):')
for (const year of YEARS) {
  const s = rows.filter((r) => r.year === year).reduce((a, r) => a + r.net, 0)
  console.log(`  ${year}: ${s.toFixed(3)}`)
}

// ---------------------------------------------------------------------------
// Rank correlation helpers
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
  const n = a.length
  const ma = mean(a)
  const mb = mean(b)
  let cov = 0, va = 0, vb = 0
  for (let i = 0; i < n; i += 1) {
    cov += (a[i] - ma) * (b[i] - mb)
    va += (a[i] - ma) ** 2
    vb += (b[i] - mb) ** 2
  }
  return cov / Math.sqrt(va * vb)
}

function spearman(a, b) {
  return pearson(rankOf(a), rankOf(b))
}

function seedRandom(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Main test: net WAR acquired vs. ladder rung, n=150
// ---------------------------------------------------------------------------
const netArr = rows.map((r) => r.net)
const ladderArr = rows.map((r) => r.ladder)
const yearArr = rows.map((r) => r.year)
const teamArr = rows.map((r) => r.teamId)

const rhoMain = spearman(netArr, ladderArr)
console.log(`\nSpearman(netWarAcquired, ladder), n=${rows.length}: rho=${rhoMain.toFixed(4)}`)

// Permutation test: shuffle net WAR WITHIN each year (preserves the zero-sum-
// per-year structure and each year's own ladder-rung distribution), refit
// Spearman, repeat 5000 times.
function permute(rng) {
  const shuffled = new Array(netArr.length)
  for (const year of YEARS) {
    const idxs = []
    for (let i = 0; i < yearArr.length; i += 1) if (yearArr[i] === year) idxs.push(i)
    const vals = idxs.map((i) => netArr[i])
    for (let i = vals.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1))
      ;[vals[i], vals[j]] = [vals[j], vals[i]]
    }
    idxs.forEach((idx, k) => { shuffled[idx] = vals[k] })
  }
  return shuffled
}

const rng = seedRandom(20260826)
const NPERM = 5000
let countGE = 0
const permRhos = []
for (let p = 0; p < NPERM; p += 1) {
  const shuffled = permute(rng)
  const r = spearman(shuffled, ladderArr)
  permRhos.push(r)
  if (Math.abs(r) >= Math.abs(rhoMain)) countGE += 1
}
const permP = countGE / NPERM
console.log(`Permutation test (${NPERM} reshuffles within year): p=${permP.toFixed(4)}`)
console.log(`  permutation-rho mean=${mean(permRhos).toFixed(4)}, sd=${Math.sqrt(mean(permRhos.map((r) => r * r)) - mean(permRhos) ** 2).toFixed(4)}`)

// Leave-one-year-out
console.log('\nLeave-one-year-out (Spearman, netWar vs ladder):')
for (const heldOut of YEARS) {
  const idxs = []
  for (let i = 0; i < yearArr.length; i += 1) if (yearArr[i] !== heldOut) idxs.push(i)
  const r = spearman(idxs.map((i) => netArr[i]), idxs.map((i) => ladderArr[i]))
  console.log(`  excluding ${heldOut} (n=${idxs.length}): rho=${r.toFixed(4)}`)
}

// Leave-one-club-out
const clubIds = [...new Set(teamArr)]
let sameSignCount = 0
const looRhos = []
for (const club of clubIds) {
  const idxs = []
  for (let i = 0; i < teamArr.length; i += 1) if (teamArr[i] !== club) idxs.push(i)
  const r = spearman(idxs.map((i) => netArr[i]), idxs.map((i) => ladderArr[i]))
  looRhos.push(r)
  if (Math.sign(r) === Math.sign(rhoMain)) sameSignCount += 1
}
console.log(`\nLeave-one-club-out (${clubIds.length} refits): ${sameSignCount}/${clubIds.length} same sign as full-sample rho`)
console.log(`  range: [${Math.min(...looRhos).toFixed(4)}, ${Math.max(...looRhos).toFixed(4)}]`)

// ---------------------------------------------------------------------------
// Broad-band cuts, per house style (thin top rungs -> prefer bands)
// ---------------------------------------------------------------------------
const madeArr = rows.map((r) => (r.madePostseason ? 1 : 0))
const lcsOrBetterArr = rows.map((r) => (r.ladder >= 3 ? 1 : 0))
console.log(`\nSpearman(netWar, madePostseason 0/1), n=${rows.length}: rho=${spearman(netArr, madeArr).toFixed(4)} (n made=${madeArr.reduce((a, b) => a + b, 0)})`)
console.log(`Spearman(netWar, LCS-or-better 0/1), n=${rows.length}: rho=${spearman(netArr, lcsOrBetterArr).toFixed(4)} (n=${lcsOrBetterArr.reduce((a, b) => a + b, 0)})`)

// wonDivision, restricted to postseason clubs only (per house style: its own
// logistic model, and the natural comparison set is playoff teams).
const psIdx = rows.map((r, i) => (r.madePostseason ? i : -1)).filter((i) => i >= 0)
const wonDivArr = psIdx.map((i) => (rows[i].wonDivision ? 1 : 0))
const netPsArr = psIdx.map((i) => netArr[i])
console.log(`\nAmong postseason clubs only (n=${psIdx.length}): Spearman(netWar, wonDivision) rho=${spearman(netPsArr, wonDivArr).toFixed(4)}`)

// ---------------------------------------------------------------------------
// Logistic regression: madePostseason ~ netWar_z + era dummy (era2021=1 for
// the single-wild-card-game year, 0 for 2022-2025's 3-wild-card-per-league
// format). Standardize netWar to z-score for a "per SD" coefficient, the same
// convention the rest of this program uses.
// ---------------------------------------------------------------------------
function zscore(arr) {
  const m = mean(arr)
  const sd = Math.sqrt(mean(arr.map((v) => (v - m) ** 2)))
  return arr.map((v) => (v - m) / sd)
}

const netZ = zscore(netArr)
const eraDummy = rows.map((r) => (r.era === 'wildcard-game' ? 1 : 0))
const X_made = rows.map((_, i) => [1, netZ[i], eraDummy[i]])
const fitMade = logistic(X_made, madeArr, ['intercept', 'netWarAcquired_z', 'era2021'])
console.log('\nLogistic: madePostseason ~ netWarAcquired_z + era2021 (n=150)')
for (const t of fitMade.terms) {
  console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)
}
console.log(`  McFadden pseudo-R2: ${fitMade.mcFadden.toFixed(4)}`)

// wonDivision ~ netWar_z + era, among postseason clubs only
const netZps = zscore(netPsArr)
const eraDummyPs = psIdx.map((i) => eraDummy[i])
const X_div = psIdx.map((_, k) => [1, netZps[k], eraDummyPs[k]])
const fitDiv = logistic(X_div, wonDivArr, ['intercept', 'netWarAcquired_z', 'era2021'])
console.log(`\nLogistic: wonDivision ~ netWarAcquired_z + era2021, postseason clubs only (n=${psIdx.length})`)
for (const t of fitDiv.terms) {
  console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)
}
console.log(`  McFadden pseudo-R2: ${fitDiv.mcFadden.toFixed(4)}`)

// ---------------------------------------------------------------------------
// Ordered logit (proportional odds), attempted honestly. netWar_z + era
// dummy against the 6-rung ladder. J=6 categories -> 5 free cutpoints.
// Cutpoints are reparametrized as theta_1, theta_1+exp(d2), ... to keep them
// increasing; optimized by gradient ascent with a numerical gradient
// (finite differences), which is slower than analytic IRLS but far less
// likely to contain a silent transcription bug in a script nobody else will
// review line by line before this spike ships.
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
  // cuts.length === J - 1
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
  const f0 = f(params)
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
  return { H, f0 }
}

function invertSmall(M) {
  const n = M.length
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let r = col + 1; r < n; r += 1) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r
    if (Math.abs(A[pivot][col]) < 1e-10) return null // singular -> not identified
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
  // init cutpoints spread over observed category frequencies (probit-ish guess)
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

  // Gradient ascent with simple backtracking line search (Armijo).
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
      if (llCand > ll) {
        params = cand
        ll = llCand
        accepted = true
        break
      }
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

console.log('\nOrdered logit (proportional odds): ladder(0-5) ~ netWarAcquired_z + era2021')
const X_ord = rows.map((_, i) => [netZ[i], eraDummy[i]])
const rungCounts = new Array(6).fill(0)
ladderArr.forEach((v) => { rungCounts[v] += 1 })
console.log(`  rung counts: [${rungCounts.join(', ')}]  (rungs 2/4/5 have single digits — flagged below)`)
const ordFit = fitOrderedLogit(X_ord, ladderArr, 6, ['netWarAcquired_z', 'era2021'])
console.log(`  converged log-lik: ${ordFit.ll.toFixed(3)}`)
console.log(`  well-identified (Hessian invertible, positive variances): ${ordFit.wellIdentified}`)
for (const t of ordFit.betaTerms) {
  console.log(`  ${t.name}: beta=${t.beta.toFixed(4)} se=${t.se.toFixed(4)} p=${t.p.toFixed(4)} OR=${t.oddsRatio.toFixed(3)}`)
}

// Sanity-check the ordered-logit optimizer on synthetic data with KNOWN
// coefficients before trusting it on the real, thin sample above.
function syntheticCheck() {
  const rngS = seedRandom(777)
  const n = 2000
  const trueBeta = [0.8, -0.3]
  const trueCuts = [-1.5, -0.3, 0.5, 1.2, 2.2] // 6 categories
  const Xs = []
  const ys = []
  for (let i = 0; i < n; i += 1) {
    const x1 = (rngS() - 0.5) * 4
    const x2 = rngS() < 0.5 ? 1 : 0
    const eta = x1 * trueBeta[0] + x2 * trueBeta[1]
    // sample latent logistic noise
    const u = rngS()
    const latent = eta + Math.log(u / (1 - u))
    let cat = 0
    while (cat < trueCuts.length && latent > trueCuts[cat]) cat += 1
    Xs.push([x1, x2])
    ys.push(cat)
  }
  const fit = fitOrderedLogit(Xs, ys, 6, ['x1', 'x2'])
  return { trueBeta, recovered: fit.betaTerms.map((t) => t.beta) }
}
const check = syntheticCheck()
console.log('\nOptimizer self-check on synthetic n=2000 data with known coefficients:')
console.log(`  true beta:      [${check.trueBeta.map((v) => v.toFixed(3)).join(', ')}]`)
console.log(`  recovered beta: [${check.recovered.map((v) => v.toFixed(3)).join(', ')}]`)

// ---------------------------------------------------------------------------
// Narrative material: biggest deadline winners/losers by net WAR, 2021-2025
// ---------------------------------------------------------------------------
const sorted = [...rows].sort((a, b) => b.net - a.net)
console.log('\nTop 8 net-WAR-acquired team-seasons:')
for (const r of sorted.slice(0, 8)) {
  console.log(`  ${r.year} ${r.teamName}: net=+${r.net.toFixed(1)} (recv ${r.received.toFixed(1)}, sent ${r.sent.toFixed(1)}) ladder=${r.ladder} madePostseason=${r.madePostseason}`)
}
console.log('Bottom 8 (biggest net WAR given away):')
for (const r of sorted.slice(-8).reverse()) {
  console.log(`  ${r.year} ${r.teamName}: net=${r.net.toFixed(1)} (recv ${r.received.toFixed(1)}, sent ${r.sent.toFixed(1)}) ladder=${r.ladder} madePostseason=${r.madePostseason}`)
}

// ---------------------------------------------------------------------------
// The obvious confound: teams don't get assigned buyer/seller status at
// random. A club already ahead in its division in July is far more likely to
// trade FOR win-now WAR (and a club already out of it trades WAR away), so
// "net WAR acquired predicts the ladder" could just be re-detecting "teams
// that were already good in July tend to also finish good." Check this
// directly where a rough proxy is cheap: FINAL winning percentage, from
// .scratch/level-benchmarks/standings-cache.json, which only covers
// 2021-2023 (90 of the 150 team-seasons here) — not deadline-DAY standing,
// and partly circular (final record already reflects the trade's own
// effect), but a useful directional check within this spike's budget.
// ---------------------------------------------------------------------------
let confoundCheck = null
try {
  const standingsCache = JSON.parse(
    readFileSync(join(ROOT, '.scratch/level-benchmarks/standings-cache.json'), 'utf8'),
  )
  const CONFOUND_YEARS = [2021, 2022, 2023]
  const subIdx = []
  const winPct = []
  for (let i = 0; i < rows.length; i += 1) {
    if (!CONFOUND_YEARS.includes(rows[i].year)) continue
    const rec = standingsCache[`${rows[i].teamId}:${rows[i].year}`]
    if (!rec) continue
    subIdx.push(i)
    winPct.push(rec.winPct)
  }
  const subNet = subIdx.map((i) => netArr[i])
  const subLadder = subIdx.map((i) => ladderArr[i])
  const rNetLadder = spearman(subNet, subLadder)
  const rNetWin = spearman(subNet, winPct)
  const rWinLadder = spearman(winPct, subLadder)
  const partial = (rNetLadder - rNetWin * rWinLadder) / Math.sqrt((1 - rNetWin ** 2) * (1 - rWinLadder ** 2))
  confoundCheck = {
    n: subIdx.length,
    years: CONFOUND_YEARS,
    spearmanNetVsLadder: rNetLadder,
    spearmanNetVsFinalWinPct: rNetWin,
    spearmanFinalWinPctVsLadder: rWinLadder,
    partialSpearmanNetVsLadderControllingWinPct: partial,
  }
  console.log(`\nConfound check (${CONFOUND_YEARS.join('/')} only, n=${subIdx.length}, final win% as a rough "already good" proxy):`)
  console.log(`  Spearman(net, ladder) on this subsample: ${rNetLadder.toFixed(4)}`)
  console.log(`  Spearman(net, final win%): ${rNetWin.toFixed(4)}`)
  console.log(`  Spearman(final win%, ladder): ${rWinLadder.toFixed(4)}`)
  console.log(`  Partial Spearman(net, ladder | final win%): ${partial.toFixed(4)}`)

  // Permutation test on the partial correlation itself: shuffle net WAR
  // within year (same scheme as the main test), recompute the partial
  // correlation each time, and see how often a reshuffled deal sheet beats
  // the real one once "already good that year" is held fixed.
  const subYearArr = subIdx.map((i) => yearArr[i])
  function permuteSub(rng2) {
    const shuffled = new Array(subNet.length)
    for (const year of CONFOUND_YEARS) {
      const idxs = []
      for (let i = 0; i < subYearArr.length; i += 1) if (subYearArr[i] === year) idxs.push(i)
      const vals = idxs.map((i) => subNet[i])
      for (let i = vals.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng2() * (i + 1))
        ;[vals[i], vals[j]] = [vals[j], vals[i]]
      }
      idxs.forEach((idx, k) => { shuffled[idx] = vals[k] })
    }
    return shuffled
  }
  const rng2 = seedRandom(31337)
  let countGE2 = 0
  for (let p = 0; p < NPERM; p += 1) {
    const shuffledNet = permuteSub(rng2)
    const rN = spearman(shuffledNet, subLadder)
    const rNW = spearman(shuffledNet, winPct)
    const partialP = (rN - rNW * rWinLadder) / Math.sqrt((1 - rNW ** 2) * (1 - rWinLadder ** 2))
    if (Math.abs(partialP) >= Math.abs(partial)) countGE2 += 1
  }
  const partialPermP = countGE2 / NPERM
  console.log(`  Permutation p-value for that partial correlation (${NPERM} reshuffles within year): ${partialPermP.toFixed(4)}`)
  confoundCheck.partialPermutationP = partialPermP
} catch (err) {
  console.log(`\nConfound check skipped: ${err.message}`)
}

// ---------------------------------------------------------------------------
// Save the panel + findings
// ---------------------------------------------------------------------------
const out = {
  generatedAt: new Date().toISOString(),
  source: ['public/data/trade-deadline/{2021..2025}.json', 'public/data/war-history/*.json', '.scratch/team-success/outcome-ladder.json'],
  n: rows.length,
  panel: rows.map((r) => ({
    year: r.year, teamId: r.teamId, teamName: r.teamName,
    net: r.net, received: r.received, sent: r.sent,
    playersReceived: r.playersReceived, playersSent: r.playersSent,
    receivedMissing: r.receivedMissing, sentMissing: r.sentMissing,
    tradeCount: r.tradeCount,
    ladder: r.ladder, madePostseason: r.madePostseason, wonDivision: r.wonDivision, era: r.era,
  })),
  findings: {
    spearmanNetVsLadder: rhoMain,
    permutationP: permP,
    permutationReps: NPERM,
    leaveOneYearOut: YEARS.map((heldOut) => {
      const idxs = []
      for (let i = 0; i < yearArr.length; i += 1) if (yearArr[i] !== heldOut) idxs.push(i)
      return { heldOut, rho: spearman(idxs.map((i) => netArr[i]), idxs.map((i) => ladderArr[i])) }
    }),
    leaveOneClubOutSameSignCount: sameSignCount,
    leaveOneClubOutTotal: clubIds.length,
    spearmanNetVsMadePostseason: spearman(netArr, madeArr),
    spearmanNetVsLcsOrBetter: spearman(netArr, lcsOrBetterArr),
    spearmanNetVsWonDivisionAmongPostseason: spearman(netPsArr, wonDivArr),
    logisticMadePostseason: fitMade.terms,
    logisticWonDivision: fitDiv.terms,
    orderedLogit: { wellIdentified: ordFit.wellIdentified, terms: ordFit.betaTerms, rungCounts },
    missingWarPlayerCount: missingLog.length,
    confoundCheck,
  },
  missingWarPlayers: missingLog,
}
const outPath = join(__dirname, 'trade-deadline-panel.json')
writeFileSync(outPath, JSON.stringify(out, null, 2))
console.log(`\nWrote ${outPath}`)
