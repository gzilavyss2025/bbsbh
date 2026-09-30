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

// MLB'S OWN OPS: round OBP and SLG to three places, THEN add. Not their sum at
// full precision, which differs from the published string for about one hitter
// in four (Judge 2025: 1.145 from MLB, 1.144 from the full-precision sum; 673 of
// 673 hitters match this way, #1275). Returns a number; print it with rate3.
const round3 = (v) => Math.round(v * 1000) / 1000
export const mlbOps = (obp, slg) => round3(obp) + round3(slg)

// ERA and WHIP from summed components. A pitcher who recorded no out has none:
// null, never 0, which would claim he was perfect (#1276). Each surface keeps
// its own "no value" and maps the null itself. Innings are outs / 3, so ERA is
// earned runs * 27 / outs.
export const eraOf = (earnedRuns, outs) => (outs > 0 ? (earnedRuns * 27) / outs : null)
export const whipOf = (walks, hits, outs) => (outs > 0 ? ((walks + hits) * 3) / outs : null)
// Sort key for a table of pitchers by ERA, best first: a null ERA goes last.
export const byEra = (a, b) => (a.era ?? Infinity) - (b.era ?? Infinity) || 0

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
