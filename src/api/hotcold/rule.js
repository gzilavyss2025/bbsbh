// Hot and cold seasons (#1855): which of a player's season stats stand out, and how far.
//
// Pure. The caller hands over his regular-season game log, the cutoff date and the league
// tails (`public/data/season-checkpoints/tails.json`, built by
// `scripts/gen-season-checkpoints.mjs`). The answer is at most two flags, the most unusual
// first. A normal season answers [].
//
// THE RULE. His line is folded to the checkpoint his sample reached (47 games -> the
// 40-game checkpoint; pitchers by innings), and each stat is placed among the league's
// lines at that SAME checkpoint over the pooled seasons. A stat flags when it sits in the
// bottom or top TAIL percent. The sample sets the weight: an early flag is a hot or cold
// start, a late one is a season.
//
// SPOILER CHECK. The player page is an open surface (ADR-0034), but a callout must not
// count a game still being played. statsapi's game log carries a game in progress, with
// no status on the row, so every row dated on or after `cutoff` is held back: today's
// games, finished or not, count from tomorrow. The caller passes the page's `?d=` date,
// or `slateToday()` when there is none.
//
// MLB only: the league pool is MLB, so a MiLB player answers [].
import { STATS, checkpointOf, foldSeason, inPool, sampleOf } from './line.js'

// The tail, in percent, on each side.
export const TAIL = 2
// A checkpoint needs this many league lines before its tail means anything.
export const MIN_POOL = 100
// At most this many callouts on a page.
export const MAX_FLAGS = 2

// The sample's weight: under EARLY_UNDER games (innings) is a start, from REAL_FROM on it
// is a season.
export const EARLY_UNDER = 30
export const REAL_FROM = 90
export const weightOf = (n) => (n < EARLY_UNDER ? 'early' : n < REAL_FROM ? 'firm' : 'real')

// Where `v` sits in a league, given the league's 101 quantiles (0th to 100th percentile,
// ascending). Between two quantiles it interpolates. On a tie with one or more quantiles
// (a crowd of lines at the same value, such as zero home runs) it answers the middle of
// the tie, so a value shared by a fifth of the league is never called its tail.
export function percentileOf(v, q) {
  if (!Array.isArray(q) || q.length < 2 || v == null || !Number.isFinite(v)) return null
  const last = q.length - 1
  let lo = 0
  while (lo <= last && q[lo] < v) lo++
  let hi = lo
  while (hi <= last && q[hi] === v) hi++
  const scale = 100 / last
  if (hi > lo) return ((lo + hi - 1) / 2) * scale
  if (lo === 0) return 0
  if (lo > last) return 100
  return (lo - 1 + (v - q[lo - 1]) / (q[lo] - q[lo - 1])) * scale
}

// The league table for a checkpoint: that one, or the deepest one below it that the
// pool fills (a 160-game season reads the 150-game table when 160 is thin).
function tableFor(byCheckpoint, checkpoint) {
  for (let c = checkpoint; c > 0; c -= 10) {
    const t = byCheckpoint?.[c]
    if (t && t.n >= MIN_POOL) return { checkpoint: c, ...t }
  }
  return null
}

// Rows that count: regular season, dated before the cutoff.
export function countedRows(rows, cutoff) {
  return (rows ?? []).filter((r) =>
    r?.stat && (r.gameType == null || r.gameType === 'R') &&
    (!cutoff || (typeof r.date === 'string' && r.date < cutoff)))
}

// { role: 'hitting'|'pitching', sportId, rows, cutoff, tails } -> up to MAX_FLAGS of
// { key, label, tone: 'hot'|'cold', value, percentile, checkpoint, sample, weight, pool, line }.
// `line` is his counted season line (line.js's fields), for the counts a callout prints. `sample` is games (hitters) or whole innings (pitchers); `percentile` is 0..100, high
// meaning a high value of the stat (a high K% is a high percentile for both roles).
export function hotColdFlags({ role, sportId, rows, cutoff, tails }) {
  if (sportId !== 1 || !STATS[role] || !tails?.[role]) return []
  const { final } = foldSeason(role, countedRows(rows, cutoff))
  const sample = sampleOf(role, final)
  const checkpoint = checkpointOf(sample)
  if (checkpoint == null || !inPool(role, final)) return []
  const table = tableFor(tails[role], checkpoint)
  if (!table) return []

  const flags = []
  STATS[role].forEach((stat, order) => {
    const value = stat.rate(final)
    const percentile = percentileOf(value, table.q?.[stat.key])
    if (percentile == null) return
    const side = percentile <= TAIL ? 'low' : percentile >= 100 - TAIL ? 'high' : null
    if (!side || (stat.tails && !stat.tails.includes(side))) return
    flags.push({
      key: stat.key,
      label: stat.label,
      group: stat.group ?? stat.key,
      tone: side === stat.better ? 'hot' : 'cold',
      value,
      percentile,
      extremity: Math.min(percentile, 100 - percentile),
      order,
      checkpoint: table.checkpoint,
      sample,
      weight: weightOf(sample),
      pool: table.n,
    })
  })

  // Most unusual first; a tie goes to the stat listed first in STATS. One flag per group.
  flags.sort((a, b) => a.extremity - b.extremity || a.order - b.order)
  const seen = new Set()
  const out = []
  for (const flag of flags) {
    if (seen.has(flag.group)) continue
    seen.add(flag.group)
    const { key, label, tone, value, percentile, checkpoint, sample, weight, pool } = flag
    out.push({ key, label, tone, value, percentile, checkpoint, sample, weight, pool, line: final })
    if (out.length === MAX_FLAGS) break
  }
  return out
}

// A two-way player's flags, one list per role, merged into the page's MAX_FLAGS places:
// most unusual first, and on a tie the role listed first. Each flag gains its `role`.
export function mergeRoles(byRole) {
  const extremity = (f) => Math.min(f.percentile, 100 - f.percentile)
  // flatMap keeps the role order and sort is stable, so a tie stays with the first role.
  return Object.entries(byRole)
    .flatMap(([role, flags]) => flags.map((f) => ({ ...f, role })))
    .sort((a, b) => extremity(a) - extremity(b))
    .slice(0, MAX_FLAGS)
}

// The past seasons further out than a flag, from its extremes file (`extremes/{role}-
// {checkpoint}.json`, gen-season-checkpoints.mjs): the stat's high side for a high
// percentile, the low side for a low one. Strictly further out (a tie is not "better"),
// and never the player's own season, which sits in the pool. Most extreme first, as
// { value, id, season, name }. The file keeps the outer 3% and a flag sits in the 2% tail,
// so every season past him is in it.
export function seasonsBeyond(flag, stats, { id, season }) {
  const high = flag.percentile >= 50
  const rows = stats?.[flag.key]?.[high ? 'high' : 'low'] ?? []
  const v = Math.round(flag.value * 1e4) / 1e4
  return rows
    .filter(([value, pid, s]) => (high ? value > v : value < v) && !(pid === id && s === season))
    .map(([value, pid, s, name]) => ({ value, id: pid, season: s, name }))
}
