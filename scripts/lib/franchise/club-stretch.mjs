// The pure half of scripts/franchise/gen-club-stretch.mjs: one club's best runs of N games in a row
// (Gary, 2026-11-16). A run counts the player's own games played, crosses seasons, and ends
// when he plays a game for another club; a return stint starts a new run. AVG and OPS need
// 3.1 plate appearances per game (the batting-title rule). One row per player, top ten.
import { BAT_MEASURES, bestStretch } from '../../../src/api/streaks/bestStretch.js'

export const LENGTHS = [162, 154]
export const TOP = 10
export const PA_PER_GAME = 3.1
const RATES = new Set(['avg', 'ops'])

// Old logs can leave plateAppearances at 0: rebuild it from its parts.
const paOf = (t) => t.plateAppearances || t.atBats + t.baseOnBalls + t.hitByPitch + t.sacFlies

// A measure with the rate floor: a run short of it ranks below every real one.
export function flooredMeasure(m, n) {
  if (!RATES.has(m.key)) return m
  const need = Math.ceil(PA_PER_GAME * n)
  return { ...m, of: (t) => (paOf(t) >= need ? m.of(t) : -Infinity) }
}

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameNumber - b.gameNumber)

// A career log -> the unbroken runs of games for one club, in order.
export function stintsFor(games, teamId) {
  const out = []
  let cur = null
  for (const g of [...games].sort(byDate)) {
    if (g.teamId === teamId) (cur ??= out[out.push([]) - 1]).push(g)
    else cur = null
  }
  return out
}

// One player's best run with the club, or null when no stint is long enough (or none
// clears the rate floor).
export function playerBest(games, teamId, n, measure) {
  const m = flooredMeasure(measure, n)
  let best = null
  for (const stint of stintsFor(games, teamId)) {
    const b = bestStretch(stint, n, m)
    if (b && b.value !== -Infinity && (!best || b.value > best.value)) best = b
  }
  return best
}

// One player's rows for one club: { "162:hr": row, ... }, a key only where he has a run.
export function playerRows({ id, name, games }, teamId) {
  const out = {}
  for (const n of LENGTHS) {
    for (const m of BAT_MEASURES) {
      const b = playerBest(games, teamId, n, m)
      if (b) out[`${n}:${m.key}`] = { id, name, team: b.teams.join(' / '), first: b.first, last: b.last, raw: b.value, value: m.format(b.value) }
    }
  }
  return out
}

// Every player's rows for a club -> { 162: { hr: top ten, ... }, 154: { ... } }. A tie keeps
// the earlier run, then the lower id, so a re-run writes the same bytes.
export function rankBoards(rowSets) {
  const boards = {}
  for (const n of LENGTHS) {
    boards[n] = {}
    for (const m of BAT_MEASURES) {
      const rows = rowSets.map((r) => r[`${n}:${m.key}`]).filter(Boolean)
      rows.sort((a, b) => b.raw - a.raw || (a.first < b.first ? -1 : a.first > b.first ? 1 : a.id - b.id))
      boards[n][m.key] = rows.slice(0, TOP).map(({ raw, ...r }) => r)
    }
  }
  return boards
}

// players: [{ id, name, games }] -> the club's boards.
export const clubBoards = (players, teamId) => rankBoards(players.map((p) => playerRows(p, teamId)))

// ---- Ceilings from season lines (so only players who could still make a board are fetched).
// A season line: { season, gamesPlayed, homeRuns, hits, rbi, stolenBases, atBats, baseOnBalls,
// hitByPitch, sacFlies, sacBunts, totalBases }, one per season he played for the club.

// The most a run of n of his games could hold, summed over back-to-back club seasons it could
// touch: an inside season is whole, so a span stops once its inside seasons alone reach n games.
// Gaps between seasons are ignored, which only widens a span: a ceiling, never under the truth.
function spanSums(seasons, n) {
  const s = [...seasons].sort((a, b) => a.season - b.season)
  const spans = []
  for (let i = 0; i < s.length; i++) {
    const sum = {}
    let inside = 0
    for (let j = i; j < s.length; j++) {
      if (j > i + 1) inside += s[j - 1].gamesPlayed
      if (inside >= n) break
      for (const [k, v] of Object.entries(s[j])) if (k !== 'season') sum[k] = (sum[k] ?? 0) + v
      if (sum.gamesPlayed >= n) spans.push({ ...sum })
    }
  }
  return spans
}

const COUNT_FIELD = { hr: 'homeRuns', h: 'hits', rbi: 'rbi', sb: 'stolenBases' }

// The ceiling of his best n-game run by measure key, or null when no span reaches n games (or,
// for AVG and OPS, the plate appearances the floor asks). AB in a run is at least its PA less the
// span's walks, HBP, sac flies and bunts; a run's OBP denominator is at least its PA less bunts.
export function ceilingFor(seasons, n, key) {
  const need = Math.ceil(PA_PER_GAME * n)
  let best = null
  for (const t of spanSums(seasons, n)) {
    let v
    if (COUNT_FIELD[key]) v = t[COUNT_FIELD[key]]
    else {
      const pa = t.atBats + t.baseOnBalls + t.hitByPitch + t.sacFlies + t.sacBunts
      if (pa < need) continue
      const minAb = Math.max(1, need - t.baseOnBalls - t.hitByPitch - t.sacFlies - t.sacBunts)
      const avg = t.hits / minAb
      v = key === 'avg' ? avg : (t.hits + t.baseOnBalls + t.hitByPitch) / Math.max(1, need - t.sacBunts) + t.totalBases / minAb
    }
    if (best == null || v > best) best = v
  }
  return best
}

// Best-first: candidates [{ id, ceiling }] by ceiling, highest first; `exact(id)` gives his real
// row (or null). Stops once the next ceiling is under the TOP-th real value, so the board is the
// same as fetching everyone. Returns the ranked rows.
export async function bestFirst(candidates, exact) {
  const order = candidates.filter((c) => c.ceiling != null).sort((a, b) => b.ceiling - a.ceiling || a.id - b.id)
  const rows = []
  for (const c of order) {
    if (rows.length >= TOP && c.ceiling < rows[TOP - 1].raw) break
    const r = await exact(c.id)
    if (r) {
      rows.push(r)
      rows.sort((a, b) => b.raw - a.raw || (a.first < b.first ? -1 : a.first > b.first ? 1 : a.id - b.id))
    }
  }
  return rows.slice(0, TOP)
}
