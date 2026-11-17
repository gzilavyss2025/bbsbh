// Win probability for /research (#3141, part 2): WPA, RE24 and Leverage Index on a plate
// appearance. Gary, 2026-11-16/17: the numbers ride in a SIDE FILE next to each month
// shard (`{season}/{MM}.wp.json`), so the main shards neither grow nor need a rebuild,
// and the page loads it only for the Win prob toggle or a Leverage chip.
//
// SIDE FILE: { v, n, w: [...], re: [...] }, one entry per decoded PA of the month shard,
// in decodePlateAppearances order (`n` is that count; a mismatch is an error, never a
// silent misalignment). `w` is the PA's summed Savant `delta_home_win_exp` x 1000, from
// the HOME club's view; `re` its summed `delta_run_exp` x 100, from the BATTING club's
// view (both checked against 2025-06-15 home runs, 2026-11-17).
//
// LEVERAGE. Savant has no LI. scripts/research/gen-leverage.mjs builds
// public/data/leverage-index.json from Savant (Tango's method): a state's mean |WPA| over
// the mean |WPA| of every PA. State = inning (9 = 9th or later), half, outs, runners,
// batting margin clamped to ±4, at the PA's start. A state with too few PAs falls back to
// inning + half + margin. Buckets (Gary): Low < 0.85, Medium, High > 2.0.
//
// SPOILER CLASSIFICATION: spoiler-free. Past games only, on an open page (ADR-0034).

export const WP_VERSION = 1
export const LI_MIN_N = 30

const clampMargin = (m) => Math.max(-4, Math.min(4, m ?? 0))
const inn = (i) => Math.min(9, i ?? 1)
export const stateKey = (pa) => `${inn(pa.inning)}${pa.top ? 't' : 'b'}${pa.outs ?? 0}${pa.runners ?? 0}${clampMargin(pa.margin)}`
export const coarseKey = (pa) => `${inn(pa.inning)}${pa.top ? 't' : 'b'}${clampMargin(pa.margin)}`

// Savant rows + the shard's decoded PAs -> the side file.
export function encodeWinProb(rows, pas) {
  const sum = new Map()
  for (const r of rows) {
    const k = `${r.game_pk}-${r.at_bat_number}`
    const s = sum.get(k) ?? { w: 0, re: 0 }
    s.w += Number(r.delta_home_win_exp) || 0
    s.re += Number(r.delta_run_exp) || 0
    sum.set(k, s)
  }
  const at = (pa) => sum.get(pa.key) ?? { w: 0, re: 0 }
  return { v: WP_VERSION, n: pas.length, w: pas.map((pa) => Math.round(at(pa).w * 1000)), re: pas.map((pa) => Math.round(at(pa).re * 100)) }
}

// Decoded PAs + their states' |WPA| -> the leverage table. `pas` carry `swing` (|WPA|).
export function buildLeverage(pas) {
  const fine = new Map()
  const coarse = new Map()
  let all = 0
  const add = (m, k, x) => {
    const s = m.get(k) ?? [0, 0]
    s[0] += x
    s[1]++
    m.set(k, s)
  }
  for (const pa of pas) {
    add(fine, stateKey(pa), pa.swing)
    add(coarse, coarseKey(pa), pa.swing)
    all += pa.swing
  }
  const avg = all / (pas.length || 1)
  const li = (m) => Object.fromEntries([...m].filter(([, [, n]]) => n >= LI_MIN_N).sort(([a], [b]) => a.localeCompare(b)).map(([k, [s, n]]) => [k, Math.round((s / n / avg) * 100) / 100]))
  return { states: li(fine), coarse: li(coarse), pas: pas.length }
}

// A PA's LI from the table; null when neither key is on file.
export const leverageOf = (table, pa) => table.states[stateKey(pa)] ?? table.coarse[coarseKey(pa)] ?? null

export const LEVERAGE = [['low', 'Low'], ['med', 'Medium'], ['high', 'High']]
export const leverageBucket = (li) => (li == null ? null : li < 0.85 ? 'low' : li > 2 ? 'high' : 'med')

// Set `wpa` (batting club's view), `re24` and `li` on one month's PAs. Throws on a
// side file that does not line up with the shard.
export function attachWinProb(pas, side, table) {
  if (side.n !== pas.length || side.w.length !== pas.length) throw new Error(`win probability file holds ${side.n} PAs, the shard ${pas.length}`)
  pas.forEach((pa, i) => {
    pa.wpa = (pa.top ? -side.w[i] : side.w[i]) / 1000
    pa.re24 = side.re[i] / 100
    pa.li = leverageOf(table, pa)
  })
}

// The summary line's win-probability totals over matches: summed WPA and RE24, mean LI.
export function winProbTotals(matches) {
  const withWp = matches.filter((m) => m.wpa != null)
  if (!withWp.length) return null
  const lis = withWp.filter((m) => m.li != null)
  return {
    wpa: withWp.reduce((s, m) => s + m.wpa, 0),
    re24: withWp.reduce((s, m) => s + m.re24, 0),
    li: lis.length ? lis.reduce((s, m) => s + m.li, 0) / lis.length : null,
  }
}
