import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { arsenalView } from '../src/screens/player/next/modules/arsenal/arsenalView.js'
import {
  ZD,
  flightPath,
  lineD,
  makeCamera,
  markFeet,
  project,
  sparkD,
  tunnelView,
  verdictOf,
} from '../src/screens/player/next/modules/arsenal/flightView.js'
import { pitchMark } from '../src/lib/pitch/pitchTypes.js'

// The Pitch arsenal module's pure views (#1892): the arsenal rows and the flight path from release,
// movement and flight time. Samples are built, except the last test, which reads the committed store.

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not within ${eps} of ${b}`)
// phys order: x0, z0, pfxX, pfxZ, extension, plateTime, spinRate
const FF = { code: 'FF', description: 'Four-Seam Fastball', pitches: 400, avgVelo: 93, phys: [2.5, 5.1, 5.2, 8.1, 6.9, 0.41, 2233] }
const CH = { code: 'CH', description: 'Changeup', pitches: 100, avgVelo: 88, phys: [2.5, 4.9, 10.5, 0.4, 6.9, 0.43, 1973] }
const SL = { code: 'SL', description: 'Slider', pitches: 20, avgVelo: 84 } // no physics: too few carried them
const shard = (types, mlb = true) => ({ pit: { 7: { [mlb ? 'mlb' : 'aaa']: types } } })
// A pitch-command entry: 25 cells per hand. All FF in the middle cell; the changeup low and away.
const cells = (at) => Object.assign(new Array(25).fill(0), at)
const grid = (c, over = {}) => ({ cells: c, swings: cells({}), whiffs: cells({}), calledStrikes: cells({}), homers: cells({}), firstPitch: cells({}), ...over })
const command = {
  mlb: {
    FF: { R: grid(cells({ 12: 60 }), { swings: cells({ 12: 40 }), whiffs: cells({ 12: 10 }) }) },
    CH: { R: grid(cells({ 22: 50 }), { swings: cells({ 22: 20 }), whiffs: cells({ 22: 10 }) }) },
  },
}

test('markFeet maps a grid cell to feet in the feed frame: the middle cell is the middle of the zone', () => {
  const m = markFeet({ col: 2, row: 2 })
  close(m.x, 0)
  close(m.h, (1.63 + 3.22) / 2)
  // Column 1 is the third-base side (negative x, the catcher's left); row 0 is the ring above the zone.
  close(markFeet({ col: 1, row: 2 }).x, -0.472, 1e-3)
  assert.ok(markFeet({ col: 2, row: 0 }).h > 3.22)
  assert.equal(markFeet(null), null)
})

// The feed's pfxX and pfxZ are PITCHf/x values: the break over the last 40 ft only. A flight from this release
// is (52.18 / 40)^2 = 1.7019 times that, since the break grows as the square of the time. Hand-computed.
const K = ((60.5 - 6.9 - 1.417) / 40) ** 2

test('flightPath starts at release, ends on the landing mark, and bends by the full-flight movement', () => {
  const p = flightPath({ x0: 2.5, z0: 5.1, pfxX: 5.2, pfxZ: 8.1, extension: 6.9, plateTime: 0.41 }, { x: 0.1, h: 2.5 })
  assert.equal(p.T, 0.41)
  close(p.at(0)[0], 2.5)
  close(p.at(0)[1], 5.1)
  close(p.at(0)[2], 60.5 - 6.9)
  const end = p.at(p.T)
  close(end[0], 0.1)
  close(end[1], 2.5)
  close(end[2], 1.417)
  // The gravity-only path ends where the movement did not take it: lift and side are the movement over the whole flight.
  const g = p.grav(p.T)
  close((end[1] - g[1]) * 12, 8.1 * K)
  close((end[0] - g[0]) * 12, 5.2 * K)
  close(p.lift, 8.1 * K)
  close(p.side, 5.2 * K)
  close(p.lift, 13.79, 0.01)
  close(p.fall, 0.5 * 32.174 * 0.41 * 0.41 * 12)
  // Time past the end holds the landing point.
  assert.deepEqual(p.at(9), end)
})

test('flightPath lift matches Statcast induced break on the four-seamers of gamePk 823035 (within 1 in)', () => {
  // pfxZ over the last 40 ft, against breakVerticalInduced over the flight.
  const base = { x0: -1.5, z0: 6, pfxX: 0, extension: 6.9, plateTime: 0.394 }
  for (const [pfxZ, ivb] of [[7.9, 13.6], [8.5, 14.5], [7.4, 12.6], [9.4, 16.0]]) {
    close(flightPath({ ...base, pfxZ }, { x: 0, h: 2.5 }).lift, ivb, 1)
  }
})

test('flightPath flies toward the plate at every step', () => {
  const p = flightPath({ x0: -2, z0: 6, pfxX: -7, pfxZ: 14, extension: 6, plateTime: 0.4 }, { x: 0, h: 2.4 })
  let z = Infinity
  for (let i = 0; i <= 20; i++) {
    const next = p.at((p.T * i) / 20)[2]
    assert.ok(next < z)
    z = next
  }
})

test('flightPath is null when a flight input or the landing mark is missing', () => {
  const full = { x0: 2.5, z0: 5.1, pfxX: 5.2, pfxZ: 8.1, extension: 6.9, plateTime: 0.41 }
  for (const k of Object.keys(full)) assert.equal(flightPath({ ...full, [k]: null }, { x: 0, h: 2.4 }), null, k)
  assert.equal(flightPath(null, { x: 0, h: 2.4 }), null)
  assert.equal(flightPath(full, null), null)
})

test('verdictOf reads the full-flight lift and side break, by the pitcher\'s arm', () => {
  assert.equal(verdictOf({ lift: 20, side: 1 }, 'L'), 'Rides high; barely moves sideways.')
  assert.equal(verdictOf({ lift: 14, side: 8 }, 'L'), 'Falls a little less than gravity alone; moves 8 in toward his arm side.')
  assert.equal(verdictOf({ lift: 14, side: 8 }, 'R'), 'Falls a little less than gravity alone; moves 8 in toward his glove side.')
  assert.equal(verdictOf({ lift: 2, side: -13 }, 'L'), 'Falls about as fast as gravity alone; moves 13 in toward his glove side.')
  assert.equal(verdictOf({ lift: -15, side: 1 }, 'R'), 'Drops more than gravity alone; barely moves sideways.')
  // No hand on file: the side is named by the base, not the arm.
  assert.match(verdictOf({ lift: 1, side: 10 }, ''), /toward the first-base side/)
  assert.match(verdictOf({ lift: 1, side: -10 }, ''), /toward the third-base side/)
})

test('tunnelView measures how far apart the paths are at release, 23.8 ft out and at the plate', () => {
  const base = { x0: 2.5, z0: 5, extension: 6.9, plateTime: 0.41 }
  const a = flightPath({ ...base, pfxX: 0, pfxZ: 10 }, { x: 0, h: 2.4 })
  const b = flightPath({ ...base, pfxX: 0, pfxZ: 10 }, { x: 0.5, h: 2.4 })
  const c = flightPath({ ...base, pfxX: 0, pfxZ: 10 }, { x: -1, h: 1.2 })
  const t = tunnelView([
    { code: 'FF', path: a },
    { code: 'SI', path: b },
    { code: 'CH', path: c },
  ])
  close(t.release, 0)
  assert.ok(t.out > 0 && t.out < t.plate)
  assert.equal(t.closest.names, 'FF · SI')
  assert.equal(t.widest.names, 'SI · CH')
  assert.ok(t.closest.out <= t.widest.out)
  // The 23.8 ft gate sits between release and the plate, in distance from the plate.
  close(a.at(a.tD)[2], ZD)
  assert.equal(tunnelView([{ code: 'FF', path: a }]), null)
})

test('sparkD keeps the drop curve inside the 28 px sparkline, even for a big arch', () => {
  const ys = (path) => [...sparkD(path).matchAll(/[ML][\d.]+ ([\d.-]+)/g)].map((m) => Number(m[1]))
  const big = flightPath({ x0: 0, z0: 6, pfxX: 0, pfxZ: -30, extension: 6, plateTime: 0.55 }, { x: 0, h: 1.2 })
  for (const y of ys(big)) assert.ok(y >= 0 && y <= 28, `y ${y} is inside the box`)
  // A small arch is drawn at one pixel an inch, centred on the line at 14.
  const small = flightPath({ x0: 0, z0: 6, pfxX: 0, pfxZ: 8, extension: 6.9, plateTime: 0.4 }, { x: 0, h: 2.4 })
  const mid = ys(small)[8]
  assert.ok(mid > 0 && mid < 28)
})

test('the catcher camera sees the plate in the middle and nothing behind it', () => {
  const cam = makeCamera('catcher', 336, 300)
  const plate = project(cam, [0, 2.4, 1.417])
  assert.ok(Math.abs(plate.x - 168) < 40)
  assert.equal(project(cam, [0, 2, -20]), null)
  // A segment behind the lens is clipped to nothing; one in front is a path.
  assert.equal(lineD(cam, [0, 1, -30], [0, 1, -20]), '')
  assert.match(lineD(cam, [0, 1, 5], [0, 1, 40]), /^M[\d.-]+ [\d.-]+L[\d.-]+ [\d.-]+$/)
})

test('the flat side camera puts the release at the left, the plate at the right, and height up', () => {
  const cam = makeCamera('flat', 336, 180)
  const release = project(cam, [0, 5, 53.6])
  const plate = project(cam, [0, 2.4, 1.417])
  assert.ok(release.x < plate.x)
  assert.ok(release.y < plate.y)
  assert.ok(plate.x < 336 && release.x > 0 && release.y > 0 && plate.y < 180)
  assert.match(lineD(cam, [0, 1, 5], [0, 1, 40]), /^M[\d.-]+ [\d.-]+L[\d.-]+ [\d.-]+$/)
})

test('arsenalView: one row per pitch type, most thrown first, with the store\'s usage and the flight inputs', () => {
  const v = arsenalView({ shard: shard([CH, FF, SL]), command, id: 7, xwoba: (c) => (c === 'FF' ? 0.27 : null) })
  assert.deepEqual(v.map((r) => r.code), ['FF', 'CH', 'SL'])
  const [ff, ch, sl] = v
  assert.equal(ff.pct, 76.9)
  assert.deepEqual(ff.mark, pitchMark('FF'))
  assert.equal(ff.velo, 93)
  assert.equal(ff.spin, 2233)
  assert.equal(ff.flight, 0.41)
  assert.equal(ff.whiffPct, 25)
  assert.equal(ff.xwoba, 0.27)
  assert.equal(ch.xwoba, null)
  assert.ok(ff.path && ch.path)
  assert.equal(ff.path.T, 0.41)
  // The landing mark comes from the command cells: the changeup's low cell is lower than the fastball's.
  assert.ok(ch.landing.h < ff.landing.h)
  // No physics means: no flight, and every number reads null, never 0.
  assert.equal(sl.path, null)
  assert.equal(sl.spin, null)
  assert.equal(sl.flight, null)
})

test('arsenalView: no command entry means no whiff %, no landing mark and no flight, but the row stays', () => {
  const v = arsenalView({ shard: shard([FF]), command: null, id: 7 })
  assert.equal(v[0].whiffPct, null)
  assert.equal(v[0].landing, null)
  assert.equal(v[0].path, null)
  assert.equal(v[0].spin, 2233)
})

test('arsenalView: Triple-A reads the aaa mix and the aaa command grid; no xwOBA there', () => {
  const v = arsenalView({ shard: shard([FF], false), command: { aaa: command.mlb }, id: 7, xwoba: () => 0.3 })
  assert.equal(v[0].whiffPct, 25)
  assert.equal(v[0].xwoba, null)
})

test('arsenalView is null with no shard, no entry, or too few pitches', () => {
  assert.equal(arsenalView({ shard: null, id: 7 }), null)
  assert.equal(arsenalView({ shard: { pit: {} }, id: 7 }), null)
  assert.equal(arsenalView({ shard: shard([{ ...FF, pitches: 9 }]), id: 7 }), null)
})

test('Gasser 688107 from the committed store: FF is 23.3% of 1,815 pitches, and every type of 5 or more has a flight', () => {
  const read = (dir) => JSON.parse(readFileSync(new URL(`../public/data/${dir}/2026/07.json`, import.meta.url)))
  const v = arsenalView({ shard: read('pitch-arsenal'), command: read('pitch-command').pit?.['688107'], id: 688107 })
  assert.equal(v.reduce((n, r) => n + r.pitches, 0), 1815)
  const ff = v.find((r) => r.code === 'FF')
  assert.equal(ff.pitches, 422)
  assert.equal(ff.pct, 23.3)
  for (const r of v) assert.ok(r.path, `${r.code} has a flight path`)
  assert.ok(v.find((r) => r.code === 'SL').path)
})
