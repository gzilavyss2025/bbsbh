// Pure number helpers, shared. No imports, no game state: safe to call from any
// module, reveal-only or not. A copy stays apart only when a comment says why
// (owner decision 2026-09-30, #1306).

// A finite number, else 0. `null`, `undefined`, `''` and `'x'` all read as 0.
export function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}
