// The pure half of gen-season-checkpoints.mjs (#1855): which seasons it pools, and the
// league tails it derives from the raw checkpoint store. The line math itself is the
// app's (`src/api/hotcold/line.js`).
import { FULL_SEASON, STATS, inPool, sampleOf, unpack } from '../../../src/api/hotcold/line.js'
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

// The share of each side of a checkpoint's pool that buildExtremes keeps. A flag sits in a
// TAIL (2%) side, so every season further out than a flagged player is inside 3%.
export const EXTREME_SHARE = 0.03

const r4 = (x) => Math.round(x * 1e4) / 1e4

// One pool's extremes: { [stat]: { high, low } }, the outer EXTREME_SHARE of each side, most
// extreme first, as [value, id, season, name, team] rows (team: the club's nickname that
// season, or null). A stat that flags on one side only
// (STATS `tails`) keeps that side only.
function extremesOf(role, rows) {
  const keep = Math.ceil(rows.length * EXTREME_SHARE)
  const stats = {}
  for (const stat of STATS[role]) {
    const valued = rows
      .map((r) => ({ ...r, v: stat.rate(r.line) }))
      .filter((r) => r.v != null)
      .sort((a, b) => a.v - b.v || a.season - b.season || a.id - b.id)
    const row = (r) => [r4(r.v), r.id, r.season, r.name, r.team]
    const sides = {}
    if (!stat.tails || stat.tails.includes('high')) sides.high = valued.slice(-keep).reverse().map(row)
    if (!stat.tails || stat.tails.includes('low')) sides.low = valued.slice(0, keep).map(row)
    stats[stat.key] = sides
  }
  return stats
}

// { [season]: raw } -> { hitting: { [checkpoint | 'full']: { [stat]: { high, low } } }, pitching }.
// Each checkpoint below FULL_SEASON pools the lines cut at it; 'full' is the FINAL lines of the seasons
// that reached FULL_SEASON. The player page counts and lists, from these rows, the past
// seasons further out than his: "Only 5 pitchers in the last 10 years had a better ERA".
export function buildExtremes(rawBySeason) {
  const out = {}
  for (const role of ROLES) {
    const pools = {}
    for (const [season, raw] of Object.entries(rawBySeason)) {
      for (const [id, player] of Object.entries(raw?.[role] ?? {})) {
        const who = { id: Number(id), season: Number(season), name: player.n }
        const club = (teamId) => raw.teams?.[teamId] ?? null
        player.c.forEach((packed, i) => {
          const line = unpack(role, packed)
          const checkpoint = (i + 1) * 10
          if (checkpoint < FULL_SEASON && inPool(role, line)) (pools[checkpoint] ??= []).push({ ...who, team: club(player.ct?.[i]), line })
        })
        const final = unpack(role, player.f)
        if (sampleOf(role, final) >= FULL_SEASON && inPool(role, final)) (pools.full ??= []).push({ ...who, team: club(player.t), line: final })
      }
    }
    out[role] = {}
    for (const [key, rows] of Object.entries(pools)) {
      if (rows.length >= MIN_POOL) out[role][key] = extremesOf(role, rows)
    }
  }
  return out
}
