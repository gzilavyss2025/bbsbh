// The pure half of gen-season-checkpoints.mjs (#1855): which seasons it pools, and the
// league tails it derives from the raw checkpoint store. The line math itself is the
// app's (`src/api/hotcold/line.js`).
import { FULL_SEASON, STATS, STEP, inPool, sampleOf, unpack } from '../../../src/api/hotcold/line.js'
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

// The pools both outputs are built from, for one role: { [checkpoint]: rows, full: rows }.
// A checkpoint below FULL_SEASON pools the lines cut at it; `full` pools the FINAL lines of
// the seasons that reached FULL_SEASON (the rule compares a full season with full seasons).
// Only lines in the pool (`inPool`) count. A row is { id, season, name, team, line, final? },
// its team the club's nickname that season (or null), and `final` (checkpoint pools only)
// the season's final line, for where he finished (#1855 slice 3).
function poolsOf(rawBySeason, role) {
  const pools = {}
  for (const [season, raw] of Object.entries(rawBySeason)) {
    for (const [id, player] of Object.entries(raw?.[role] ?? {})) {
      const who = { id: Number(id), season: Number(season), name: player.n }
      const club = (teamId) => raw.teams?.[teamId] ?? null
      const final = player.f && unpack(role, player.f)
      player.c.forEach((packed, i) => {
        const line = unpack(role, packed)
        const checkpoint = (i + 1) * STEP
        if (checkpoint < FULL_SEASON && inPool(role, line)) (pools[checkpoint] ??= []).push({ ...who, team: club(player.ct?.[i]), line, final })
      })
      if (final && sampleOf(role, final) >= FULL_SEASON && inPool(role, final)) (pools.full ??= []).push({ ...who, team: club(player.t), line: final })
    }
  }
  return pools
}

// { [season]: raw } -> { hitting: { [checkpoint | 'full']: { n, q: { [stat]: [101 quantiles] } } },
// pitching }. A pool with fewer than MIN_POOL lines is left out: the rule would not read it.
export function buildTails(rawBySeason) {
  const tails = {}
  for (const role of ROLES) {
    tails[role] = {}
    for (const [key, rows] of Object.entries(poolsOf(rawBySeason, role))) {
      if (rows.length < MIN_POOL) continue
      const q = {}
      for (const stat of STATS[role]) {
        const values = rows.map((r) => stat.rate(r.line)).filter((v) => v != null).sort((a, b) => a - b)
        if (values.length) q[stat.key] = Array.from({ length: 101 }, (_, k) => round(quantile(values, k / 100)))
      }
      tails[role][key] = { n: rows.length, q }
    }
  }
  return tails
}

// The share of each side of a pool that buildExtremes keeps. A flag sits in a TAIL (2%)
// side of the same pool, so every season further out than a flagged player is inside 3%.
export const EXTREME_SHARE = 0.03

// One pool's extremes: { [stat]: { high, low } }, the outer EXTREME_SHARE of each side, most
// extreme first, as [value, id, season, name, team] rows; a checkpoint pool's rows add
// [finalValue, finalSample], where that season ended (games, or whole innings). A stat that
// flags on one side only (STATS `tails`) keeps that side only.
function extremesOf(role, rows) {
  const keep = Math.ceil(rows.length * EXTREME_SHARE)
  const stats = {}
  for (const stat of STATS[role]) {
    const valued = rows
      .map((r) => ({ ...r, v: stat.rate(r.line) }))
      .filter((r) => r.v != null)
      .sort((a, b) => a.v - b.v || a.season - b.season || a.id - b.id)
    const row = (r) => {
      const base = [round(r.v), r.id, r.season, r.name, r.team]
      if (!r.final) return base
      const end = stat.rate(r.final)
      return [...base, end == null ? null : round(end), sampleOf(role, r.final)]
    }
    const sides = {}
    if (!stat.tails || stat.tails.includes('high')) sides.high = valued.slice(-keep).reverse().map(row)
    if (!stat.tails || stat.tails.includes('low')) sides.low = valued.slice(0, keep).map(row)
    stats[stat.key] = sides
  }
  return stats
}

// { [season]: raw } -> { hitting: { [checkpoint | 'full']: { [stat]: { high, low } } }, pitching },
// over the same pools as buildTails. The player page counts and lists, from these rows, the
// past seasons further out than his: "Only 5 pitchers in the last 10 years had a better ERA".
export function buildExtremes(rawBySeason) {
  const out = {}
  for (const role of ROLES) {
    out[role] = {}
    for (const [key, rows] of Object.entries(poolsOf(rawBySeason, role))) {
      if (rows.length >= MIN_POOL) out[role][key] = extremesOf(role, rows)
    }
  }
  return out
}
