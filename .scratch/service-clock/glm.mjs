// A small Poisson regression with an offset, fitted by iteratively reweighted
// least squares. Written here rather than pulled in because the spike needs one
// model shape and no dependency: counts of promotions in a (season, day) cell,
// season and day-of-season absorbed as fixed effects, and one coefficient on
// "this day is past the service line".
//
// Solving is plain Gaussian elimination with partial pivoting on the ~40x40
// weighted normal equations. A ridge of 1e-8 keeps a collinear column from
// blowing the solve up rather than silently returning nonsense.

export function solve(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    if (Math.abs(M[piv][c]) < 1e-12) return null
    ;[M[c], M[piv]] = [M[piv], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      if (!f) continue
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / row[i][i] ?? 0).map((_, i) => M[i][n] / M[i][i])
}

// X: array of feature rows. y: counts. offset: log exposure.
export function poissonFit(X, y, offset, { maxIter = 60, tol = 1e-10, ridge = 1e-8 } = {}) {
  const n = y.length
  const p = X[0].length
  let beta = new Array(p).fill(0)
  // A sane start: the log mean rate in the intercept column.
  const total = y.reduce((a, b) => a + b, 0)
  const expo = offset.reduce((a, b) => a + Math.exp(b), 0)
  beta[0] = Math.log(Math.max(total, 0.5) / Math.max(expo, 1e-9))

  let lastDev = Infinity
  for (let it = 0; it < maxIter; it++) {
    const mu = new Array(n)
    for (let i = 0; i < n; i++) {
      let eta = offset[i]
      for (let k = 0; k < p; k++) eta += X[i][k] * beta[k]
      mu[i] = Math.exp(Math.min(30, eta))
    }
    // Weighted normal equations: X' W X beta = X' W z, W = mu, z = eta - offset + (y-mu)/mu
    const A = Array.from({ length: p }, () => new Array(p).fill(0))
    const b = new Array(p).fill(0)
    for (let i = 0; i < n; i++) {
      const w = Math.max(mu[i], 1e-10)
      let eta = offset[i]
      for (let k = 0; k < p; k++) eta += X[i][k] * beta[k]
      const z = eta - offset[i] + (y[i] - mu[i]) / w
      for (let a = 0; a < p; a++) {
        const xa = X[i][a]
        if (!xa) continue
        b[a] += w * xa * z
        for (let c = a; c < p; c++) A[a][c] += w * xa * X[i][c]
      }
    }
    for (let a = 0; a < p; a++) {
      for (let c = 0; c < a; c++) A[a][c] = A[c][a]
      A[a][a] += ridge
    }
    const next = solve(A, b)
    if (!next) return null
    beta = next
    let dev = 0
    for (let i = 0; i < n; i++) {
      let eta = offset[i]
      for (let k = 0; k < p; k++) eta += X[i][k] * beta[k]
      const m = Math.exp(Math.min(30, eta))
      dev += 2 * ((y[i] ? y[i] * Math.log(y[i] / m) : 0) - (y[i] - m))
    }
    if (Math.abs(lastDev - dev) < tol) break
    lastDev = dev
  }

  // Standard errors from the inverse information matrix.
  const mu = new Array(n)
  for (let i = 0; i < n; i++) {
    let eta = offset[i]
    for (let k = 0; k < p; k++) eta += X[i][k] * beta[k]
    mu[i] = Math.exp(Math.min(30, eta))
  }
  const I = Array.from({ length: p }, () => new Array(p).fill(0))
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < p; a++) {
      const xa = X[i][a]
      if (!xa) continue
      for (let c = 0; c < p; c++) I[a][c] += mu[i] * xa * X[i][c]
    }
  }
  for (let a = 0; a < p; a++) I[a][a] += ridge
  const se = new Array(p).fill(null)
  for (let k = 0; k < p; k++) {
    const e = new Array(p).fill(0)
    e[k] = 1
    const col = solve(
      I.map((r) => [...r]),
      e,
    )
    if (col) se[k] = Math.sqrt(Math.max(col[k], 0))
  }
  return { beta, se, deviance: lastDev, n }
}

// A sparse variant, for designs with club fixed effects: 21,600 cells and
// sixty-odd columns, but only about four non-zero entries in a row. The dense
// fit above builds the normal equations in O(cells x p^2), which is 83 million
// multiplications an iteration; this one is O(cells x nnz^2).
//
// `rows` is an array of [index, value] pair arrays. `p` is the column count.
export function poissonFitSparse(rows, y, offset, p, { maxIter = 60, tol = 1e-10, ridge = 1e-8 } = {}) {
  const n = y.length
  let beta = new Array(p).fill(0)
  const total = y.reduce((a, b) => a + b, 0)
  const expo = offset.reduce((a, b) => a + Math.exp(b), 0)
  beta[0] = Math.log(Math.max(total, 0.5) / Math.max(expo, 1e-9))

  let lastDev = Infinity
  let A = null
  for (let it = 0; it < maxIter; it++) {
    A = Array.from({ length: p }, () => new Array(p).fill(0))
    const b = new Array(p).fill(0)
    let dev = 0
    for (let i = 0; i < n; i++) {
      const row = rows[i]
      let eta = offset[i]
      for (const [k, v] of row) eta += v * beta[k]
      const mu = Math.exp(Math.min(30, eta))
      const w = Math.max(mu, 1e-10)
      const z = eta - offset[i] + (y[i] - mu) / w
      for (let a = 0; a < row.length; a++) {
        const [ka, va] = row[a]
        b[ka] += w * va * z
        for (let c = 0; c < row.length; c++) {
          const [kc, vc] = row[c]
          A[ka][kc] += w * va * vc
        }
      }
      dev += 2 * ((y[i] ? y[i] * Math.log(y[i] / mu) : 0) - (y[i] - mu))
    }
    for (let a = 0; a < p; a++) A[a][a] += ridge
    const next = solve(A, b)
    if (!next) return null
    beta = next
    if (Math.abs(lastDev - dev) < tol) {
      lastDev = dev
      break
    }
    lastDev = dev
  }

  // A is the weighted information matrix at the last iterate; invert the one
  // column the caller cares about rather than the whole matrix.
  const se = new Array(p).fill(null)
  for (let k = 0; k < p; k++) {
    const e = new Array(p).fill(0)
    e[k] = 1
    const col = solve(
      A.map((r) => [...r]),
      e,
    )
    if (col) se[k] = Math.sqrt(Math.max(col[k], 0))
  }
  return { beta, se, deviance: lastDev, n }
}
