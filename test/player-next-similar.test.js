// The Similar players module's pure view (src/screens/player/next/modules/similar/similarView.js, #1926).
import test from 'node:test'
import assert from 'node:assert/strict'
import { hitterModel, pitcherModel, pitcherPos, initials, poolLevels } from '../src/screens/player/next/modules/similar/similarView.js'

// Brice Turang's five dots, from savant-percentiles.json.
const bat = {
  668930: { ev: 71, hardHit: 54, brl: 48, chase: 80, sprintSpeed: 81 },
  690993: { ev: 42, hardHit: 58, brl: 47, chase: 81, sprintSpeed: 70 },
  805999: { ev: 56, hardHit: 59, brl: 46, chase: 69 },
}
const hitters = [
  { personId: 690993, name: 'Colt Keith', pos: '3B', teamId: 116, match: 77 },
  { personId: 805999, name: 'A.J. Ewing', pos: 'CF', teamId: 121, match: 77 },
]

test('a batter gets one Season profile section: five metrics, percentile dots on 0 to 100', () => {
  const [keith, ewing] = hitterModel({ bat }, 668930, hitters).comps
  assert.deepEqual(keith.sections.map((s) => s.key), ['profile'])
  const lines = keith.sections[0].lines
  assert.deepEqual(lines.map((l) => l.metric), ['Exit velo', 'Hard-hit %', 'Barrel %', 'Chase %', 'Sprint speed'])
  assert.deepEqual(lines.map((l) => l.mePos), [71, 54, 48, 80, 81])
  assert.deepEqual(lines.map((l) => l.themPos), [42, 58, 47, 81, 70])
  assert.deepEqual(lines.map((l) => l.meText), ['71', '54', '48', '80', '81'])
  assert.equal(keith.ini, 'CK')
  assert.equal(ewing.ini, 'AE')
})

test('a metric the neighbour lacks has no dot and reads a dash', () => {
  const sprint = hitterModel({ bat }, 668930, hitters).comps[1].sections[0].lines[4]
  assert.equal(sprint.themPos, null)
  assert.equal(sprint.themText, '—')
  assert.equal(sprint.mePos, 81)
})

// Robert Gasser (sweeper, four-seam, sinker, cutter, changeup, a few sliders) and one neighbour.
const arm = (...t) => t.map(([code, pitches, avgVelo]) => ({ code, pitches, avgVelo }))
const pool = {
  pit: {
    688107: { types: arm(['ST', 459, 80.4], ['FF', 425, 92.9], ['SI', 408, 92.7], ['FC', 333, 88.4], ['CH', 187, 88.3], ['SL', 3, 84.5]) },
    669713: { types: arm(['ST', 265, 81.5], ['FF', 217, 93.5], ['SI', 170, 92.6], ['FC', 136, 89.5], ['CH', 108, 86.3], ['CU', 2, 72.7]) },
    676510: { types: arm(['FC', 60, 88.4], ['FF', 58, 93.2], ['SI', 56, 92.8], ['ST', 24, 80.6]) },
  },
}
const arms = [
  { personId: 669713, name: 'Hayden Wesneski', teamId: 117, throws: 'R', match: 92 },
  { personId: 676510, name: 'Nolan Hoffman', teamId: 118, throws: 'R', match: 88 },
]

test('a pitcher gets Usage and Velocity: his five most-thrown pitches, shares of all his pitches', () => {
  const [wes] = pitcherModel(pool, 688107, arms).comps
  assert.deepEqual(wes.sections.map((s) => s.key), ['usage', 'velocity'])
  const usage = wes.sections[0].lines
  assert.deepEqual(usage.map((l) => l.metric), ['Sweeper', 'Fastball', 'Sinker', 'Cutter', 'Changeup'])
  assert.equal(usage[0].meText, '25.3%') // 459 of 1815
  assert.equal(usage[0].themText, '29.5%') // 265 of 898
  assert.ok(Math.abs(usage[0].mePos - (459 / 1815) * 100 * (100 / 35)) < 1e-9) // the rail runs 0 to 35%
})

test('velocity is average mph on a range padded two mph each side, ticked every five; a missing pitch has no dot', () => {
  const [, hoff] = pitcherModel(pool, 688107, arms).comps
  const vel = hoff.sections[1]
  assert.deepEqual(vel.lines.map((l) => l.meText), ['80.4', '92.9', '92.7', '88.4', '88.3'])
  const change = vel.lines[4]
  assert.equal(change.themText, '—')
  assert.equal(change.themPos, null)
  assert.deepEqual(vel.ticks.map((t) => t.text), ['80', '85', '90', '95'])
  assert.ok(vel.ticks.every((t) => t.at >= 0 && t.at <= 100))
  assert.ok(vel.lines.every((l) => l.mePos > 0 && l.mePos < 100))
})

test('a pitch the neighbour does not throw sits at 0% usage, on the rail', () => {
  const change = pitcherModel(pool, 688107, arms).comps[1].sections[0].lines[4]
  assert.equal(change.themText, '0.0%')
  assert.equal(change.themPos, 0)
})

test('the axes stay put across neighbours, so a dot keeps its place when you switch', () => {
  const [a, b] = pitcherModel(pool, 688107, arms).comps
  assert.deepEqual(a.sections[1].ticks, b.sections[1].ticks)
})

test('the position line: hand for a pitcher, bare P when the hand is unknown; initials drop a suffix', () => {
  assert.equal(pitcherPos('R'), 'RHP')
  assert.equal(pitcherPos('L'), 'LHP')
  assert.equal(pitcherPos(null), 'P')
  assert.equal(initials('Jazz Chisholm Jr.'), 'JC')
})

// Which pools to try, in order (api/player/context.js resolveCurrentSeasonStat is the live rule). A free
// agent has no club and a rehabber is pinned to MLB: both are sportId 1. A player who has debuted and is
// at a minor-league club may still have MLB games this season, so MLB comes first and he is ranked there
// when he is in that pool. A player who never debuted can only be in the minor-league pool.
test('pool order: MLB alone at MLB or with no level; MLB then AAA for a debuted minor leaguer; AAA alone for a prospect', () => {
  assert.deepEqual(poolLevels(1, true), [true])
  assert.deepEqual(poolLevels(null, false), [true])
  assert.deepEqual(poolLevels(12, true), [true, false])
  assert.deepEqual(poolLevels(11, false), [false])
})
