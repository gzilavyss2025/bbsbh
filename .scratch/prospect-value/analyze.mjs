// What a Top Prospects ranking is worth, in dollars.
//
// Reads panel.json and writes findings.json. Every number in
// docs/prospect-ranking-value.md comes from here, so the document can be
// re-derived without the session that wrote it.
//
// Run: node .scratch/prospect-value/analyze.mjs
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const rows = JSON.parse(await readFile(join(here, 'panel.json'), 'utf8'))
const meta = JSON.parse(await readFile(join(here, 'panel-meta.json'), 'utf8'))

// --- statistics -------------------------------------------------------------

const sum = (a) => a.reduce((x, y) => x + y, 0)
const mean = (a) => (a.length ? sum(a) / a.length : null)

function median(a) {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function quantile(a, p) {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const i = (s.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo)
}

function ranksOf(a) {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0])
  const r = new Array(a.length)
  let i = 0
  while (i < idx.length) {
    let jj = i
    while (jj + 1 < idx.length && idx[jj + 1][0] === idx[i][0]) jj++
    const avg = (i + jj) / 2 + 1
    for (let k = i; k <= jj; k++) r[idx[k][1]] = avg
    i = jj + 1
  }
  return r
}

function pearson(x, y) {
  const n = x.length
  if (n < 3) return null
  const mx = mean(x)
  const my = mean(y)
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null
}

const spearman = (x, y) => pearson(ranksOf(x), ranksOf(y))

// Normal tail, Abramowitz-Stegun 7.1.26 on erf.
function normalTwoSided(z) {
  const a = Math.abs(z)
  const t = 1 / (1 + 0.3275911 * (a / Math.SQRT2))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-((a / Math.SQRT2) ** 2))
  return 1 - y
}

// Mann-Whitney U, normal approximation with a tie correction.
function mannWhitney(a, b) {
  const all = [...a, ...b]
  const r = ranksOf(all)
  const ra = sum(r.slice(0, a.length))
  const na = a.length
  const nb = b.length
  if (!na || !nb) return null
  const u = ra - (na * (na + 1)) / 2
  const mu = (na * nb) / 2
  const counts = new Map()
  for (const v of all) counts.set(v, (counts.get(v) ?? 0) + 1)
  let tie = 0
  for (const c of counts.values()) tie += c ** 3 - c
  const n = na + nb
  const sd = Math.sqrt((na * nb / 12) * (n + 1 - tie / (n * (n - 1))))
  if (!sd) return { u, p: 1, z: 0 }
  const z = (u - mu) / sd
  return { u, z, p: normalTwoSided(z) }
}

// Ordinary least squares with an intercept, k regressors.
function ols(X, y) {
  const n = y.length
  const k = X[0].length + 1
  const A = X.map((r) => [1, ...r])
  const xtx = Array.from({ length: k }, () => new Array(k).fill(0))
  const xty = new Array(k).fill(0)
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < k; p++) {
      xty[p] += A[i][p] * y[i]
      for (let q = 0; q < k; q++) xtx[p][q] += A[i][p] * A[i][q]
    }
  }
  // Gauss-Jordan
  const M = xtx.map((r, i) => [...r, ...Array.from({ length: k }, (_, c) => (c === i ? 1 : 0))])
  for (let c = 0; c < k; c++) {
    let piv = c
    for (let r2 = c; r2 < k; r2++) if (Math.abs(M[r2][c]) > Math.abs(M[piv][c])) piv = r2
    if (Math.abs(M[piv][c]) < 1e-12) return null
    ;[M[c], M[piv]] = [M[piv], M[c]]
    const d = M[c][c]
    for (let q = 0; q < 2 * k; q++) M[c][q] /= d
    for (let r2 = 0; r2 < k; r2++) {
      if (r2 === c) continue
      const f = M[r2][c]
      if (!f) continue
      for (let q = 0; q < 2 * k; q++) M[r2][q] -= f * M[c][q]
    }
  }
  const inv = M.map((r) => r.slice(k))
  const beta = new Array(k).fill(0)
  for (let p = 0; p < k; p++) for (let q = 0; q < k; q++) beta[p] += inv[p][q] * xty[q]
  const yhat = A.map((r) => sum(r.map((v, p) => v * beta[p])))
  const my = mean(y)
  const ssr = sum(y.map((v, i) => (v - yhat[i]) ** 2))
  const sst = sum(y.map((v) => (v - my) ** 2))
  const sigma2 = ssr / (n - k)
  const se = beta.map((_, p) => Math.sqrt(sigma2 * inv[p][p]))
  return {
    beta,
    se,
    t: beta.map((b, p) => (se[p] ? b / se[p] : null)),
    p: beta.map((b, p) => (se[p] ? normalTwoSided(b / se[p]) : null)),
    r2: sst ? 1 - ssr / sst : null,
    adjR2: sst ? 1 - (ssr / (n - k)) / (sst / (n - 1)) : null,
    n,
    aic: n * Math.log(ssr / n) + 2 * k,
  }
}

// Deterministic bootstrap: a fixed seed, so the interval is reproducible.
function mulberry(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function bootCI(values, stat, reps = 2000, seed = 20260828) {
  if (values.length < 5) return null
  const rnd = mulberry(seed)
  const out = []
  for (let b = 0; b < reps; b++) {
    const s = new Array(values.length)
    for (let i = 0; i < values.length; i++) s[i] = values[(rnd() * values.length) | 0]
    out.push(stat(s))
  }
  out.sort((a, b) => a - b)
  return [out[Math.floor(0.025 * reps)], out[Math.floor(0.975 * reps)]]
}

const M = (x) => (x == null ? null : Math.round(x))
const fmt$ = (x) => (x == null ? '—' : '$' + Math.round(x).toLocaleString('en-US'))

// --- populations ------------------------------------------------------------

const findings = { generatedAt: new Date().toISOString(), panelMeta: { counts: meta.counts, rankWindow: meta.rankWindow, indexBaseYear: meta.indexBaseYear, lastPaidSeason: meta.lastPaidSeason } }

const ranked = rows.filter((r) => r.inRankFile)
const cohortRows = rows.filter((r) => r.inDebutCohort)

// 1. COHORT ACCOUNTING -------------------------------------------------------

const outsideCohort = { neverDebuted: 0, debut2024plus: 0, debutPre2005: 0, belowRookieThreshold: 0 }
for (const r of ranked) {
  if (r.inDebutCohort) continue
  if (r.debutYear == null) outsideCohort.neverDebuted++
  else if (r.debutYear >= 2024) outsideCohort.debut2024plus++
  else if (r.debutYear < 2005) outsideCohort.debutPre2005++
  else outsideCohort.belowRookieThreshold++
}

const windowGroups = {}
for (const status of ['observed-deep', 'observed-shallow', 'censored', 'no-debut']) {
  const g = cohortRows.filter((r) => r.windowStatus === status)
  windowGroups[status] = { cohortN: g.length, rankedN: g.filter((r) => r.inRankFile).length }
}

findings.cohortAccounting = {
  debutCohortN: cohortRows.length,
  rankedN: ranked.length,
  rankedInDebutCohort: ranked.filter((r) => r.inDebutCohort).length,
  rankedOutsideDebutCohort: outsideCohort,
  windowGroups,
  note:
    'The censored group holds cohort men whose ranking window reaches into 2005-2008, where no list exists. ' +
    'Its rankedN are men who happen to appear on a later list. The remaining men in it are NOT unranked — they are unobserved — ' +
    'and never enter a ranked-versus-unranked comparison.',
}

// 2. WHAT A ZERO MEANS -------------------------------------------------------

// salaries.csv is a salary roster, not a payroll ledger. Test it against a
// population that indisputably drew major-league pay: the debut cohort, every
// man of whom cleared 130 AB or 50 IP.
const missByDebut = {}
for (const r of cohortRows) {
  const k = r.debutYear
  const rec = missByDebut[k] ?? { n: 0, missing: 0 }
  rec.n++
  if (!r.hasSalaryRow) rec.missing++
  missByDebut[k] = rec
}
const missTotal = cohortRows.filter((r) => !r.hasSalaryRow).length

// Is the miss DIFFERENTIAL between ranked and unranked? If it is, treating a
// missing man as a zero would bias the comparison rather than merely blunt it.
const deepCohort = cohortRows.filter((r) => r.windowStatus === 'observed-deep')
const missRanked = deepCohort.filter((r) => r.inRankFile)
const missUnranked = deepCohort.filter((r) => !r.inRankFile)
findings.zeroMeaning = {
  claim: 'A zero in salaries.csv conflates "never paid" with "not in this file". The file is a salary roster of about 870-970 men a season; a short-service man can miss it entirely.',
  cohortMissingAnySalaryRow: missTotal,
  cohortN: cohortRows.length,
  cohortMissRate: missTotal / cohortRows.length,
  byDebutYear: Object.fromEntries(
    Object.entries(missByDebut)
      .sort((a, b) => a[0] - b[0])
      .map(([y, v]) => [y, { n: v.n, missing: v.missing, rate: v.missing / v.n }]),
  ),
  differential: {
    rankedN: missRanked.length,
    rankedMissRate: missRanked.filter((r) => !r.hasSalaryRow).length / missRanked.length,
    unrankedN: missUnranked.length,
    unrankedMissRate: missUnranked.filter((r) => !r.hasSalaryRow).length / missUnranked.length,
  },
  consequence:
    'Every "never earned" figure below is therefore reported twice: once from the authoritative fact (statsapi says he never debuted) and once from the file (no salary row). The second is an upper bound on the first, not a measurement of it.',
}

// 3. HOW MANY RANKED PROSPECTS NEVER EARN ------------------------------------

// Cohort defined AT RANKING TIME and censored on the RANKING season, not on a
// debut — a man who never debuted has no debut year to censor on, and dropping
// him is the survivorship trap this spike exists to avoid.
const NEVER_EARN_LAST_RANK_SEASON = 2018 // seven full seasons of chances, through 2025
const neverPool = ranked.filter((r) => r.firstRankSeason <= NEVER_EARN_LAST_RANK_SEASON)

function neverEarnStats(pool) {
  const n = pool.length
  const neverDebuted = pool.filter((r) => r.debutYear == null).length
  const noSalaryRow = pool.filter((r) => !r.hasSalaryRow).length
  const debutedNoSalary = pool.filter((r) => r.debutYear != null && !r.hasSalaryRow).length
  return {
    n,
    neverDebuted,
    neverDebutedRate: n ? neverDebuted / n : null,
    noSalaryRow,
    noSalaryRowRate: n ? noSalaryRow / n : null,
    debutedButNoSalaryRow: debutedNoSalary,
    medianIndexed: median(pool.map((r) => r.careerIndexed)),
  }
}

const BANDS = [
  ['1-10', 1, 10],
  ['11-25', 11, 25],
  ['26-50', 26, 50],
  ['51-75', 51, 75],
  ['76-100', 76, 100],
]

findings.neverEarn = {
  censorRule: `first ranked in ${meta.rankWindow.first}-${NEVER_EARN_LAST_RANK_SEASON}, so every man has had at least seven seasons through ${meta.lastPaidSeason} to draw a major-league salary`,
  overall: neverEarnStats(neverPool),
  byPeakRankBand: Object.fromEntries(
    BANDS.map(([label, lo, hi]) => [label, neverEarnStats(neverPool.filter((r) => r.peakRank >= lo && r.peakRank <= hi))]),
  ),
  byGroup: {
    hitting: neverEarnStats(neverPool.filter((r) => r.group === 'hitting')),
    pitching: neverEarnStats(neverPool.filter((r) => r.group === 'pitching')),
  },
  depth100Only: neverEarnStats(neverPool.filter((r) => r.firstRankDepth >= 99)),
}

// 4. THE EARNINGS CURVE AGAINST PEAK RANK ------------------------------------

// Horizon runs from the FIRST RANKING SEASON, not the debut. A man who never
// debuted is in this population with a genuine zero; censoring on a debut would
// drop exactly the men the survivorship trap is about.
const CURVE_HORIZON = 10
const CURVE_LAST_FIRST_RANK = meta.lastPaidSeason - CURVE_HORIZON + 1 // 2016

const IDX = meta.indexFactor

// A STRICTLY TRUNCATED window. Every man is measured over the same number of
// seasons — the ten beginning with the one he was first ranked in — so a 2009
// name is never compared against a 2016 name's shorter career. This is the
// window-honesty rule, and it is why the panel keeps per-season dollars: no
// debut-anchored horizon can cut a window that starts at a ranking.
//
// `prorate2020` exists because salaries.csv records the CONTRACTED 2020 salary,
// not the roughly 37% of it a 60-game season actually paid. The file's 2020
// total is $3,987,209,077 against $3,887,858,407 in 2019 — the same scale, so
// the cell is plainly a contract figure. It distorts every man in that season
// identically, so it cannot bend the rank curve, but it does overstate a career
// total. The robustness block re-runs everything with 2020 cut to 60/162.
const GAMES_2020 = 60 / 162

function windowEarnings(row, from, years, { indexed = true, prorate2020 = false } = {}) {
  let total = 0
  for (let y = from; y <= from + years - 1; y++) {
    let d = row.seasonEarnings?.find((e) => e.season === y)?.dollars ?? 0
    if (!d) continue
    if (prorate2020 && y === 2020) d *= GAMES_2020
    total += indexed ? d * (IDX[y] ?? 1) : d
  }
  return total
}

const curvePool = ranked
  .filter((r) => r.firstRankSeason <= CURVE_LAST_FIRST_RANK)
  .map((r) => ({
    ...r,
    e: windowEarnings(r, r.firstRankSeason, CURVE_HORIZON),
    eNominal: windowEarnings(r, r.firstRankSeason, CURVE_HORIZON, { indexed: false }),
    e2020: windowEarnings(r, r.firstRankSeason, CURVE_HORIZON, { prorate2020: true }),
  }))

// What the truncation costs, stated rather than assumed: dollars that fall
// outside the ten-season window, and men who were paid before it opened.
const earlyPay = curvePool.filter((r) => r.firstPaidSeason != null && r.firstPaidSeason < r.firstRankSeason).length
const lateTail = curvePool.filter((r) => r.lastPaidSeason != null && r.lastPaidSeason > r.firstRankSeason + CURVE_HORIZON - 1)
const truncatedDollars = sum(curvePool.map((r) => r.careerIndexed - r.e))

function curveTable(pool) {
  return BANDS.map(([label, lo, hi]) => {
    const g = pool.filter((r) => r.peakRank >= lo && r.peakRank <= hi)
    const vals = g.map((r) => r.e)
    return {
      band: label,
      n: g.length,
      zeroes: g.filter((r) => r.e === 0).length,
      median: M(median(vals)),
      medianCI: bootCI(vals, median)?.map(M) ?? null,
      mean: M(mean(vals)),
      p25: M(quantile(vals, 0.25)),
      p75: M(quantile(vals, 0.75)),
      p90: M(quantile(vals, 0.9)),
    }
  })
}

const cx = curvePool.map((r) => r.peakRank)
const cy = curvePool.map((r) => Math.log10(1 + r.e))
const linear = ols(curvePool.map((r) => [r.peakRank]), cy)
const logmodel = ols(curvePool.map((r) => [Math.log(r.peakRank)]), cy)
const both = ols(curvePool.map((r) => [r.peakRank, Math.log(r.peakRank)]), cy)

// What ONE POSITION DOWN the list costs, read off the log model at three places
// on the curve. The model regresses log10(1 + earnings) on ln(rank), so
// d(log10 E)/d(rank) = beta / rank and the multiplier is 10 raised to it. A
// multiplier below 1 is a loss, which is why the field is named for a cost.
function marginalAt(rank, model, medianAt) {
  if (!model) return null
  const multiplier = 10 ** (model.beta[1] / rank)
  return {
    rank,
    oneStepDownMultiplier: multiplier,
    percentLostPerPosition: 100 * (1 - multiplier),
    dollarsLostAtBandMedian: medianAt == null ? null : Math.round(medianAt * (1 - multiplier)),
  }
}

const bandMedian = Object.fromEntries(curveTable(curvePool).map((b) => [b.band, b.median]))

// THE HURDLE. A single log model on log10(1 + E) mixes two different questions
// — whether a man earns anything at all, and how much he earns once he does —
// and the robustness run that drops the zeroes shows the mixing matters. Split
// them, because the answer is different on each side.
const earnedAny = curvePool.map((r) => (r.e > 0 ? 1 : 0))
const hurdleStage1 = ols(curvePool.map((r) => [Math.log(r.peakRank)]), earnedAny)
const positives = curvePool.filter((r) => r.e > 0)
const hurdleStage2 = ols(positives.map((r) => [Math.log(r.peakRank)]), positives.map((r) => Math.log10(r.e)))

// Concentration: how much of the money the top of the list takes.
const totalDollars = sum(curvePool.map((r) => r.e))
function shareOf(pred) {
  const g = curvePool.filter(pred)
  return { n: g.length, dollars: M(sum(g.map((r) => r.e))), shareOfPool: totalDollars ? sum(g.map((r) => r.e)) / totalDollars : null }
}

findings.rankCurve = {
  design: `population = every man first ranked ${meta.rankWindow.first}-${CURVE_LAST_FIRST_RANK}; earnings measured over the ${CURVE_HORIZON} seasons from his first ranking, strictly truncated so every man gets the same number of seasons; dollars indexed to ${meta.indexBaseYear} league-average salary`,
  n: curvePool.length,
  zeroes: curvePool.filter((r) => r.e === 0).length,
  windowSanity: {
    paidBeforeTheWindowOpened: earlyPay,
    stillPaidAfterWindowClosed: lateTail.length,
    dollarsFallingOutsideTheWindow: M(truncatedDollars),
    shareOfCareerDollarsTruncated: sum(curvePool.map((r) => r.careerIndexed)) ? truncatedDollars / sum(curvePool.map((r) => r.careerIndexed)) : null,
    note:
      'A man still being paid in season eleven keeps earning, and those dollars are deliberately outside the window. Truncating is what makes a 2009 name comparable with a 2016 one; the untruncated "career so far" figure is in the robustness block so the difference is visible.',
  },
  byBand: curveTable(curvePool),
  spearmanRankVsEarnings: spearman(cx, curvePool.map((r) => r.e)),
  models: {
    linearInRank: linear && { beta: linear.beta, p: linear.p, r2: linear.r2, aic: linear.aic },
    linearInLogRank: logmodel && { beta: logmodel.beta, p: logmodel.p, r2: logmodel.r2, aic: logmodel.aic },
    both: both && { beta: both.beta, p: both.p, r2: both.r2, aic: both.aic },
    verdict: linear && logmodel ? (logmodel.aic < linear.aic ? 'log-in-rank fits better' : 'linear-in-rank fits better') : null,
    interpretation:
      'r2 is the number to read out loud. Peak rank explains a single-digit share of the variance in what a man earns; it moves the average a lot and predicts the individual barely at all.',
  },
  hurdle: {
    stage1EarnedAnything: hurdleStage1 && { beta: hurdleStage1.beta, p: hurdleStage1.p, r2: hurdleStage1.r2, n: hurdleStage1.n },
    stage2AmountGivenAny: hurdleStage2 && { beta: hurdleStage2.beta, p: hurdleStage2.p, r2: hurdleStage2.r2, n: hurdleStage2.n },
    reading:
      'Stage 1 is a linear probability fit of "drew any major-league salary" on ln(rank); stage 2 is log10(dollars) on ln(rank) among men who drew one.',
  },
  concentration: {
    totalIndexedDollars: M(totalDollars),
    top10: shareOf((r) => r.peakRank <= 10),
    top25: shareOf((r) => r.peakRank <= 25),
    bottomHalf: shareOf((r) => r.peakRank > 50),
  },
  marginalRankPosition: {
    at5: marginalAt(5, logmodel, bandMedian['1-10']),
    at30: marginalAt(30, logmodel, bandMedian['26-50']),
    at95: marginalAt(95, logmodel, bandMedian['76-100']),
  },
}

// THE OUTCOME LADDER, built WITHOUT salaries.csv. Career outcome read from
// statsapi's debut record and the app's own rookie threshold, neither of which
// has the salary file's roster gap. This is the honest version of "how many
// ranked prospects amount to nothing".
function ladder(pool) {
  const n = pool.length
  const never = pool.filter((r) => r.debutYear == null).length
  const cup = pool.filter((r) => r.debutYear != null && !r.inDebutCohort).length
  const real = pool.filter((r) => r.inDebutCohort).length
  return {
    n,
    neverDebuted: never,
    debutedBelowRookieThreshold: cup,
    clearedRookieThreshold: real,
    clearedRate: n ? real / n : null,
  }
}
findings.outcomeLadder = {
  design:
    'salaries.csv plays no part here. "Never debuted" is statsapi\'s own mlbDebutDate; "cleared the rookie threshold" is membership of the 3,061-man debut cohort (130 AB or 50 IP, career). Restricted to men first ranked 2009-2016, so the youngest has had nine full seasons.',
  overall: ladder(curvePool),
  byBand: Object.fromEntries(BANDS.map(([label, lo, hi]) => [label, ladder(curvePool.filter((r) => r.peakRank >= lo && r.peakRank <= hi))])),
  byGroup: { hitting: ladder(curvePool.filter((r) => r.group === 'hitting')), pitching: ladder(curvePool.filter((r) => r.group === 'pitching')) },
}

// 5. FIRST-APPEARANCE RANK VERSUS PEAK RANK ----------------------------------

const firstVsPeak = {
  spearmanFirstRank: spearman(curvePool.map((r) => r.firstRank), curvePool.map((r) => r.e)),
  spearmanPeakRank: spearman(curvePool.map((r) => r.peakRank), curvePool.map((r) => r.e)),
  spearmanNSeasons: spearman(curvePool.map((r) => r.nRankSeasons), curvePool.map((r) => r.e)),
  modelPeakOnly: ols(curvePool.map((r) => [Math.log(r.peakRank)]), cy),
  modelFirstOnly: ols(curvePool.map((r) => [Math.log(r.firstRank)]), cy),
  modelBoth: ols(curvePool.map((r) => [Math.log(r.peakRank), Math.log(r.firstRank)]), cy),
  modelPeakPlusSeasons: ols(curvePool.map((r) => [Math.log(r.peakRank), r.nRankSeasons]), cy),
}
for (const k of ['modelPeakOnly', 'modelFirstOnly', 'modelBoth', 'modelPeakPlusSeasons']) {
  const m = firstVsPeak[k]
  if (m) firstVsPeak[k] = { beta: m.beta, p: m.p, r2: m.r2, aic: m.aic, n: m.n }
}
findings.firstVsPeak = firstVsPeak

// 6. HITTERS AND PITCHERS ----------------------------------------------------

function groupCurve(g) {
  const pool = curvePool.filter((r) => r.group === g)
  const y = pool.map((r) => Math.log10(1 + r.e))
  const m = ols(pool.map((r) => [Math.log(r.peakRank)]), y)
  return {
    n: pool.length,
    zeroes: pool.filter((r) => r.e === 0).length,
    median: M(median(pool.map((r) => r.e))),
    medianCI: bootCI(pool.map((r) => r.e), median)?.map(M) ?? null,
    mean: M(mean(pool.map((r) => r.e))),
    p90: M(quantile(pool.map((r) => r.e), 0.9)),
    slopeLogRank: m ? m.beta[1] : null,
    slopeP: m ? m.p[1] : null,
    r2: m ? m.r2 : null,
    byBand: curveTable(pool),
  }
}
const hit = groupCurve('hitting')
const pit = groupCurve('pitching')
findings.byGroup = {
  hitting: hit,
  pitching: pit,
  medianGap: hit.median != null && pit.median != null ? hit.median - pit.median : null,
  mannWhitney: mannWhitney(
    curvePool.filter((r) => r.group === 'hitting').map((r) => r.e),
    curvePool.filter((r) => r.group === 'pitching').map((r) => r.e),
  ),
  // Same test inside the top band only, where the two groups are most comparable.
  topBandOnly: mannWhitney(
    curvePool.filter((r) => r.group === 'hitting' && r.peakRank <= 25).map((r) => r.e),
    curvePool.filter((r) => r.group === 'pitching' && r.peakRank <= 25).map((r) => r.e),
  ),
}

// 7. RANKED VERSUS UNRANKED, ON THE OBSERVED-DEEP COHORT ONLY ----------------

// This is the comparison the censoring split exists to protect. It runs only on
// men whose whole ranking window sat inside a published top-100 list, and it
// runs on the DEBUT cohort, which is already selected on reaching the majors —
// so it answers "among men who made it, what did a ranking add", not
// "what is a ranking worth".
function rankedVsUnranked(pool, field) {
  const a = pool.filter((r) => r.inRankFile).map((r) => r[field].indexed)
  const b = pool.filter((r) => !r.inRankFile).map((r) => r[field].indexed)
  return {
    rankedN: a.length,
    unrankedN: b.length,
    rankedMedian: M(median(a)),
    rankedMedianCI: bootCI(a, median)?.map(M) ?? null,
    unrankedMedian: M(median(b)),
    unrankedMedianCI: bootCI(b, median)?.map(M) ?? null,
    ratioOfMedians: median(b) ? median(a) / median(b) : null,
    rankedMean: M(mean(a)),
    unrankedMean: M(mean(b)),
    ratioOfMeans: mean(b) ? mean(a) / mean(b) : null,
    mannWhitney: mannWhitney(a, b),
  }
}

const h6Pool = deepCohort.filter((r) => r.debutYear <= meta.lastPaidSeason - 5 && r.h6.complete)
findings.rankedVsUnranked = {
  design:
    'debut cohort only (already selected on reaching the majors); observed-deep window only; six seasons of earnings from the debut season, indexed to ' +
    `${meta.indexBaseYear}`,
  h6: rankedVsUnranked(h6Pool, 'h6'),
  h6ByGroup: {
    hitting: rankedVsUnranked(h6Pool.filter((r) => r.group === 'hitting'), 'h6'),
    pitching: rankedVsUnranked(h6Pool.filter((r) => r.group === 'pitching'), 'h6'),
  },
  h3: rankedVsUnranked(deepCohort.filter((r) => r.h3.complete), 'h3'),
  // THE MISSINGNESS SENSITIVITY. Men with no salary row at all miss at 4.8%
  // among ranked men and 12.8% among unranked ones. Some of that gap is real —
  // an unranked man is more marginal, so he is likelier to be a short-service
  // man the salary roster never lists — but the rest of it is a file gap, and a
  // file gap coded as a zero pushes the unranked median down and inflates the
  // ratio. Re-run with every man who has no salary row dropped from both sides.
  // The true answer sits between the two runs.
  h6ExcludingMenWithNoSalaryRow: rankedVsUnranked(h6Pool.filter((r) => r.hasSalaryRow), 'h6'),
  // The comparison the trap would have produced: pooling the censored group in
  // as though its men were unranked. Reported so the size of the error is on
  // the record rather than asserted.
  trapIfCensoredPooledAsUnranked: (() => {
    const trapPool = cohortRows.filter((r) => r.debutYear != null && r.debutYear <= meta.lastPaidSeason - 5 && r.h6.complete)
    return rankedVsUnranked(trapPool, 'h6')
  })(),
}

// 8. AGE RELATIVE TO LEVEL, AND THE OTHER DEVELOPMENT MEASURES ---------------

const devPool = h6Pool.filter((r) => r.ageRelToLevel != null && r.seasonsToDebut != null)
const devY = devPool.map((r) => Math.log10(1 + r.h6.indexed))
findings.developmentMeasures = {
  n: devPool.length,
  spearmanAgeRelToLevel: spearman(devPool.map((r) => r.ageRelToLevel), devPool.map((r) => r.h6.indexed)),
  spearmanSeasonsToDebut: spearman(devPool.map((r) => r.seasonsToDebut), devPool.map((r) => r.h6.indexed)),
  spearmanAgeAtDebut: spearman(devPool.map((r) => r.ageAtDebut), devPool.map((r) => r.h6.indexed)),
  model: (() => {
    const m = ols(devPool.map((r) => [r.ageRelToLevel, r.seasonsToDebut, r.inRankFile ? 1 : 0]), devY)
    return m ? { terms: ['intercept', 'ageRelToLevel', 'seasonsToDebut', 'wasRanked'], beta: m.beta, p: m.p, r2: m.r2, n: m.n } : null
  })(),
  // Does a ranking still pay once age relative to level is held constant?
  incrementalR2OfRanking: (() => {
    const withRank = ols(devPool.map((r) => [r.ageRelToLevel, r.seasonsToDebut, r.inRankFile ? 1 : 0]), devY)
    const without = ols(devPool.map((r) => [r.ageRelToLevel, r.seasonsToDebut]), devY)
    return withRank && without ? withRank.r2 - without.r2 : null
  })(),
  levelTrendPercentile: {
    available: false,
    reason:
      'public/data/prospect-trend.json is a snapshot of the CURRENT season (dataThrough 2026-08-28) holding 732 active minor leaguers. ' +
      'Its overlap with the 3,061-man debut cohort is exactly 0 players, and with the 757 ranked men exactly 23 — all of them men still in the minors today. ' +
      'The measure named in the spike brief cannot be computed for any historical cohort and is dropped, not approximated.',
  },
}

// 9. ROBUSTNESS --------------------------------------------------------------

// Leave one first-ranking season out and refit the curve.
const loso = []
for (const s of [...new Set(curvePool.map((r) => r.firstRankSeason))].sort()) {
  const pool = curvePool.filter((r) => r.firstRankSeason !== s)
  const m = ols(pool.map((r) => [Math.log(r.peakRank)]), pool.map((r) => Math.log10(1 + r.e)))
  loso.push({ dropped: s, n: pool.length, slope: m?.beta[1] ?? null, p: m?.p[1] ?? null, spearman: spearman(pool.map((r) => r.peakRank), pool.map((r) => r.e)) })
}
const full = ols(curvePool.map((r) => [Math.log(r.peakRank)]), cy)

// Leave one debut year out of the ranked-versus-unranked comparison.
const losoRvU = []
for (const y of [...new Set(h6Pool.map((r) => r.debutYear))].sort()) {
  const pool = h6Pool.filter((r) => r.debutYear !== y)
  const res = rankedVsUnranked(pool, 'h6')
  losoRvU.push({ dropped: y, rankedN: res.rankedN, unrankedN: res.unrankedN, ratioOfMedians: res.ratioOfMedians, p: res.mannWhitney?.p ?? null })
}

function refit(pool, label) {
  if (pool.length < 20) return { label, n: pool.length, slope: null, p: null, note: 'too thin to fit' }
  const m = ols(pool.map((r) => [Math.log(r.peakRank)]), pool.map((r) => Math.log10(1 + r.e)))
  return { label, n: pool.length, slope: m?.beta[1] ?? null, p: m?.p[1] ?? null, r2: m?.r2 ?? null, median: M(median(pool.map((r) => r.e))) }
}

findings.robustness = {
  fullSlope: full ? { slope: full.beta[1], p: full.p[1], r2: full.r2, n: full.n } : null,
  leaveOneRankSeasonOut: {
    seasons: loso,
    survivedIn: loso.filter((r) => r.p != null && r.p < 0.05 && r.slope < 0).length,
    outOf: loso.length,
    slopeRange: [Math.min(...loso.map((r) => r.slope)), Math.max(...loso.map((r) => r.slope))],
  },
  leaveOneDebutYearOut: {
    years: losoRvU,
    survivedIn: losoRvU.filter((r) => r.p != null && r.p < 0.05 && r.ratioOfMedians > 1).length,
    outOf: losoRvU.length,
  },
  variants: [
    refit(curvePool, 'headline (all first-ranked 2009-2016, indexed dollars)'),
    refit(curvePool.filter((r) => r.firstRankDepth >= 99), 'depth-100 first-ranking seasons only (drops 2009-2011 top-50 lists)'),
    refit(curvePool.filter((r) => r.firstRankDepth < 99), 'top-50 first-ranking seasons only (2009-2011)'),
    refit(curvePool.filter((r) => !r.identityCollision), 'identity-collision ids removed'),
    refit(curvePool.filter((r) => r.e > 0), 'men who earned nothing EXCLUDED rather than carried as zeroes (the survivorship version)'),
    refit(curvePool.map((r) => ({ ...r, e: r.eNominal })), 'nominal dollars instead of indexed'),
    refit(curvePool.map((r) => ({ ...r, e: r.e2020 })), '2020 salaries prorated to 60/162 of the contracted figure'),
    refit(curvePool.map((r) => ({ ...r, e: r.careerIndexed })), 'untruncated career-so-far dollars instead of a fixed ten-season window'),
    refit(curvePool.filter((r) => r.debutYear != null), 'men who never reached the majors dropped'),
    refit(curvePool.filter((r) => r.group === 'hitting'), 'hitters only'),
    refit(curvePool.filter((r) => r.group === 'pitching'), 'pitchers only'),
  ],
  identityCollisions: {
    idsInPanel: rows.filter((r) => r.identityCollision).length,
    idsInCurvePool: curvePool.filter((r) => r.identityCollision).length,
    dollarsInCurvePool: M(sum(curvePool.filter((r) => r.identityCollision).map((r) => r.e))),
    note:
      'Twelve of the 21 are real homonym pairs that must not be merged and nine are wrong fuzzy matches in the contract crosswalk. ' +
      'They are flagged, not repaired: repairing them belongs in the admin workbench.',
  },
  horizonSensitivity: [3, 6, 9].map((h) => {
    const pool = deepCohort.filter((r) => r[`h${h}`].complete && r.debutYear <= meta.lastPaidSeason - h + 1)
    const a = pool.filter((r) => r.inRankFile).map((r) => r[`h${h}`].indexed)
    const b = pool.filter((r) => !r.inRankFile).map((r) => r[`h${h}`].indexed)
    return {
      horizonSeasons: h,
      rankedN: a.length,
      unrankedN: b.length,
      rankedMedian: M(median(a)),
      unrankedMedian: M(median(b)),
      ratio: median(b) ? median(a) / median(b) : null,
      p: mannWhitney(a, b)?.p ?? null,
    }
  }),
}

// 10. THE PLAIN-LANGUAGE HEADLINES -------------------------------------------

const top10 = curvePool.filter((r) => r.peakRank <= 10)
const bot = curvePool.filter((r) => r.peakRank >= 76)
findings.headlines = {
  neverEarned: `${findings.neverEarn.overall.neverDebuted} of ${findings.neverEarn.overall.n} men first ranked 2009-2018 never reached the majors at all (${(100 * findings.neverEarn.overall.neverDebutedRate).toFixed(1)}%); ${findings.neverEarn.overall.noSalaryRow} (${(100 * findings.neverEarn.overall.noSalaryRowRate).toFixed(1)}%) never appear in salaries.csv, which is the upper bound rather than the measurement.`,
  topTenVersusBottom: `median indexed earnings ${fmt$(median(top10.map((r) => r.e)))} for a peak rank of 1-10 (n=${top10.length}) against ${fmt$(median(bot.map((r) => r.e)))} for 76-100 (n=${bot.length})`,
  curveShape: findings.rankCurve.models.verdict,
}

await writeFile(join(here, 'findings.json'), JSON.stringify(findings, null, 1))

// --- console summary --------------------------------------------------------
console.log('=== COHORT ACCOUNTING ===')
console.log(JSON.stringify(findings.cohortAccounting, null, 1))
console.log('\n=== WHAT A ZERO MEANS ===')
console.log('cohort miss rate', (100 * findings.zeroMeaning.cohortMissRate).toFixed(1) + '%', JSON.stringify(findings.zeroMeaning.differential))
console.log('\n=== NEVER EARN ===')
console.log(JSON.stringify(findings.neverEarn, null, 1))
console.log('\n=== RANK CURVE ===')
console.log('n', findings.rankCurve.n, 'zeroes', findings.rankCurve.zeroes, 'spearman', findings.rankCurve.spearmanRankVsEarnings?.toFixed(4))
console.table(findings.rankCurve.byBand)
console.log('models', JSON.stringify(findings.rankCurve.models, null, 1))
console.log('hurdle', JSON.stringify(findings.rankCurve.hurdle, null, 1))
console.log('concentration', JSON.stringify(findings.rankCurve.concentration, null, 1))
console.log('windowSanity', JSON.stringify(findings.rankCurve.windowSanity, null, 1))
console.log('marginal', JSON.stringify(findings.rankCurve.marginalRankPosition, null, 1))
console.log('\n=== OUTCOME LADDER (no salaries.csv) ===')
console.log(JSON.stringify(findings.outcomeLadder, null, 1))
console.log('\n=== FIRST VS PEAK ===')
console.log(JSON.stringify(findings.firstVsPeak, null, 1))
console.log('\n=== BY GROUP ===')
console.log(JSON.stringify({ hitting: { ...findings.byGroup.hitting, byBand: undefined }, pitching: { ...findings.byGroup.pitching, byBand: undefined }, mw: findings.byGroup.mannWhitney, topBand: findings.byGroup.topBandOnly }, null, 1))
console.log('\n=== RANKED VS UNRANKED ===')
console.log(JSON.stringify(findings.rankedVsUnranked, null, 1))
console.log('\n=== DEVELOPMENT MEASURES ===')
console.log(JSON.stringify(findings.developmentMeasures, null, 1))
console.log('\n=== ROBUSTNESS ===')
console.log('full slope', JSON.stringify(findings.robustness.fullSlope))
console.log('LOSO rank season: survived', findings.robustness.leaveOneRankSeasonOut.survivedIn, 'of', findings.robustness.leaveOneRankSeasonOut.outOf, 'range', findings.robustness.leaveOneRankSeasonOut.slopeRange)
console.log('LOSO debut year: survived', findings.robustness.leaveOneDebutYearOut.survivedIn, 'of', findings.robustness.leaveOneDebutYearOut.outOf)
console.table(findings.robustness.variants)
console.table(findings.robustness.horizonSensitivity)
console.log('\n=== HEADLINES ===')
console.log(JSON.stringify(findings.headlines, null, 1))
