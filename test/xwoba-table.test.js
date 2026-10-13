// The xwOBA (est.) lookup (#1411 Part C, ADR-0097): a per-season table on exit
// velocity and launch angle, and the gate that holds it to Savant's board.
import assert from 'node:assert/strict'
import test from 'node:test'
import { XBA_GATE, ballsOf, fitTable, gateRows, gateVerdict, tablePath, xbaGaps, xwobaOf } from '../scripts/lib/pitch/xwoba.mjs'

const three = (ev, la, ...ys) => ys.map((y) => [ev, la, y])

test('a lattice cell that holds k balls takes their mean, in thousandths', () => {
  const t = fitTable(three(100, 20, 0.5, 0.6, 0.7001))
  assert.equal(xwobaOf(t, 100, 20), 0.6)
  // 1 mph x 1 degree cells: a ball rounds to its nearest cell.
  assert.equal(xwobaOf(t, 100.4, 19.6), 0.6)
})

test('a thin cell grows its box one step each way until it holds k balls', () => {
  const t = fitTable([[100, 20, 0.9], [101, 20, 0.3], [99, 21, 0.6], [102, 20, 0]])
  // One step (99-101 mph, 19-21 degrees) holds three balls; the ball at 102 mph is outside.
  assert.equal(xwobaOf(t, 100, 20), 0.6)
  // Far from every ball the box grows until it holds three.
  assert.ok(xwobaOf(t, 40, -60) >= 0 && xwobaOf(t, 40, -60) <= 0.9)
})

test('a value outside the lattice reads its edge', () => {
  const t = fitTable([...three(125, 90, 0.1, 0.1, 0.1), ...three(0, -90, 0.8, 0.8, 0.8)])
  assert.equal(xwobaOf(t, 131.2, 95), 0.1)
  assert.equal(xwobaOf(t, -3, -120), 0.8)
})

test('a table needs at least k balls', () => {
  assert.throws(() => fitTable([[100, 20, 0.5]]))
})

// --- the gate ---------------------------------------------------------------------
const z = (i, n) => Array.from({ length: 25 }, (_, j) => (j === i ? n : 0))
// One hitter's regular-season entry: `pa` PA ends in cell 0, `fixed` the walks'
// 0.7s, `bip` the summed estimate on balls in play.
const counters = (pa, fixed, bip) => ({ pitches: z(0, pa), paEnd: z(0, pa), wobaFixed: z(0, fixed), xwobaBip: z(0, bip) })
const shard = {
  xwoba: true,
  bat: {
    1: { mlb: { FF: { R: { R: counters(40, 7, 10) } }, KC: { R: { R: counters(30, 0, 9) } }, CU: { L: { R: counters(20, 0, 6) } } } },
    2: { mlb: { SL: { R: { L: counters(50, 0, 15) } } } },
  },
}
const row = (player_id, pitch_type, pa, est_woba) => ({ player_id: String(player_id), pitch_type, pa: String(pa), est_woba: String(est_woba) })

test('the gate compares each board row of 40 or more PA with the grid, with KC and CS folded into CU', () => {
  const { gaps, missing } = gateRows([
    row(1, 'FF', 40, 0.42),
    // The board's CU row is CU + KC + CS: (9 + 6) / (30 + 20) = 0.3.
    row(1, 'CU', 50, 0.31),
    row(2, 'SL', 39, 0.3),
    row(3, 'FF', 60, 0.3),
  ], shard)
  assert.equal(gaps.length, 2)
  assert.ok(Math.abs(gaps[0] - (17 / 40 - 0.42)) < 1e-9)
  assert.ok(Math.abs(gaps[1] - (0.3 - 0.31)) < 1e-9)
  assert.equal(missing, 1)
})

test('the gate has no rows to compare when the season has no xwOBA on file', () => {
  const { gaps, missing } = gateRows([row(1, 'FF', 40, 0.42)], { ...shard, xwoba: undefined })
  assert.deepEqual(gaps, [])
  assert.equal(missing, 1)
})

test('the gate: mean gap at most 0.006, at most 1% of rows above 0.020, no row above 0.040', () => {
  const ok = Array.from({ length: 100 }, (_, i) => (i % 2 ? 0.004 : -0.004))
  assert.equal(gateVerdict(ok).pass, true)
  assert.equal(gateVerdict(ok.map(() => 0.0061)).pass, false)
  // One row in 100 above 0.020 passes; two fail.
  assert.equal(gateVerdict([0.03, ...ok.slice(1)]).pass, true)
  assert.equal(gateVerdict([0.03, -0.03, ...ok.slice(2)]).pass, false)
  assert.equal(gateVerdict([0.041, ...ok.slice(1)]).pass, false)
  // A gate over nothing is no pass.
  assert.equal(gateVerdict([]).pass, false)
})

// --- the xBA lattice (#1912): the same fit on Savant's estimated_ba_using_speedangle ---
const csv = (description, launch_speed, launch_angle, woba, ba) =>
  ({ description, launch_speed, launch_angle, estimated_woba_using_speedangle: woba, estimated_ba_using_speedangle: ba })

test('ballsOf reads one estimate column off the balls in play that have all three values', () => {
  const rows = [csv('hit_into_play', '108.4', '22', '1.9', '0.911'), csv('hit_into_play', '106.3', '2', '', '0.52'),
    csv('foul', '90', '10', '0.2', '0.2'), csv('hit_into_play', '', '5', '0.1', '0.1')]
  assert.deepEqual(ballsOf(rows, 'estimated_ba_using_speedangle'), [[108.4, 22, 0.911], [106.3, 2, 0.52]])
  assert.deepEqual(ballsOf(rows, 'estimated_woba_using_speedangle'), [[108.4, 22, 1.9]])
})

test('each table has its own folder', () => {
  assert.match(tablePath(2026), /xwoba-table[\\/]2026\.json$/)
  assert.match(tablePath(2026, 'xba-table'), /xba-table[\\/]2026\.json$/)
})

test('the xBA check: a lookup per ball, minus Savant, against its own thresholds', () => {
  const balls = [...three(108, 22, 0.905, 0.91, 0.915), ...three(106, 2, 0.515, 0.52, 0.525)]
  const t = fitTable(balls)
  const gaps = xbaGaps(t, balls)
  assert.equal(gaps.length, 6)
  assert.ok(Math.abs(gaps[0] - (0.91 - 0.905)) < 1e-9)
  assert.equal(gateVerdict(gaps, XBA_GATE).pass, true)
  assert.equal(gateVerdict(gaps.map(() => 0.5), XBA_GATE).pass, false)
})
