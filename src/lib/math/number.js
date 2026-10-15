// Pure number helpers, shared. No imports, no game state: safe to call from any
// module, reveal-only or not. A copy stays apart only when a comment says why
// (owner decision 2026-09-30, #1306).

// A finite number, else 0. `null`, `undefined`, `''` and `'x'` all read as 0.
export function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

// `n` held within [lo, hi]. Needs lo <= hi; NaN stays NaN.
export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

// `arr` cut into consecutive slices of at most `size`: the batches a bulk statsapi call takes.
export function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// One decimal place: 1.25 -> 1.3.
export function round1(n) {
  return Math.round(n * 10) / 10
}

// `n` of `of` as a whole percent, half up, or null with nothing to divide by. The product
// comes first: (29 / 200) * 100 is 14.499999999999998 and would round down.
export function pctOf(n, of) {
  return of > 0 ? Math.round((100 * n) / of) : null
}
