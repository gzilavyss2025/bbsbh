// XWOBA (EST.) — the per-season lookup on exit velocity and launch angle
// (#1411 Part C, ADR-0097). gen-xwoba-table.mjs builds the table from Savant's
// balls in play; the hitter grid (hitter-grid.mjs) reads it for each ball in
// play of a game of the same season. Never a table from another season: a
// 2025 table fails on 2026 (the Part C spike, ADR-0097).
//
// The estimator is the spike's best: a nearest-neighbour box. Each cell of a
// 1 mph x 1 degree lattice takes the mean of Savant's estimate over the
// smallest box around it (one step = 1 mph and 1 degree each way) that holds
// K balls. The lattice is stored dense, in thousandths, so a lookup is one
// index. Pure, apart from readXwobaTable.
// ponytail: no sprint-speed term. It halves the board-level error for ground
// balls, but needs one more Savant request (ADR-0097, follow-up).
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { flatRates, hitterCounters } from '../../../src/api/scout/hitterGrid.js'
import { clamp } from '../../../src/lib/math/number.js'
import { num } from '../savant.mjs'

const EV_MAX = 125
const LA_MIN = -90
const LA_MAX = 90
const NE = EV_MAX + 1
const NL = LA_MAX - LA_MIN + 1
const K = 3

const ci = (ev) => clamp(Math.round(ev), 0, EV_MAX)
const cj = (la) => clamp(Math.round(la), LA_MIN, LA_MAX) - LA_MIN

// Savant detail CSV rows -> [[exitVelocity, launchAngle, estimate], ...], the estimate
// read from `col` (estimated_woba_ or estimated_ba_using_speedangle), balls in play only.
export const ballsOf = (rows, col) =>
  rows.flatMap((r) => {
    const ball = [num(r.launch_speed), num(r.launch_angle), num(r[col])]
    return r.description === 'hit_into_play' && ball.every((v) => v != null) ? [ball] : []
  })

// [[exitVelocity, launchAngle, estimate], ...] -> { rows }: NE x NL thousandths.
// Any estimate column fits: xwOBA (est.) and xBA (est.) share the lattice.
export function fitTable(balls) {
  if (balls.length < K) throw new Error(`a lookup table needs ${K} balls, got ${balls.length}`)
  // Integral images of the count and the sum, (NE + 1) x (NL + 1).
  const grid = () => Array.from({ length: NE + 1 }, () => new Float64Array(NL + 1))
  const C = grid()
  const S = grid()
  for (const [ev, la, y] of balls) {
    C[ci(ev) + 1][cj(la) + 1] += 1
    S[ci(ev) + 1][cj(la) + 1] += y
  }
  for (const M of [C, S]) {
    for (let i = 1; i <= NE; i++) for (let j = 1; j <= NL; j++) M[i][j] += M[i - 1][j] + M[i][j - 1] - M[i - 1][j - 1]
  }
  const box = (M, i0, i1, j0, j1) => M[i1 + 1][j1 + 1] - M[i0][j1 + 1] - M[i1 + 1][j0] + M[i0][j0]
  const rows = []
  for (let i = 0; i < NE; i++) {
    const row = []
    for (let j = 0; j < NL; j++) {
      for (let a = 0; ; a++) {
        const b = [Math.max(0, i - a), Math.min(NE - 1, i + a), Math.max(0, j - a), Math.min(NL - 1, j + a)]
        const n = Math.round(box(C, ...b))
        if (n >= K) {
          row.push(Math.round((1000 * box(S, ...b)) / n))
          break
        }
      }
    }
    rows.push(row)
  }
  return { rows }
}

export const xwobaOf = (table, ev, la) => table.rows[ci(ev)][cj(la)] / 1000

export const tablePath = (season, dir = 'xwoba-table') =>
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data', dir, `${season}.json`)

// The season's table (`dir`: 'xwoba-table' or 'xba-table'), or null when none is on
// file. Read once per season and dir.
const tables = new Map()
export function readXwobaTable(season, dir = 'xwoba-table') {
  const key = `${dir}/${season}`
  if (!tables.has(key)) {
    let table = null
    try {
      table = JSON.parse(readFileSync(tablePath(season, dir), 'utf8'))
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    tables.set(key, table)
  }
  return tables.get(key)
}

// --- the gate ---------------------------------------------------------------------
// Savant's pitch-arsenal-stats batter board against the hitter grid's own
// numbers, through the page's reader. The board is regular season only, and
// it folds KC and CS into CU. Each gap is grid minus board.
export const GATE = { minPa: 40, mean: 0.006, over: 0.02, share: 0.01, max: 0.04 }
const FOLD = { CU: ['CU', 'KC', 'CS'] }

// board: CSV rows { player_id, pitch_type, pa, est_woba }; shard: { xwoba, bat }.
export function gateRows(board, shard) {
  const gaps = []
  let missing = 0
  for (const r of board) {
    if (!(Number(r.pa) >= GATE.minPa)) continue
    const all = shard.bat?.[r.player_id]?.mlb ?? {}
    const mlb = Object.fromEntries((FOLD[r.pitch_type] ?? [r.pitch_type]).filter((c) => all[c]).map((c) => [c, all[c]]))
    const xwoba = flatRates(hitterCounters({ reg: { mlb }, xwoba: shard.xwoba }, { scope: 'R' }))?.xwoba
    if (xwoba != null) gaps.push(xwoba - Number(r.est_woba))
    else missing += 1
  }
  return { gaps, missing }
}

export function gateVerdict(gaps, gate = GATE) {
  const abs = gaps.map(Math.abs)
  const n = abs.length
  const mean = n ? abs.reduce((x, y) => x + y, 0) / n : null
  const over = abs.filter((g) => g > gate.over).length
  const max = n ? Math.max(...abs) : null
  const pass = n > 0 && mean <= gate.mean && over <= gate.share * n && max <= gate.max
  return { pass, n, mean, over, max }
}

// --- the xBA check (#1912) --------------------------------------------------------
// The xBA lattice against Savant's own estimate on the season's balls in play it was
// fitted on: each gap is lattice minus Savant. Measured 2026-10-13 on 123,275 balls: mean
// 0.0070, 1.7% above 0.05, max 0.445. The thresholds sit just above that. A per-ball gap is
// wider than the xwOBA gate's per-hitter gap: xBA is steep where line drives meet grounders.
export const XBA_GATE = { mean: 0.008, over: 0.05, share: 0.02, max: 0.5 }
export const xbaGaps = (table, balls) => balls.map(([ev, la, y]) => xwobaOf(table, ev, la) - y)
