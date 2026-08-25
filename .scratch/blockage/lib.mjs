// OLS and logistic fits. The OLS half is the same normal-equations solver the
// org-regression work already uses (.scratch/level-benchmarks/org-regression.mjs)
// - lifted here rather than reinvented, with the logistic added for the
// competing-risk outcomes.

export function matTMat(X) {
  const p = X[0].length
  const M = Array.from({ length: p }, () => new Array(p).fill(0))
  for (const row of X) {
    for (let i = 0; i < p; i += 1) for (let j = 0; j < p; j += 1) M[i][j] += row[i] * row[j]
  }
  return M
}

export function matTVec(X, y) {
  const p = X[0].length
  const v = new Array(p).fill(0)
  for (let k = 0; k < X.length; k += 1) {
    for (let i = 0; i < p; i += 1) v[i] += X[k][i] * y[k]
  }
  return v
}

export function invert(M) {
  const n = M.length
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let col = 0; col < n; col += 1) {
    let pivot = col
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r
    }
    if (Math.abs(A[pivot][col]) < 1e-12) throw new Error(`singular design at column ${col}`)
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

function erf(x) {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const pc = 0.3275911
  const t = 1 / (1 + pc * ax)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax)
  return sign * y
}

export function twoTailedP(z) {
  return 2 * (1 - 0.5 * (1 + erf(Math.abs(z) / Math.SQRT2)))
}

export function ols(X, y, names) {
  const n = X.length
  const p = X[0].length
  const XtXinv = invert(matTMat(X))
  const Xty = matTVec(X, y)
  const beta = XtXinv.map((row) => row.reduce((s, v, i) => s + v * Xty[i], 0))
  const yhat = X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0))
  const resid = y.map((v, i) => v - yhat[i])
  const ssRes = resid.reduce((s, e) => s + e * e, 0)
  const mean = y.reduce((a, b) => a + b, 0) / n
  const ssTot = y.reduce((s, v) => s + (v - mean) ** 2, 0)
  const r2 = 1 - ssRes / ssTot
  const dof = n - p
  const sigma2 = ssRes / dof
  const se = XtXinv.map((row, i) => Math.sqrt(sigma2 * row[i]))
  return {
    n,
    p,
    r2,
    adjR2: 1 - (1 - r2) * ((n - 1) / dof),
    ssRes,
    ssTot,
    resid,
    yhat,
    terms: (names || beta.map((_, i) => `b${i}`)).map((nm, i) => ({
      name: nm,
      beta: beta[i],
      se: se[i],
      z: beta[i] / se[i],
      p: twoTailedP(beta[i] / se[i]),
    })),
  }
}

// Nested-model F test: does the bigger model buy anything over the smaller one?
export function fTest(small, big) {
  const df1 = big.p - small.p
  const df2 = big.n - big.p
  if (df1 <= 0) return null
  const F = ((small.ssRes - big.ssRes) / df1) / (big.ssRes / df2)
  return { F, df1, df2, deltaR2: big.r2 - small.r2 }
}

// Logistic via IRLS, for the outcomes that are not "how long did he wait".
export function logistic(X, y, names, maxIter = 60) {
  const n = X.length
  const p = X[0].length
  let beta = new Array(p).fill(0)
  let XtXinv = null
  for (let it = 0; it < maxIter; it += 1) {
    const eta = X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0))
    const mu = eta.map((e) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, e)))))
    const w = mu.map((m) => Math.max(m * (1 - m), 1e-8))
    const Xw = X.map((row, k) => row.map((v) => v * w[k]))
    const M = Array.from({ length: p }, () => new Array(p).fill(0))
    for (let k = 0; k < n; k += 1) {
      for (let i = 0; i < p; i += 1) for (let j = 0; j < p; j += 1) M[i][j] += Xw[k][i] * X[k][j]
    }
    const grad = new Array(p).fill(0)
    for (let k = 0; k < n; k += 1) {
      const r = y[k] - mu[k]
      for (let i = 0; i < p; i += 1) grad[i] += X[k][i] * r
    }
    XtXinv = invert(M)
    const step = XtXinv.map((row) => row.reduce((s, v, i) => s + v * grad[i], 0))
    let maxStep = 0
    for (let i = 0; i < p; i += 1) {
      beta[i] += step[i]
      maxStep = Math.max(maxStep, Math.abs(step[i]))
    }
    if (maxStep < 1e-9) break
  }
  const eta = X.map((row) => row.reduce((s, v, i) => s + v * beta[i], 0))
  const mu = eta.map((e) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, e)))))
  const ll = y.reduce((s, yi, k) => s + (yi ? Math.log(mu[k]) : Math.log(1 - mu[k])), 0)
  const base = y.reduce((a, b) => a + b, 0) / n
  const ll0 = y.reduce((s, yi) => s + (yi ? Math.log(base) : Math.log(1 - base)), 0)
  const se = XtXinv.map((row, i) => Math.sqrt(Math.abs(row[i])))
  return {
    n,
    p,
    ll,
    ll0,
    mcFadden: 1 - ll / ll0,
    terms: (names || beta.map((_, i) => `b${i}`)).map((nm, i) => ({
      name: nm,
      beta: beta[i],
      se: se[i],
      z: beta[i] / se[i],
      p: twoTailedP(beta[i] / se[i]),
      oddsRatio: Math.exp(beta[i]),
    })),
  }
}

// Multinomial logit via Fisher scoring, generalizing logistic() above to K
// classes. y is an integer class index 0..K-1; class 0 is the reference and
// carries no coefficients (same convention as a dummy-coded factor). Needed
// for the competing-risk read: "waited / traded / changed position" is one
// outcome with three fates, not three independent binary questions, and a
// joint fit lets one fate's predictors soak up variance the others would
// otherwise wrongly credit to themselves.
export function multinomial(X, y, K, classNames, featureNames, maxIter = 100) {
  const n = X.length
  const p = X[0].length
  const nParams = (K - 1) * p
  let beta = new Array(nParams).fill(0)

  function probsFor(row, b) {
    const exps = new Array(K - 1)
    for (let k = 0; k < K - 1; k += 1) {
      let s = 0
      for (let j = 0; j < p; j += 1) s += row[j] * b[k * p + j]
      exps[k] = Math.exp(Math.max(-30, Math.min(30, s)))
    }
    const denom = 1 + exps.reduce((a, v) => a + v, 0)
    const probs = new Array(K)
    probs[0] = 1 / denom
    for (let k = 0; k < K - 1; k += 1) probs[k + 1] = exps[k] / denom
    return probs
  }

  let H = null
  for (let it = 0; it < maxIter; it += 1) {
    const grad = new Array(nParams).fill(0)
    H = Array.from({ length: nParams }, () => new Array(nParams).fill(0))
    for (let i = 0; i < n; i += 1) {
      const row = X[i]
      const probs = probsFor(row, beta)
      for (let k = 0; k < K - 1; k += 1) {
        const yk = y[i] === k + 1 ? 1 : 0
        const resid = yk - probs[k + 1]
        for (let j = 0; j < p; j += 1) grad[k * p + j] += row[j] * resid
      }
      for (let k = 0; k < K - 1; k += 1) {
        for (let l = 0; l < K - 1; l += 1) {
          const w = probs[k + 1] * ((k === l ? 1 : 0) - probs[l + 1])
          if (w === 0) continue
          for (let a = 0; a < p; a += 1) {
            const xa = row[a]
            if (xa === 0) continue
            const wxa = w * xa
            for (let b = 0; b < p; b += 1) H[k * p + a][l * p + b] += wxa * row[b]
          }
        }
      }
    }
    const Hinv = invert(H)
    const step = Hinv.map((r) => r.reduce((s, v, i) => s + v * grad[i], 0))
    let maxStep = 0
    for (let i = 0; i < nParams; i += 1) {
      beta[i] += step[i]
      maxStep = Math.max(maxStep, Math.abs(step[i]))
    }
    if (maxStep < 1e-8) break
  }

  const Hinv = invert(H)
  let ll = 0
  const counts = new Array(K).fill(0)
  for (let i = 0; i < n; i += 1) {
    const probs = probsFor(X[i], beta)
    ll += Math.log(Math.max(probs[y[i]], 1e-12))
    counts[y[i]] += 1
  }
  let ll0 = 0
  for (let i = 0; i < n; i += 1) ll0 += Math.log(Math.max(counts[y[i]] / n, 1e-12))

  const classes = []
  for (let k = 0; k < K - 1; k += 1) {
    classes.push({
      className: classNames[k + 1],
      terms: (featureNames || []).map((nm, j) => {
        const idx = k * p + j
        const b = beta[idx]
        const se = Math.sqrt(Math.abs(Hinv[idx][idx]))
        const z = b / se
        return { name: nm, beta: b, se, z, p: twoTailedP(z), oddsRatio: Math.exp(b) }
      }),
    })
  }
  return { n, p, K, ll, ll0, mcFadden: 1 - ll / ll0, counts, classes }
}

export function median(arr) {
  if (!arr.length) return null
  const s = arr.slice().sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function quantile(arr, q) {
  if (!arr.length) return null
  const s = arr.slice().sort((a, b) => a - b)
  const idx = (s.length - 1) * q
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

export function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
}

export function zscoreBy(rows, keyFn, valFn) {
  const groups = new Map()
  rows.forEach((r, i) => {
    const k = keyFn(r)
    const v = valFn(r)
    if (v == null || !Number.isFinite(v)) return
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push({ i, v })
  })
  const out = new Array(rows.length).fill(null)
  for (const [, list] of groups) {
    const m = mean(list.map((e) => e.v))
    const sd = Math.sqrt(mean(list.map((e) => (e.v - m) ** 2))) || 1
    for (const e of list) out[e.i] = (e.v - m) / sd
  }
  return out
}
