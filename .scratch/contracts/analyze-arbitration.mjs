// W3.1 spike analysis — reads arbitration-warp-panel.json (built by
// build-arbitration-warp.mjs, beside this file) and answers the three parts
// of the spike:
//   1. What predicts the settled figure?
//   2. On the small file-and-trial subset, where does the settlement land?
//   3. Does BP WARP agree with MLB's own WAR?
//
// n = 2,420 arbitration.csv rows, 2018-2026 — NINE seasons. Every headline
// below states its own n; several are far smaller than 2,420 once a blank
// cell or a missing crosswalk id is excluded, and the exclusion is never
// silent. Run: node .scratch/contracts/analyze-arbitration.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const panel = JSON.parse(readFileSync(join(__dirname, 'arbitration-warp-panel.json'), 'utf8')).rows

const SEASONS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

// ------------------------------------------------------------------ stats lib
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const sd = (xs) => {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}
function rank(xs) {
  const idx = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b])
  const ranks = new Array(xs.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++
    const avgRank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[idx[k]] = avgRank
    i = j + 1
  }
  return ranks
}
function pearson(xs, ys) {
  const mx = mean(xs)
  const my = mean(ys)
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0))
  return den === 0 ? 0 : num / den
}
const spearman = (xs, ys) => pearson(rank(xs), rank(ys))

// Standard normal CDF (Abramowitz & Stegun 7.1.26), good to ~1e-7 — used for
// a two-tailed p-value off a t-stat. n here is never small enough (>150 in
// every regression run) for the normal/t difference to matter.
function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  if (z > 0) p = 1 - p
  return p
}
const twoTailedP = (z) => 2 * (1 - normalCdf(Math.abs(z)))

// Gauss-Jordan solve of A x = b (A square). Used only on small (<=6x6)
// design matrices here.
function solve(A, b) {
  const n = A.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let piv = col
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    ;[M[col], M[piv]] = [M[piv], M[col]]
    const pv = M[col][col]
    if (Math.abs(pv) < 1e-12) throw new Error('singular matrix in OLS solve — check for collinear predictors')
    for (let c = col; c <= n; c++) M[col][c] /= pv
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = M[r][col]
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c]
    }
  }
  return M.map((row) => row[n])
}
function invert(A) {
  const n = A.length
  const cols = []
  for (let j = 0; j < n; j++) {
    const e = new Array(n).fill(0)
    e[j] = 1
    cols.push(solve(A, e))
  }
  // cols[j] is column j of the inverse
  return Array.from({ length: n }, (_, i) => cols.map((c) => c[i]))
}

// OLS with an intercept. `X` is an array of rows, each an array of predictor
// values (no intercept column — added here). Returns coefficients (index 0
// is the intercept), standard errors, t-stats, two-tailed p-values, R^2 and n.
function olsFit(X, y, names) {
  const n = X.length
  const k = X[0].length + 1
  const design = X.map((row) => [1, ...row])
  // X'X and X'y
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0))
  const Xty = new Array(k).fill(0)
  for (let r = 0; r < n; r++) {
    for (let i = 0; i < k; i++) {
      Xty[i] += design[r][i] * y[r]
      for (let j = 0; j < k; j++) XtX[i][j] += design[r][i] * design[r][j]
    }
  }
  const beta = solve(XtX, Xty)
  const fitted = design.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0))
  const resid = y.map((v, i) => v - fitted[i])
  const ssr = resid.reduce((s, e) => s + e * e, 0)
  const yMean = mean(y)
  const sst = y.reduce((s, v) => s + (v - yMean) ** 2, 0)
  const r2 = 1 - ssr / sst
  const dof = n - k
  const sigma2 = ssr / dof
  const XtXinv = invert(XtX)
  const se = XtXinv.map((row, i) => Math.sqrt(sigma2 * row[i]))
  const t = beta.map((b, i) => b / se[i])
  const p = t.map((tv) => twoTailedP(tv))
  const labels = ['intercept', ...names]
  return {
    n,
    k,
    r2,
    coefficients: labels.map((label, i) => ({ label, beta: beta[i], se: se[i], t: t[i], p: p[i] })),
  }
}

// Variance inflation factor for each named predictor: regress it on every
// OTHER predictor in the same matrix, VIF = 1/(1-R^2) of that regression.
function vif(X, names) {
  const out = {}
  for (let j = 0; j < names.length; j++) {
    const y = X.map((row) => row[j])
    const others = X.map((row) => row.filter((_, i) => i !== j))
    if (others[0].length === 0) {
      out[names[j]] = 1
      continue
    }
    const fit = olsFit(others, y, names.filter((_, i) => i !== j))
    out[names[j]] = 1 / (1 - fit.r2)
  }
  return out
}

// ------------------------------------------------------------ PART ONE: pay
const settledNumeric = panel.filter((r) => r.settled.amount != null)
const full = settledNumeric.filter((r) => r.priorSalary.amount != null && r.priorWarp != null && r.careerWarp != null)

function buildDesign(rows, logDollar) {
  const X = rows.map((r) => [
    r.mls,
    logDollar ? Math.log(r.priorSalary.amount + 1) : r.priorSalary.amount / 1e6,
    r.priorWarp,
    r.careerWarp,
  ])
  const y = rows.map((r) => (logDollar ? Math.log(r.settled.amount) : r.settled.amount / 1e6))
  return { X, y }
}
const PREDICTOR_NAMES = ['mls', 'log_priorSalary', 'priorWarp', 'careerWarp']
const PREDICTOR_NAMES_LEVEL = ['mls', 'priorSalary_M', 'priorWarp', 'careerWarp']

const logDesign = buildDesign(full, true)
const levelDesign = buildDesign(full, false)
const logFit = olsFit(logDesign.X, logDesign.y, PREDICTOR_NAMES)
const levelFit = olsFit(levelDesign.X, levelDesign.y, PREDICTOR_NAMES_LEVEL)
const logVif = vif(logDesign.X, PREDICTOR_NAMES)

const mlsVsPriorSalaryR = pearson(
  full.map((r) => r.mls),
  full.map((r) => r.priorSalary.amount),
)
const mlsVsLogPriorSalaryR = pearson(
  full.map((r) => r.mls),
  full.map((r) => Math.log(r.priorSalary.amount + 1)),
)

// By service-time bucket: floor(mls). Bucket 1 (n=1) folded into bucket 2 —
// a single row is not its own bucket.
function bucketOf(mls) {
  const f = Math.floor(mls)
  return f <= 2 ? 2 : f >= 5 ? 5 : f
}
const bucketFits = {}
for (const b of [2, 3, 4, 5]) {
  const rows = full.filter((r) => bucketOf(r.mls) === b)
  if (rows.length < 30) continue
  const d = buildDesign(rows, true)
  bucketFits[b] = { n: rows.length, fit: olsFit(d.X, d.y, PREDICTOR_NAMES) }
}

// By position (pitcher vs hitter)
const positionFits = {}
for (const [label, isPitcher] of [
  ['pitcher', true],
  ['hitter', false],
]) {
  const rows = full.filter((r) => r.isPitcher === isPitcher)
  const d = buildDesign(rows, true)
  positionFits[label] = { n: rows.length, fit: olsFit(d.X, d.y, PREDICTOR_NAMES) }
}

// Leave-one-season-out on the full log-linear model: for each coefficient,
// how many of the 9 refits keep the SAME SIGN as the full-sample fit, and how
// many stay significant at p<0.05.
const loso = {}
for (const name of PREDICTOR_NAMES) loso[name] = { sameSignCount: 0, significantCount: 0, refits: 9 }
for (const season of SEASONS) {
  const rows = full.filter((r) => r.season !== season)
  const d = buildDesign(rows, true)
  const fit = olsFit(d.X, d.y, PREDICTOR_NAMES)
  for (const c of fit.coefficients) {
    if (c.label === 'intercept') continue
    const fullCoef = logFit.coefficients.find((fc) => fc.label === c.label)
    if (Math.sign(c.beta) === Math.sign(fullCoef.beta)) loso[c.label].sameSignCount++
    if (c.p < 0.05) loso[c.label].significantCount++
  }
}

// -------------------------------------------------------- PART TWO: exchanged
const exchanged = panel.filter((r) => r.playerRequest.amount != null && r.clubOffer.amount != null)
const exchangedSettled = exchanged.filter((r) => r.settled.amount != null)
function settlePosition(r) {
  const { amount: req } = r.playerRequest
  const { amount: off } = r.clubOffer
  if (req === off) return null // degenerate, avoid divide-by-zero
  return (r.settled.amount - off) / (req - off)
}
const rawPositions = exchangedSettled.map((r) => ({ ...r, pos: settlePosition(r) })).filter((r) => r.pos != null)

// A genuine settlement of a filed case — decided by a panel or negotiated
// before one — can only land AT one of the two filed figures or between
// them; the panel's own rule is to pick exactly one, never split the
// difference. Three rows land far outside [0,1] (Springer 1.75, Nola 2.98,
// Severino 6.59, all 2018-2019) — checked against the raw CSV: two of the
// three carry an explicit `note` of "4-year extension" / "signed 4-year
// extension" (Nola, Severino). Their `settled_salary` cell holds a plain
// number, so parseMoneyCell's own extension-keyword detection does not
// catch it — the number is real, but it prices a multi-year extension, not
// this case's one-year ask-versus-offer question. Springer carries no such
// note but shows the same signature and was independently confirmed (public
// record: a 2-year deal covering his remaining arb seasons, agreed the same
// month). All three are excluded from the file-and-trial question below,
// by the objective rule (outside [0,1]), not by looking up who they were.
const outOfRangeRows = rawPositions.filter((r) => r.pos < 0 || r.pos > 1)
const settlePositions = rawPositions.filter((r) => r.pos >= 0 && r.pos <= 1)
const exactAtOffer = settlePositions.filter((r) => r.pos === 0).length
const exactAtRequest = settlePositions.filter((r) => r.pos === 1).length
const strictlyBetween = settlePositions.length - exactAtOffer - exactAtRequest

const clubGroups = new Map()
for (const r of settlePositions) {
  if (!clubGroups.has(r.club)) clubGroups.set(r.club, [])
  clubGroups.get(r.club).push(r.pos)
}
const clubSummary = [...clubGroups.entries()]
  .map(([club, positions]) => ({ club, n: positions.length, meanPosition: mean(positions) }))
  .sort((a, b) => b.n - a.n)

// Do clubs differ systematically at all, or is the spread in clubSummary just
// what 155 cases split unevenly across ~32 codes would look like by chance?
// A permutation test on the BETWEEN-CLUB variance of the mean settle
// position: shuffle which club label attaches to which case (club GROUP
// SIZES held fixed) 20,000 times, and see how often chance alone produces a
// between-club variance at least as large as the real one. Restricted to
// clubs with n>=5 cases (13 clubs, 113 of the 155 rows) — below that a
// single case swings a club's mean by 20+ points and adds noise without
// adding a real test.
const clubRows = settlePositions.filter((r) => clubGroups.get(r.club).length >= 5)
const clubLabels = clubRows.map((r) => r.club)
const clubValues = clubRows.map((r) => r.pos)
function betweenClubVariance(labels, values) {
  const byGroup = new Map()
  labels.forEach((label, i) => {
    if (!byGroup.has(label)) byGroup.set(label, [])
    byGroup.get(label).push(values[i])
  })
  const groupMeans = [...byGroup.values()].map(mean)
  const overall = mean(values)
  return mean(groupMeans.map((m) => (m - overall) ** 2))
}
const observedBetweenVar = betweenClubVariance(clubLabels, clubValues)
let moreExtreme = 0
const PERMUTATIONS = 20000
const shuffled = [...clubLabels]
for (let iter = 0; iter < PERMUTATIONS; iter++) {
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  if (betweenClubVariance(shuffled, clubValues) >= observedBetweenVar) moreExtreme++
}
const clubVariancePermutationP = moreExtreme / PERMUTATIONS

// -------------------------------------------------------- PART THREE: warp/war
// Restrict the primary crosswalk to `exact` identity confidence only — a
// fuzzy or unresolved match risks joining the wrong man's MLB WAR onto a
// player's WARP line, which would corrupt a correlation before it's even
// computed (docs/contracts-data-caveats.md's whole point about identity).
const exactRows = panel.filter((r) => r.confidence === 'exact')

const platformJoin = exactRows.filter((r) => r.priorWarp != null && r.mlbWarPlatform != null)
const careerJoinRows = exactRows.filter((r) => r.careerWarp != null && r.mlbWarCareer != null)

function warpWarStats(rows, warpKey, warKeyFn) {
  const warp = rows.map((r) => r[warpKey])
  const war = rows.map(warKeyFn)
  const diffs = war.map((w, i) => w - warp[i])
  return {
    n: rows.length,
    pearson: pearson(warp, war),
    spearman: spearman(warp, war),
    meanWarp: mean(warp),
    meanWar: mean(war),
    sdWarp: sd(warp),
    sdWar: sd(war),
    meanDiff: mean(diffs),
    medianDiff: [...diffs].sort((a, b) => a - b)[Math.floor(diffs.length / 2)],
  }
}
const platformStats = warpWarStats(platformJoin, 'priorWarp', (r) => r.mlbWarPlatform.value)
const careerStats = warpWarStats(careerJoinRows, 'careerWarp', (r) => r.mlbWarCareer.value)

// Unit-comparability check: regress MLB WAR on BP WARP (platform season). A
// slope near 1 with an intercept near 0 means the two scales already agree;
// anything else means an "offset" would be comparing different units.
const unitCheckX = platformJoin.map((r) => [r.priorWarp])
const unitCheckY = platformJoin.map((r) => r.mlbWarPlatform.value)
const unitCheckFit = olsFit(unitCheckX, unitCheckY, ['priorWarp'])

// By position
const platformByPosition = {}
for (const [label, isPitcher] of [
  ['pitcher', true],
  ['hitter', false],
]) {
  const rows = platformJoin.filter((r) => r.isPitcher === isPitcher)
  platformByPosition[label] = warpWarStats(rows, 'priorWarp', (r) => r.mlbWarPlatform.value)
}

// By era: three 3-season bands over the platform season's own year (platformSeason
// = season - 1, so this bands 2017-2025 into three chunks)
const ERA_BANDS = [
  [2017, 2019, '2017-2019'],
  [2020, 2022, '2020-2022'],
  [2023, 2025, '2023-2025'],
]
const platformByEra = {}
for (const [start, end, label] of ERA_BANDS) {
  const rows = platformJoin.filter((r) => r.platformSeason >= start && r.platformSeason <= end)
  platformByEra[label] = warpWarStats(rows, 'priorWarp', (r) => r.mlbWarPlatform.value)
}

// Robustness: does confidence tier matter? Compare exact-only vs exact+fuzzy.
const withFuzzy = panel.filter((r) => r.confidence === 'exact' || r.confidence === 'fuzzy')
const platformJoinWithFuzzy = withFuzzy.filter((r) => r.priorWarp != null && r.mlbWarPlatform != null)
const platformStatsWithFuzzy = warpWarStats(platformJoinWithFuzzy, 'priorWarp', (r) => r.mlbWarPlatform.value)

// Leave-one-season-out on the platform-season correlation (by platformSeason,
// 2017-2025 — 9 distinct platform years)
const platformSeasons = [...new Set(platformJoin.map((r) => r.platformSeason))].sort()
const platformLoso = platformSeasons.map((s) => {
  const rows = platformJoin.filter((r) => r.platformSeason !== s)
  return { excludedSeason: s, n: rows.length, pearson: pearson(rows.map((r) => r.priorWarp), rows.map((r) => r.mlbWarPlatform.value)) }
})

// Biggest disagreements (platform season), with names, for the write-up.
const withDiff = platformJoin.map((r) => ({
  player: r.player,
  season: r.season,
  platformSeason: r.platformSeason,
  position: r.position,
  priorWarp: r.priorWarp,
  mlbWar: r.mlbWarPlatform.value,
  diff: r.mlbWarPlatform.value - r.priorWarp,
}))
const topWarHigher = [...withDiff].sort((a, b) => b.diff - a.diff).slice(0, 10)
const topWarpHigher = [...withDiff].sort((a, b) => a.diff - b.diff).slice(0, 10)

// ------------------------------------------------------------------- output
const result = {
  generatedAt: new Date().toISOString(),
  partOne: {
    settledNumericN: settledNumeric.length,
    fullRegressionN: full.length,
    mlsVsPriorSalaryPearson: mlsVsPriorSalaryR,
    mlsVsLogPriorSalaryPearson: mlsVsLogPriorSalaryR,
    logLinearFit: logFit,
    levelFit,
    vif: logVif,
    byServiceBucket: bucketFits,
    byPosition: positionFits,
    leaveOneSeasonOut: loso,
  },
  partTwo: {
    exchangedN: exchanged.length,
    exchangedSettledNumericN: exchangedSettled.length,
    outOfRangeExcluded: outOfRangeRows.map((r) => ({ player: r.player, season: r.season, pos: r.pos, note: r.noteRaw })),
    cleanN: settlePositions.length,
    meanSettlePosition: mean(settlePositions.map((r) => r.pos)),
    medianSettlePosition: [...settlePositions.map((r) => r.pos)].sort((a, b) => a - b)[Math.floor(settlePositions.length / 2)],
    sdSettlePosition: sd(settlePositions.map((r) => r.pos)),
    exactAtOffer,
    exactAtRequest,
    strictlyBetween,
    byClub: clubSummary,
    clubVarianceTest: {
      clubsIncluded: [...new Set(clubLabels)].length,
      rowsIncluded: clubRows.length,
      observedBetweenVar,
      permutations: PERMUTATIONS,
      p: clubVariancePermutationP,
    },
  },
  partThree: {
    exactConfidenceN: exactRows.length,
    platform: platformStats,
    career: careerStats,
    unitCheck: unitCheckFit,
    byPosition: platformByPosition,
    byEra: platformByEra,
    robustnessWithFuzzy: platformStatsWithFuzzy,
    leaveOneSeasonOut: platformLoso,
    topWarHigherThanWarp: topWarHigher,
    topWarpHigherThanWar: topWarpHigher,
  },
}

writeFileSync(join(__dirname, 'arbitration-findings.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
