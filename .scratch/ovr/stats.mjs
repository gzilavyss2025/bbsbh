// Small stats helpers for the OVR calibration. No dependencies.
export const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length
export function pearson(x, y) {
  const mx = mean(x), my = mean(y)
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2 }
  return sxy / Math.sqrt(sxx * syy)
}
// average ranks (ties share the mean rank), 1-based
export function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0])
  const r = new Array(a.length)
  for (let i = 0; i < idx.length;) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1
    i = j + 1
  }
  return r
}
export const spearman = (x, y) => pearson(ranks(x), ranks(y))
// Fisher-z 95% interval for a correlation
export function rCI(r, n) { const z = Math.atanh(r), se = 1 / Math.sqrt(n - 3); return [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)] }
// OLS with intercept via normal equations. X: rows of predictors. Returns {beta (incl. intercept first), r2}
export function ols(X, y) {
  const n = X.length, k = X[0].length + 1
  const A = Array.from({ length: k }, () => new Array(k + 1).fill(0))
  for (let i = 0; i < n; i++) {
    const row = [1, ...X[i]]
    for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += row[a] * row[b]; A[a][k] += row[a] * y[i] }
  }
  for (let c = 0; c < k; c++) {
    let p = c
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]
    for (let r = 0; r < k; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q <= k; q++) A[r][q] -= f * A[c][q] }
  }
  const beta = A.map((row, i) => row[k] / row[i])
  const my = mean(y)
  let ssr = 0, sst = 0
  for (let i = 0; i < n; i++) { const pred = beta[0] + X[i].reduce((s, v, j) => s + v * beta[j + 1], 0); ssr += (y[i] - pred) ** 2; sst += (y[i] - my) ** 2 }
  return { beta, r2: 1 - ssr / sst }
}
