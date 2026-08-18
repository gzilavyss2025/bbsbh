// The Farm Index (src/api/around-the-game/farmSystem.js) and the join that feeds it
// (scripts/gen-farm-system.mjs).
//
// A composite ranking is the easiest kind of number to ship wrong, because a
// wrong one still produces thirty plausible rows in a plausible order. So the
// assertions here are about the CLAIMS the page makes in words — that the
// value curve is steep enough for one elite name to beat six fringe ones, that
// an affiliate with no games on file is not scored as if it lost them all,
// that the weights actually change the order — rather than about arithmetic
// nobody would notice being off by a decimal.
import test from 'node:test'
import assert from 'node:assert/strict'
import { recordsFromStandings, orgRow } from '../scripts/gen-farm-system.mjs'
import {
  rankValue,
  capitalOf,
  productionOf,
  youthOf,
  scaleTo100,
  farmBoard,
  correlate,
  LEVEL_WEIGHTS,
  PILLARS,
  WEIGHT_PRESETS,
} from '../src/api/around-the-game/farmSystem.js'

// ---- the generator's join ----

test('recordsFromStandings flattens every division into one teamId map', () => {
  const byTeamId = recordsFromStandings({
    records: [
      { teamRecords: [{ team: { id: 556 }, wins: 65, losses: 55 }] },
      { teamRecords: [{ team: { id: 572 }, wins: 60, losses: 49 }] },
    ],
  })
  assert.deepEqual(byTeamId[556], { w: 65, l: 55 })
  assert.deepEqual(byTeamId[572], { w: 60, l: 49 })
})

// `?sportId=11` returns `records: []` — an empty SUCCESS, which is the shape
// that would have shipped a page of blank records with nothing failing.
test('recordsFromStandings returns an empty map rather than throwing on no records', () => {
  assert.deepEqual(recordsFromStandings({ records: [] }), {})
  assert.deepEqual(recordsFromStandings(null), {})
})

test('orgRow keeps only the four full-season levels, in ladder order', () => {
  const row = orgRow(
    [
      { id: 3, name: 'Complex Club', sportId: 16 },
      { id: 2, name: 'A Club', sportId: 14 },
      { id: 1, name: 'AAA Club', sportId: 11 },
    ],
    { 11: { 1: { w: 70, l: 50 } }, 14: {} },
    [{ rank: 40, playerId: 9, name: 'B', levelRaw: 'AA', age: 21 }],
  )
  assert.deepEqual(
    row.affiliates.map((a) => a.level),
    ['AAA', 'A'],
  )
  assert.equal(row.affiliates[0].w, 70)
  // A club with no row in the standings keeps null counts, never zeros.
  assert.equal(row.affiliates[1].w, null)
})

test('orgRow orders prospects best rank first', () => {
  const row = orgRow(
    [],
    {},
    [
      { rank: 88, playerId: 2, name: 'Second' },
      { rank: 1, playerId: 1, name: 'First' },
    ],
  )
  assert.deepEqual(
    row.prospects.map((p) => p.rank),
    [1, 88],
  )
})

// ---- the value curve ----

test('the value curve is steep enough that one elite name beats a pile of fringe ones', () => {
  assert.equal(Math.round(rankValue(1)), 100)
  assert.equal(Math.round(rankValue(100)), 8)
  // The page says the No. 1 prospect is worth roughly twelve No. 100s. If a
  // future tuning breaks that sentence, this fails and the sentence gets
  // rewritten with it.
  assert.ok(rankValue(1) / rankValue(100) > 11)
  assert.ok(rankValue(1) > rankValue(90) * 6)
})

test('an unranked or nonsense rank is worth nothing rather than a little', () => {
  assert.equal(rankValue(null), 0)
  assert.equal(rankValue(0), 0)
  assert.equal(rankValue(undefined), 0)
})

test('capital is the summed curve over every ranked name held', () => {
  const org = { prospects: [{ rank: 1 }, { rank: 50 }] }
  assert.equal(capitalOf(org), rankValue(1) + rankValue(50))
  assert.equal(capitalOf({ prospects: [] }), 0)
})

// ---- winning ----

test('the winning pillar weights the ladder rather than averaging it', () => {
  // A club that wins at Triple-A and loses at Single-A must outscore its
  // mirror image, or the proximity weighting is doing nothing.
  const topHeavy = productionOf({
    affiliates: [
      { sportId: 11, w: 80, l: 40 },
      { sportId: 14, w: 40, l: 80 },
    ],
  })
  const bottomHeavy = productionOf({
    affiliates: [
      { sportId: 11, w: 40, l: 80 },
      { sportId: 14, w: 80, l: 40 },
    ],
  })
  assert.ok(topHeavy > bottomHeavy)
  assert.ok(LEVEL_WEIGHTS[11] > LEVEL_WEIGHTS[14])
})

// The trap this guards: an affiliate with no games on file must not be folded
// in as a .000 club, which would sink an organisation for a missing file.
test('a level with no games played is renormalised out, not scored as .000', () => {
  const played = productionOf({
    affiliates: [
      { sportId: 11, w: 60, l: 40 },
      { sportId: 14, w: null, l: null },
    ],
  })
  assert.equal(played, 0.6)
})

test('an organisation with nothing played has no winning score at all', () => {
  assert.equal(productionOf({ affiliates: [{ sportId: 11, w: 0, l: 0 }] }), null)
  assert.equal(productionOf({ affiliates: [] }), null)
})

// ---- youth ----

test('youth is weighted by each name’s own value, not counted flat', () => {
  // A 19-year-old at No. 1 beside a 25-year-old at No. 95 must read young,
  // because the 19-year-old is nearly all of the system's value.
  const young = youthOf({
    prospects: [
      { rank: 1, age: 19 },
      { rank: 95, age: 25 },
    ],
  })
  const flat = (19 + 25) / 2
  assert.ok(young > 50 + (21 - flat) * 12)
})

test('youth is null for an organisation with no age on file', () => {
  assert.equal(youthOf({ prospects: [] }), null)
  assert.equal(youthOf({ prospects: [{ rank: 3, age: null }] }), null)
})

// ---- scaling ----

test('scaling puts the league’s worst at 0 and its best at 100', () => {
  assert.deepEqual(scaleTo100([10, 20, 30]), [0, 50, 100])
})

test('an unmeasurable organisation lands at the midpoint, not at zero', () => {
  assert.deepEqual(scaleTo100([10, null, 30]), [0, 50, 100])
})

test('a league with no spread at all is flat, not thirty perfect scores', () => {
  assert.deepEqual(scaleTo100([7, 7, 7]), [50, 50, 50])
})

// ---- the board ----

const data = {
  season: 2026,
  orgs: {
    // Elite talent, losing affiliates.
    1: {
      affiliates: [
        { id: 11, name: 'A', sportId: 11, level: 'AAA', w: 40, l: 80 },
        { id: 12, name: 'B', sportId: 12, level: 'AA', w: 40, l: 80 },
      ],
      prospects: [
        { rank: 1, playerId: 1, name: 'Best', age: 19 },
        { rank: 4, playerId: 2, name: 'Also', age: 20 },
      ],
    },
    // No ranked talent, winning affiliates.
    2: {
      affiliates: [
        { id: 21, name: 'C', sportId: 11, level: 'AAA', w: 85, l: 35 },
        { id: 22, name: 'D', sportId: 12, level: 'AA', w: 80, l: 40 },
      ],
      prospects: [],
    },
    // Middling both ways.
    3: {
      affiliates: [
        { id: 31, name: 'E', sportId: 11, level: 'AAA', w: 60, l: 60 },
        { id: 32, name: 'F', sportId: 12, level: 'AA', w: 60, l: 60 },
      ],
      prospects: [{ rank: 60, playerId: 3, name: 'Mid', age: 23 }],
    },
  },
}

test('the balanced board is led by talent, and the scoreboard board is not', () => {
  const balanced = farmBoard(data, WEIGHT_PRESETS[0].weights)
  const scoreboard = farmBoard(data, WEIGHT_PRESETS.find((p) => p.key === 'scoreboard').weights)
  assert.equal(balanced[0].orgId, 1)
  assert.equal(scoreboard[0].orgId, 2)
})

// The page's whole editorial argument is that the order is a choice. If the
// weights stopped moving it, that argument would be a lie the page still made.
test('changing the weights reorders the league', () => {
  const a = farmBoard(data, { capital: 1, production: 0, youth: 0 }).map((r) => r.orgId)
  const b = farmBoard(data, { capital: 0, production: 1, youth: 0 }).map((r) => r.orgId)
  assert.notDeepEqual(a, b)
})

test('the weights are normalised, so their scale does not matter', () => {
  const small = farmBoard(data, { capital: 0.6, production: 0.25, youth: 0.15 })
  const large = farmBoard(data, { capital: 60, production: 25, youth: 15 })
  assert.deepEqual(
    small.map((r) => r.index),
    large.map((r) => r.index),
  )
})

test('every row carries its combined system record beside the scored pillar', () => {
  const board = farmBoard(data)
  const org2 = board.find((r) => r.orgId === 2)
  assert.deepEqual(org2.record, { w: 165, l: 75 })
  assert.equal(org2.pct, 165 / 240)
})

test('an organisation with no ranked name reports no top rank rather than a zero', () => {
  const board = farmBoard(data)
  assert.equal(board.find((r) => r.orgId === 2).topRank, null)
  assert.equal(board.find((r) => r.orgId === 1).topRank, 1)
})

test('the pillar weights the page prints add up to the whole index', () => {
  const total = PILLARS.reduce((s, p) => s + p.weight, 0)
  assert.equal(Math.round(total * 100), 100)
})

test('correlate returns a coefficient and its square, or null on too few rows', () => {
  const board = farmBoard(data)
  const r = correlate(board)
  assert.ok(r.r >= -1 && r.r <= 1)
  assert.ok(Math.abs(r.r2 - r.r * r.r) < 0.002)
  assert.equal(correlate([{ pillars: { capital: 1, production: 2 } }]), null)
})

test('farmBoard returns null rather than an empty board with no data', () => {
  assert.equal(farmBoard({ orgs: {} }), null)
  assert.equal(farmBoard(null), null)
})
