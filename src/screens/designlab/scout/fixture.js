// INVENTED DATA for the Matchup Scout prototype. No real player, no feed, no
// Savant call: two made-up hitters and one made-up pitcher, generated from a
// fixed seed so every load draws the same maps. The SHAPES are the real
// stores' (pitch-command 5x5 counters per type and batter side; the planned
// #1411 hitter counters per type, pitcher hand and scope), so Phase 1 can swap
// in a reader without touching the components.
import { isoToday } from '../../../lib/dates.js'

// mulberry32: a tiny seeded PRNG, so the fixture is stable across loads.
function rng(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cells = (fn) => Array.from({ length: 25 }, (_, i) => fn(Math.floor(i / 5), i % 5))
const bump = (r, c, tr, tc, s) => Math.exp(-((r - tr) ** 2 + (c - tc) ** 2) / (2 * s * s))
const inner = (r, c) => r > 0 && r < 4 && c > 0 && c < 4

// --- the pitcher ------------------------------------------------------------
// Target cell per type and batter side, in the FEED's frame (col 0 = third-
// base side). Against a left-handed hitter, away is the third-base side.
const AIM = {
  FF: { L: [1, 2], R: [1, 2] },
  SL: { L: [3, 3], R: [3, 0] },
  CH: { L: [3, 0], R: [3, 4] },
  CU: { L: [4, 2], R: [4, 1] },
  SI: { L: [2, 3], R: [2, 1] },
}
const MIX = { FF: 0.44, SL: 0.24, CH: 0.2, CU: 0.08, SI: 0.04 }
const MPH = { FF: 95.1, SL: 86.4, CH: 87.9, CU: 79.8, SI: 94.6 }

function pitcherCells(code, stand, total, seed) {
  const r0 = rng(seed)
  const [tr, tc] = AIM[code][stand]
  const w = cells((r, c) => 0.08 + bump(r, c, tr, tc, 1.1) * (0.6 + 0.4 * r0()))
  const sum = w.reduce((a, b) => a + b, 0)
  return w.map((x) => Math.round((x / sum) * total))
}

const SCOPE_SIZE = { reg: 2800, post: 60 }
export const PITCHER = {
  name: 'Invented Pitcher A',
  throws: 'R',
  mph: MPH,
  // cells[scope][code][stand] — a 25-cell pitch count, like pitch-command.
  cells: Object.fromEntries(
    Object.entries(SCOPE_SIZE).map(([scope, n], si) => [
      scope,
      Object.fromEntries(
        Object.keys(MIX).map((code, ci) => [
          code,
          {
            L: pitcherCells(code, 'L', Math.round(n * 0.45 * MIX[code]), 100 + si * 10 + ci),
            R: pitcherCells(code, 'R', Math.round(n * 0.55 * MIX[code]), 200 + si * 10 + ci),
          },
        ]),
      ),
    ]),
  ),
}

// --- the hitters -------------------------------------------------------------
// The league's rate by cell, noise-free: what the colour scale compares to.
const RATE = {
  swing: (r, c) => (inner(r, c) ? 0.66 : 0.3),
  whiff: (r, c, code) => 0.12 + 0.07 * r + (code === 'SL' || code === 'CU' ? 0.1 : 0),
  xwoba: (r, c, code) => (inner(r, c) ? 0.39 - 0.05 * Math.abs(2 - r) : 0.22) - (code === 'SL' ? 0.03 : 0),
}
// The league as SUMS in the page's contract shape (screens/scout/hitterBoard.js):
// { reg | post: { [code]: COUNTERS } }, noise-free, a large sample per cell.
const leagueCounters = (code, n) => {
  const pitches = cells(() => n)
  const swings = pitches.map((p, i) => p * RATE.swing(Math.floor(i / 5), i % 5))
  const whiffs = swings.map((sw, i) => sw * RATE.whiff(Math.floor(i / 5), i % 5, code))
  const paEnd = pitches.map((p) => p * 0.27)
  const wobaSum = paEnd.map((k, i) => k * RATE.xwoba(Math.floor(i / 5), i % 5, code))
  return { pitches, swings, whiffs, paEnd, wobaSum }
}
export const LEAGUE_SUMS = {
  reg: Object.fromEntries(Object.keys(MIX).map((code) => [code, leagueCounters(code, 4000)])),
  post: Object.fromEntries(Object.keys(MIX).map((code) => [code, leagueCounters(code, 120)])),
}

// One hitter's counters for one type, pitcher hand and scope. `edge` tilts his
// results: positive hits the inside half better (feed col 4 for a lefty).
function hitterCounters(code, n, seed, edge) {
  const r0 = rng(seed)
  const pitches = cells((r, c) => Math.round(n * (0.025 + 0.06 * bump(r, c, 2, 2, 1.4)) * (0.7 + 0.6 * r0())))
  const swings = pitches.map((p, i) => Math.round(p * RATE.swing(Math.floor(i / 5), i % 5)))
  const whiffs = swings.map((s, i) => Math.round(s * Math.min(0.9, RATE.whiff(Math.floor(i / 5), i % 5, code) * (0.7 + 0.6 * r0()))))
  const paEnd = pitches.map((p) => Math.round(p * 0.27))
  const wobaSum = paEnd.map((k, i) => {
    const c = i % 5
    const base = RATE.xwoba(Math.floor(i / 5), c, code)
    return k * Math.max(0.05, base + edge * (c - 2) * 0.025 + (r0() - 0.5) * 0.12)
  })
  return { pitches, swings, whiffs, paEnd, wobaSum }
}

const SEEN = { FF: 900, SL: 520, CH: 380, CU: 200, SI: 120 }
const HAND_SIZE = { R: 1, L: 0.45 }
const SCOPE_SHARE = { reg: 1, post: 0.05 }

function makeHitter(name, bats, seed, edge) {
  const counters = {}
  for (const scope of Object.keys(SCOPE_SHARE)) {
    counters[scope] = {}
    for (const code of Object.keys(SEEN)) {
      counters[scope][code] = {}
      for (const hand of ['R', 'L']) {
        const n = SEEN[code] * HAND_SIZE[hand] * SCOPE_SHARE[scope]
        // A switch hitter bats left against a right-hander: flip his tilt.
        const e = bats === 'S' && hand === 'L' ? -edge : edge
        counters[scope][code][hand] = hitterCounters(code, n, seed + code.charCodeAt(0) * 7 + hand.charCodeAt(0), e)
      }
    }
  }
  return { name, bats, counters }
}

export const HITTERS = {
  lefty: makeHitter('Invented Hitter B', 'L', 300, 1),
  switch: makeHitter('Invented Hitter C', 'S', 400, -1),
}

// --- head to head --------------------------------------------------------------
// One row per plate appearance, Savant's fields renamed: game_date, game_type,
// events, bb_type, the last pitch's pitch_type, and the pitch count. The LAST
// row is dated TODAY, every time the page loads: the cutoff must hide it.
export function h2hRows() {
  return [
    { date: '2024-05-11', gameType: 'R', event: 'single', bbType: 'line_drive', pitchType: 'FF', pitches: 3 },
    { date: '2024-05-11', gameType: 'R', event: 'strikeout', pitchType: 'SL', pitches: 6 },
    { date: '2024-10-02', gameType: 'F', event: 'walk', pitchType: 'FF', pitches: 5 },
    { date: '2025-04-18', gameType: 'R', event: 'field_out', bbType: 'ground_ball', pitchType: 'CH', pitches: 2 },
    { date: '2025-07-30', gameType: 'R', event: 'home_run', bbType: 'fly_ball', pitchType: 'FF', pitches: 4 },
    { date: '2025-10-08', gameType: 'D', event: 'strikeout', pitchType: 'CU', pitches: 7 },
    { date: '2025-10-15', gameType: 'L', event: 'field_out', bbType: 'fly_ball', pitchType: 'SL', pitches: 1 },
    { date: '2025-10-27', gameType: 'W', event: 'double', bbType: 'line_drive', pitchType: 'CH', pitches: 4 },
    { date: '2026-09-12', gameType: 'R', event: 'strikeout', pitchType: 'SL', pitches: 5 },
    { date: isoToday(), gameType: 'F', event: 'home_run', bbType: 'fly_ball', pitchType: 'FF', pitches: 2 },
  ]
}
