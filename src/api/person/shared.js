// Pure formatting helpers shared across the person/ modules. No fetching, no
// spoiler-sensitive data — see ../person.js's header for the module's overall
// spoiler footing.

export const DASH = '—'
// Non-breaking space (U+00A0) — joins the count and label inside a game-log
// stat token so a long broadcast line wraps only at the commas between tokens,
// never splitting a single stat like "9 K" across two lines.
export const NBSP = ' '

export function num(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : 0
}

// ".302" style rate: three decimals, no leading zero (baseball convention).
export function rate3(x) {
  if (!Number.isFinite(x)) return DASH
  return x.toFixed(3).replace(/^0(?=\.)/, '')
}

// ".59" style rate: two decimals, no leading zero — BB/K reads like a
// fractional average, not a whole-number ratio.
export function rate2(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2).replace(/^0(?=\.)/, '') : null
}

export function outsToIp(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`
}

// A proportion field (the API sends ".406" strings) as a one-decimal percent.
export function propPct(v) {
  const n = Number(v)
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : null
}
export function fixed2(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : null
}
export function roundInt(v) {
  const n = Number(v)
  return Number.isFinite(n) ? String(Math.round(n)) : null
}

// Shared by transactions.js's awardMonthYear and activity.js's ilMonthDay —
// one table so the two date-formatting call sites can't drift apart.
export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
