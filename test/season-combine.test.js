// All seasons for one man (#1201): src/lib/seasons/combine.js adds his
// per-season shard slices. Each expected value below is added by hand from the
// two seasons beside it, so a rule change shows up as a number, not a shape.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  combineArsenalEntries,
  combineFoulBatter,
  combineFoulPitcher,
  combineFoulShards,
  combineSprayEntries,
  joinGameRows,
} from '../src/lib/seasons/combine.js'

test('every season missing gives null, never a row of zeros', () => {
  for (const combine of [combineSprayEntries, combineFoulBatter, combineFoulPitcher, combineArsenalEntries]) {
    assert.equal(combine([null, null]), null)
    assert.equal(combine([]), null)
  }
})

test('spray: the balls join, the per-hand counts add, the name is the latest', () => {
  const s2026 = { n: 'Old Name', t: 158, b: 'R', p: [[1, 2, 99, 4, 0, 0, 0, 7]], o: { R: [10, 3, 1, 1, 4], L: [5, 2, 0, 0, 1] } }
  const s2027 = { n: 'New Name', t: 121, b: 'R', p: [[3, 4, 88, 0, 1, 0, 0, 8]], o: { R: [20, 6, 2, 0, 9] } }
  assert.deepEqual(combineSprayEntries([s2026, s2027]), {
    n: 'New Name',
    t: 121,
    b: 'R',
    p: [
      [1, 2, 99, 4, 0, 0, 0, 7],
      [3, 4, 88, 0, 1, 0, 0, 8],
    ],
    o: { R: [30, 9, 3, 1, 13], L: [5, 2, 0, 0, 1] },
  })
})

test('spray: a 2027 rookie (no 2026 row) is his 2027 season alone', () => {
  const s2027 = { n: 'Rookie', t: 158, b: 'L', p: [], o: { R: [4, 1, 0, 0, 1], L: [1, 0, 0, 0, 0] } }
  assert.deepEqual(combineSprayEntries([null, s2027]), { ...s2027, p: [] })
})

const batter = (over) => ({
  name: 'B',
  teamId: 158,
  g: 0,
  pa: 0,
  pitchesSeen: 0,
  fouls: 0,
  twoStrikeFouls: 0,
  maxGameFouls: 0,
  maxGamePk: null,
  maxGamePa: null,
  maxGamePitches: null,
  maxGameOpponentId: null,
  maxGameHisScore: null,
  maxGameOppScore: null,
  maxGameDate: null,
  bestPa: null,
  ...over,
})

test('fouls batter: counts add, the high game keeps its own context', () => {
  const a = batter({ g: 100, pa: 400, pitchesSeen: 1600, fouls: 300, twoStrikeFouls: 120, maxGameFouls: 9, maxGamePk: 1, maxGameDate: '2026-05-01', maxGameOpponentId: 112, bestPa: { fouls: 8, gamePk: 1 } })
  const b = batter({ name: 'B2', teamId: 121, g: 50, pa: 200, pitchesSeen: 800, fouls: 140, twoStrikeFouls: 60, maxGameFouls: 11, maxGamePk: 2, maxGameDate: '2027-06-01', maxGameOpponentId: 143, bestPa: { fouls: 6, gamePk: 2 } })
  const out = combineFoulBatter([a, b])
  assert.equal(out.name, 'B2')
  assert.equal(out.teamId, 121)
  assert.deepEqual([out.g, out.pa, out.pitchesSeen, out.fouls, out.twoStrikeFouls], [150, 600, 2400, 440, 180])
  // 2027's 11-foul game beats 2026's 9, and its pk, date and opponent come with it.
  assert.deepEqual([out.maxGameFouls, out.maxGamePk, out.maxGameDate, out.maxGameOpponentId], [11, 2, '2027-06-01', 143])
  // The longest single PA is 2026's 8, not 2027's 6.
  assert.deepEqual(out.bestPa, { fouls: 8, gamePk: 1 })
})

test('fouls batter: a tie on the high game keeps the earlier season, as the generator does', () => {
  const out = combineFoulBatter([batter({ maxGameFouls: 7, maxGamePk: 1 }), batter({ maxGameFouls: 7, maxGamePk: 2 })])
  assert.equal(out.maxGamePk, 1)
})

test('fouls pitcher: counts add, and the seasons vote on isStarter with their games', () => {
  const starter = { name: 'P', teamId: 158, g: 30, pitches: 2800, fouls: 500, whiffs: 300, isStarter: true }
  const reliever = { name: 'P', teamId: 158, g: 10, pitches: 160, fouls: 30, whiffs: 20, isStarter: false }
  assert.deepEqual(combineFoulPitcher([starter, reliever]), {
    name: 'P',
    teamId: 158,
    g: 40,
    pitches: 2960,
    fouls: 530,
    whiffs: 320,
    isStarter: true,
  })
  // 30 relief games outvote 10 starts.
  assert.equal(combineFoulPitcher([{ ...starter, g: 10 }, { ...reliever, g: 30 }]).isStarter, false)
})

test('fouls pitcher: with starts on every season, isStarter is the all/ file\'s exact rule', () => {
  // 16 starts in 30 games, then 0 in 10: 16 of 40 is not a majority, though
  // the 30-game season alone was a starter's.
  const out = combineFoulPitcher([
    { name: 'P', g: 30, gs: 16, pitches: 0, fouls: 0, whiffs: 0, isStarter: true },
    { name: 'P', g: 10, gs: 0, pitches: 0, fouls: 0, whiffs: 0, isStarter: false },
  ])
  assert.equal(out.gs, 16)
  assert.equal(out.isStarter, false)
})

test('fouls shard: one man, both groups, the shape batterFoulLine reads', () => {
  const shards = [
    { batters: { 7: batter({ g: 2, fouls: 3 }) }, pitchers: {} },
    null,
    { batters: { 7: batter({ g: 1, fouls: 4 }), 8: batter({ g: 9 }) }, pitchers: {} },
  ]
  const out = combineFoulShards(shards, 7)
  assert.deepEqual(Object.keys(out.batters), ['7'])
  assert.equal(out.batters['7'].g, 3)
  assert.equal(out.batters['7'].fouls, 7)
  assert.deepEqual(out.pitchers, {})
})

test('arsenal: pitches add, velocity is pitch-weighted, max is the max', () => {
  const s2026 = {
    name: 'Arm',
    teamId: 158,
    throws: 'R',
    centuryRank: { mlb: { rank: 3, of: 40 } },
    mlb: [
      { code: 'FF', description: 'Four-Seam Fastball', pitches: 300, avgVelo: 95, century: 2, maxVelo: 100.1, tto: [[200, 95.5], [100, 94]], vs: { L: [100, 95, [[60, 95], [40, 95]]], R: [200, 95] } },
      { code: 'SL', description: 'Slider', pitches: 100, avgVelo: 85, century: 0, maxVelo: 87 },
    ],
    aaa: [],
  }
  const s2027 = {
    name: 'Arm',
    teamId: 121,
    throws: 'R',
    mlb: [{ code: 'FF', description: 'Four-Seam Fastball', pitches: 100, avgVelo: 97, century: 5, maxVelo: 101.4, tto: [[100, 97]], vs: { L: [100, 97, [[100, 97]]] } }],
    aaa: [{ code: 'CH', description: 'Changeup', pitches: 20, avgVelo: 88, century: 0, maxVelo: 89 }],
  }
  const out = combineArsenalEntries([s2026, s2027])
  assert.equal(out.teamId, 121)
  // A place in one season's league does not carry into a sum of seasons.
  assert.equal(out.centuryRank, undefined)
  const ff = out.mlb[0]
  assert.equal(ff.code, 'FF')
  assert.equal(ff.pitches, 400)
  // (300 × 95 + 100 × 97) / 400 = 95.5, not (95 + 97) / 2 = 96.
  assert.equal(ff.avgVelo, 95.5)
  assert.equal(ff.century, 7)
  assert.equal(ff.maxVelo, 101.4)
  // Slot 1: (200 × 95.5 + 100 × 97) / 300 = 96; slot 2 only 2026 had.
  assert.deepEqual(ff.tto, [[300, 96], [100, 94]])
  assert.deepEqual(ff.vs.L, [200, 96, [[160, 96.3], [40, 95]]])
  assert.deepEqual(ff.vs.R, [200, 95])
  // Sorted by pitches, as the generator writes them.
  assert.deepEqual(out.mlb.map((t) => t.code), ['FF', 'SL'])
  assert.deepEqual(out.aaa.map((t) => [t.code, t.pitches]), [['CH', 20]])
})

test('arsenal: a slot with no velocity reading is weighted out, not read as zero', () => {
  const out = combineArsenalEntries([
    { name: 'A', mlb: [{ code: 'SL', pitches: 1, avgVelo: 84, tto: [[0, null], [1, 84]] }], aaa: [] },
    { name: 'A', mlb: [{ code: 'SL', pitches: 3, avgVelo: 80, tto: [[3, 80]] }], aaa: [] },
  ])
  assert.deepEqual(out.mlb[0].tto, [[3, 80], [1, 84]])
  assert.equal(out.mlb[0].avgVelo, 81)
})

test('umpire game rows join newest first, and a season with no file adds nothing', () => {
  const out = joinGameRows([
    [{ gamePk: 2, date: '2026-09-01' }, { gamePk: 1, date: '2026-04-01' }],
    null,
    [{ gamePk: 3, date: '2027-04-02' }],
  ])
  assert.deepEqual(out.map((g) => g.gamePk), [3, 2, 1])
})
