// Numeric primitives for the homegrown-dependence spike, self-tested against
// textbook reference values before any of them touch real data. That order is
// deliberate: the last pass through this research caught a bad reference of its
// own only because the self-test ran first.
//
// Distribution tails follow org-variance-components.mjs (Abramowitz & Stegun /
// Numerical Recipes), extended with a Student-t tail, Pearson and Spearman
// correlation, and a two-way cluster-robust covariance.
//
// Run `node homegrown-stats.mjs` to execute the self-test alone.
import { pathToFileURL } from 'node:url'

// --- distribution tails -------------------------------------------------------
export function gammaln(x) {
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaln(1 - x)
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

function lowerIncompleteGammaRegularized(a, x) {
  if (x < 0 || a <= 0) return NaN
  if (x === 0) return 0
  if (x < a + 1) {
    let sum = 1 / a
    let term = sum
    for (let n = 1; n < 1000; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a))
  }
  // continued fraction for the upper tail, then complement
  let b = x + 1 - a
  let c = 1e300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-15) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gammaln(a)) * h
}

export function chiSquareUpperTailP(stat, df) {
  if (!(stat > 0)) return 1
  return 1 - lowerIncompleteGammaRegularized(df / 2, stat / 2)
}

function betacf(a, b, x) {
  const MAXIT = 400
  const EPS = 3e-16
  const FPMIN = 1e-300
  const qab = a + b
  const qap = a + 1
  const qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
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

export function incompleteBetaRegularized(a, b, x) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x))
  if (x < (a + 1) / (a + b + 2)) return (front * betacf(a, b, x)) / a
  return 1 - (front * betacf(b, a, 1 - x)) / b
}

export function fUpperTailP(F, df1, df2) {
  if (!(F > 0)) return 1
  return incompleteBetaRegularized(df2 / 2, df1 / 2, df2 / (df2 + df1 * F))
}

// Two-sided Student-t tail. P(|T| > |t|) = I_{df/(df+t^2)}(df/2, 1/2).
export function tTwoSidedP(t, df) {
  if (!Number.isFinite(t) || !(df > 0)) return NaN
  return incompleteBetaRegularized(df / 2, 0.5, df / (df + t * t))
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1
  x = Math.abs(x)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * x)
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return sign * y
}

export function normalTwoSidedP(z) {
  return 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)))
}

// --- correlation ---------------------------------------------------------------
export function pearson(x, y) {
  const n = x.length
  if (n !== y.length || n < 3) return { n, r: NaN, t: NaN, df: NaN, p: NaN }
  const mx = x.reduce((a, b) => a + b, 0) / n
  const my = y.reduce((a, b) => a + b, 0) / n
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
  const r = sxy / Math.sqrt(sxx * syy)
  const df = n - 2
  const t = (r * Math.sqrt(df)) / Math.sqrt(1 - r * r)
  return { n, r, t, df, p: tTwoSidedP(t, df) }
}

// Average ranks, so ties are handled the standard way.
export function rankify(v) {
  const idx = v.map((val, i) => [val, i]).sort((a, b) => a[0] - b[0])
  const ranks = new Array(v.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const avg = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = avg
    i = j + 1
  }
  return ranks
}

// Spearman as Pearson on ranks -- the definition that stays correct under ties,
// where the 1 - 6*sum(d^2)/(n(n^2-1)) shortcut does not.
export function spearman(x, y) {
  const out = pearson(rankify(x), rankify(y))
  return { n: out.n, rho: out.r, t: out.t, df: out.df, p: out.p }
}

// --- OLS ------------------------------------------------------------------------
export function matTMat(X) {
  const p = X[0].length
  const M = Array.from({ length: p }, () => new Array(p).fill(0))
  for (const row of X) for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) M[i][j] += row[i] * row[j]
  return M
}

export function matTVec(X, y) {
  const p = X[0].length
  const v = new Array(p).fill(0)
  for (let k = 0; k < X.length; k++) for (let i = 0; i < p; i++) v[i] += X[k][i] * y[k]
  return v
}

export function invert(M) {
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

export function fitOLS(X, y) {
  const XtX = matTMat(X)
  const XtXinv = invert(XtX)
  const Xty = matTVec(X, y)
  const beta = XtXinv.map((row) => row.reduce((s, v, i) => s + v * Xty[i], 0))
  const yhat = X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0))
  const resid = y.map((v, i) => v - yhat[i])
  const ssRes = resid.reduce((s, e) => s + e * e, 0)
  const mean = y.reduce((a, b) => a + b, 0) / y.length
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0)
  const n = X.length
  const p = X[0].length
  const dof = n - p
  const sigma2 = ssRes / dof
  const naiveCov = XtXinv.map((row) => row.map((v) => v * sigma2))
  return { beta, XtXinv, resid, ssRes, ssTot, r2: 1 - ssRes / ssTot, n, p, dof, sigma2, naiveCov }
}

// --- cluster-robust covariance ---------------------------------------------------
// CR1 sandwich, clustered on an arbitrary key. Returns the covariance and G.
export function clusterCov(X, resid, keys, XtXinv) {
  const p = X[0].length
  const byCluster = new Map()
  for (let i = 0; i < X.length; i++) {
    const k = keys[i]
    if (!byCluster.has(k)) byCluster.set(k, new Array(p).fill(0))
    const acc = byCluster.get(k)
    for (let j = 0; j < p; j++) acc[j] += X[i][j] * resid[i]
  }
  const meat = Array.from({ length: p }, () => new Array(p).fill(0))
  for (const acc of byCluster.values()) for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) meat[i][j] += acc[i] * acc[j]
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
  return { cov: cov.map((row) => row.map((v) => v * c)), G }
}

// Cameron-Gelbach-Miller two-way cluster-robust covariance:
//   V = V_A + V_B - V_{A intersect B}
// Needed here because a regressor that varies only at ORG-SEASON level, fitted
// against a per-DURATION outcome, has correlated errors along BOTH the org axis
// (the Moulton problem) and the player axis (a player contributes several
// durations). Clustering on one axis alone leaves the other uncorrected.
//
// The subtraction can push the result out of positive-definiteness. That is a
// known property of the estimator, not a bug, so `nonPositive` reports any
// negative variance on the diagonal rather than hiding it behind a NaN.
export function twoWayClusterCov(X, resid, keysA, keysB, XtXinv) {
  const a = clusterCov(X, resid, keysA, XtXinv)
  const b = clusterCov(X, resid, keysB, XtXinv)
  const ab = clusterCov(X, resid, keysA.map((k, i) => `${k}|${keysB[i]}`), XtXinv)
  const p = X[0].length
  const cov = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => a.cov[i][j] + b.cov[i][j] - ab.cov[i][j]))
  const nonPositive = []
  for (let i = 0; i < p; i++) if (!(cov[i][i] > 0)) nonPositive.push(i)
  return { cov, GA: a.G, GB: b.G, GAB: ab.G, nonPositive }
}

// Joint Wald F-test on a block of coefficients, given that block's covariance.
export function jointWaldF(betaBlock, covBlock, dfDenom) {
  const covInv = invert(covBlock)
  let W = 0
  for (let i = 0; i < betaBlock.length; i++) for (let j = 0; j < betaBlock.length; j++) W += betaBlock[i] * covInv[i][j] * betaBlock[j]
  const dfNum = betaBlock.length
  const F = W / dfNum
  return { W, dfNum, dfDenom, F, p: fUpperTailP(F, dfNum, dfDenom) }
}

// --- variance decomposition ------------------------------------------------------
// Within-group vs between-group SD of a value that varies by (group, time).
// The pre-check the fixed-effects design lives or dies on: if a covariate barely
// moves WITHIN a group over time, an org fixed effect leaves nothing to
// identify the coefficient from, and the resulting null means "no power", not
// "no effect".
export function withinBetween(rows, groupKey, valueKey) {
  const byGroup = new Map()
  for (const r of rows) {
    const g = r[groupKey]
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g).push(r[valueKey])
  }
  const grand = rows.reduce((s, r) => s + r[valueKey], 0) / rows.length
  const groupMeans = [...byGroup.entries()].map(([g, vs]) => ({ g, mean: vs.reduce((a, b) => a + b, 0) / vs.length, n: vs.length }))
  const betweenVar = groupMeans.reduce((s, gm) => s + gm.n * (gm.mean - grand) ** 2, 0) / rows.length
  let withinSS = 0
  for (const [g, vs] of byGroup) {
    const m = groupMeans.find((x) => x.g === g).mean
    for (const v of vs) withinSS += (v - m) ** 2
  }
  const withinVar = withinSS / rows.length
  return {
    n: rows.length,
    groups: byGroup.size,
    grandMean: grand,
    betweenSD: Math.sqrt(betweenVar),
    withinSD: Math.sqrt(withinVar),
    totalSD: Math.sqrt(betweenVar + withinVar),
    withinShareOfVariance: withinVar / (betweenVar + withinVar),
  }
}

// --- self-test -------------------------------------------------------------------
// Every reference below is a published critical value or an arithmetic identity
// worked by hand in the comment beside it. Nothing is checked against this
// module's own earlier output.
export function selfTest({ verbose = true } = {}) {
  const fails = []
  const near = (label, got, want, tol) => {
    const ok = Math.abs(got - want) <= tol
    if (verbose) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}: got ${Number(got).toPrecision(7)}, want ~${want}`)
    if (!ok) fails.push(label)
  }

  if (verbose) console.log('=== numeric self-test ===')
  // gammaln: ln(sqrt(pi)) and ln(4!)
  near('gammaln(0.5) = ln(sqrt(pi))', gammaln(0.5), Math.log(Math.sqrt(Math.PI)), 1e-9)
  near('gammaln(5) = ln(24)', gammaln(5), Math.log(24), 1e-9)
  // chi-square upper tail at published 5% criticals
  near('chi2 tail, stat=3.8415, df=1', chiSquareUpperTailP(3.8415, 1), 0.05, 5e-5)
  near('chi2 tail, stat=5.9915, df=2', chiSquareUpperTailP(5.9915, 2), 0.05, 5e-5)
  // df=29 matters: it is the org block's numerator df everywhere in this spike.
  // NOTE: org-variance-components.mjs's own self-test prints this same tail
  // against a stated expectation of "~0.0400" and gets 0.03856 -- because it
  // PRINTS its self-test rather than asserting it, so the mismatch went by. The
  // implementation is right (this module reproduces 0.03856 exactly); the
  // published critical is 42.557, not 43.773. Asserted here, with the real one.
  near('chi2 tail, stat=42.557, df=29', chiSquareUpperTailP(42.557, 29), 0.05, 5e-4)
  near('chi2 tail, stat=49.588, df=29', chiSquareUpperTailP(49.588, 29), 0.01, 5e-4)
  // F upper tail at published 5% criticals
  near('F tail, F=4.9646, df=(1,10)', fUpperTailP(4.9646, 1, 10), 0.05, 5e-5)
  near('F tail, F=4.1028, df=(2,10)', fUpperTailP(4.1028, 2, 10), 0.05, 5e-4)
  near('F tail, F=2.6896, df=(4,30)', fUpperTailP(2.6896, 4, 30), 0.05, 5e-4)
  // Student-t two-sided at published 5% criticals
  near('t tail, t=12.706, df=1', tTwoSidedP(12.706, 1), 0.05, 5e-5)
  near('t tail, t=2.7764, df=4', tTwoSidedP(2.7764, 4), 0.05, 5e-5)
  near('t tail, t=2.0086, df=50', tTwoSidedP(2.0086, 50), 0.05, 5e-5)
  near('normal tail, z=1.96', normalTwoSidedP(1.96), 0.05, 5e-4)

  // Pearson, worked by hand:
  //   x=[1,2,3,4,5] y=[2,4,5,4,5]; mx=3, my=4
  //   dx=[-2,-1,0,1,2], dy=[-2,0,1,0,1]
  //   Sxy=4+0+0+0+2=6, Sxx=10, Syy=6  ->  r = 6/sqrt(60) = 0.7745967
  //   t = r*sqrt(3)/sqrt(1-0.6) = 0.7745967*1.7320508/0.6324555 = 2.1213203
  const pr = pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])
  near('pearson r', pr.r, 6 / Math.sqrt(60), 1e-12)
  near('pearson t', pr.t, 2.1213203, 1e-6)
  // perfect and perfectly-inverse monotone
  near('pearson r, y=2x+1', pearson([1, 2, 3, 4], [3, 5, 7, 9]).r, 1, 1e-12)
  near('spearman rho, monotone up', spearman([1, 2, 3, 4, 5], [10, 20, 25, 40, 41]).rho, 1, 1e-12)
  near('spearman rho, monotone down', spearman([1, 2, 3, 4, 5], [41, 40, 25, 20, 10]).rho, -1, 1e-12)
  // Spearman, worked by hand on the untied 8-point set:
  //   x=[86,97,99,100,101,103,106,110] -> ranks 1..8
  //   y=[0,20,28,27,50,29,7,17]        -> ranks [1,4,6,5,8,7,2,3]
  //   d=[0,-2,-3,-1,-3,-1,5,5], sum(d^2)=0+4+9+1+9+1+25+25=74
  //   rho = 1 - 6*74/(8*(64-1)) = 1 - 444/504 = 0.1190476
  near('spearman rho, 8-point set', spearman([86, 97, 99, 100, 101, 103, 106, 110], [0, 20, 28, 27, 50, 29, 7, 17]).rho, 1 - 444 / 504, 1e-12)

  // OLS against the same hand-worked set: slope Sxy/Sxx = 6/10 = 0.6,
  // intercept my - slope*mx = 4 - 1.8 = 2.2, R^2 = r^2 = 0.6
  const X = [1, 2, 3, 4, 5].map((v) => [1, v])
  const fit = fitOLS(X, [2, 4, 5, 4, 5])
  near('ols intercept', fit.beta[0], 2.2, 1e-12)
  near('ols slope', fit.beta[1], 0.6, 1e-12)
  near('ols R^2', fit.r2, 0.6, 1e-12)
  // exact fit
  const exact = fitOLS([1, 2, 3, 4].map((v) => [1, v]), [5, 8, 11, 14])
  near('ols exact-fit slope', exact.beta[1], 3, 1e-9)
  near('ols exact-fit R^2', exact.r2, 1, 1e-12)
  // matrix inverse identity
  const M = [
    [4, 7],
    [2, 6],
  ]
  const Minv = invert(M)
  near('invert: (M*Minv)[0][0]', M[0][0] * Minv[0][0] + M[0][1] * Minv[1][0], 1, 1e-12)
  near('invert: (M*Minv)[0][1]', M[0][0] * Minv[0][1] + M[0][1] * Minv[1][1], 0, 1e-12)

  // Two-way clustering identity: if both cluster keys are the SAME variable,
  // then V_A + V_B - V_AB collapses to V_A exactly.
  const Xc = [
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [1, 6],
  ]
  const yc = [2, 4, 5, 4, 5, 8]
  const fc = fitOLS(Xc, yc)
  const keys = ['a', 'a', 'b', 'b', 'c', 'c']
  const one = clusterCov(Xc, fc.resid, keys, fc.XtXinv)
  const two = twoWayClusterCov(Xc, fc.resid, keys, keys, fc.XtXinv)
  near('two-way collapses to one-way when A==B', two.cov[1][1], one.cov[1][1], 1e-12)

  // Within/between decomposition against a hand-built case: two groups of two,
  // group means 1 and 3 (grand 2) -> between var = 1; deviations all +/-1 ->
  // within var = 1.
  const wb = withinBetween(
    [
      { g: 'x', v: 0 },
      { g: 'x', v: 2 },
      { g: 'y', v: 2 },
      { g: 'y', v: 4 },
    ],
    'g',
    'v',
  )
  near('withinBetween betweenSD', wb.betweenSD, 1, 1e-12)
  near('withinBetween withinSD', wb.withinSD, 1, 1e-12)

  if (verbose) console.log(fails.length ? `\nSELF-TEST FAILED: ${fails.join(', ')}\n` : '\nself-test passed\n')
  return fails
}

// `file://${argv[1]}` does not round-trip on Windows (a drive path becomes
// file:///C:/...), so compare resolved URLs instead of strings.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fails = selfTest()
  process.exit(fails.length ? 1 : 0)
}
