// The pure half of gen-season-checkpoints.mjs (#1855): which seasons it pools, and the
// league tails it derives from the raw checkpoint store. The line math itself is the
// app's (`src/api/hotcold/line.js`).
import { STATS, inPool, unpack } from '../../../src/api/hotcold/line.js'
import { MIN_POOL } from '../../../src/api/hotcold/rule.js'

export const ROLES = ['hitting', 'pitching']

// The last COMPLETED regular season on `todayIso` (YYYY-MM-DD). `row` is statsapi's season
// row for that calendar year; once its regularSeasonEndDate has passed the year counts.
// With no row it falls back to October 1, a few days after every recent final day.
export function lastCompletedSeason(todayIso, row) {
  const year = Number(todayIso.slice(0, 4))
  const end = Number(row?.seasonId) === year ? row?.regularSeasonEndDate : null
  if (typeof end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(end)) return todayIso > end ? year : year - 1
  return todayIso.slice(5) >= '10-01' ? year : year - 1
}

// Quantile p (0..1) of an ascending array, linear between neighbours.
export function quantile(sorted, p) {
  const at = p * (sorted.length - 1)
  const i = Math.floor(at)
  return i + 1 < sorted.length ? sorted[i] + (sorted[i + 1] - sorted[i]) * (at - i) : sorted[i]
}

const round = (x) => Math.round(x * 1e4) / 1e4

// { [season]: raw } -> { hitting: { [checkpoint]: { n, q: { [stat]: [101 quantiles] } } }, pitching }.
// A raw player's `c[i]` is his line at checkpoint (i + 1) * 10. Only lines in the pool
// (`inPool`) count, at every checkpoint. A checkpoint with fewer than MIN_POOL lines is
// left out: the rule would not read it.
export function buildTails(rawBySeason) {
  const tails = {}
  for (const role of ROLES) {
    const byCheckpoint = {}
    for (const raw of Object.values(rawBySeason)) {
      for (const player of Object.values(raw?.[role] ?? {})) {
        player.c.forEach((packed, i) => {
          const line = unpack(role, packed)
          if (inPool(role, line)) (byCheckpoint[(i + 1) * 10] ??= []).push(line)
        })
      }
    }
    tails[role] = {}
    for (const [checkpoint, lines] of Object.entries(byCheckpoint)) {
      if (lines.length < MIN_POOL) continue
      const q = {}
      for (const stat of STATS[role]) {
        const values = lines.map(stat.rate).filter((v) => v != null).sort((a, b) => a - b)
        if (values.length) q[stat.key] = Array.from({ length: 101 }, (_, k) => round(quantile(values, k / 100)))
      }
      tails[role][checkpoint] = { n: lines.length, q }
    }
  }
  return tails
}
