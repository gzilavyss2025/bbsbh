import assert from 'node:assert/strict'
import test from 'node:test'
import { nextDay, walkPlayer } from '../scripts/lib/outliers/walk.mjs'

// The generator's per-date walk (#2453). The league tails are synthetic, as in
// hotcold-rule.test.js: each stat's 101 quantiles are a straight line, so a made-up line
// falls in a known tail.
const lin = (lo, hi) => Array.from({ length: 101 }, (_, k) => lo + ((hi - lo) * k) / 100)
const floor = (zeros, hi) => Array.from({ length: 101 }, (_, k) => (k < zeros ? 0 : (hi * (k - zeros + 1)) / (101 - zeros)))
const HIT_Q = { ops: lin(0.3, 0.7), avg: lin(0.15, 0.35), hr: floor(30, 0.08), so: lin(0.1, 0.4), bb: floor(20, 0.15), sb: floor(60, 0.5) }
const table = (q) => Object.fromEntries([10, 20, 30, 40].map((c) => [c, { n: 500, q }]))
const TAILS = { hitting: table(HIT_Q), pitching: {} }

const day = (i) => new Date(Date.UTC(2026, 3, 1 + i)).toISOString().slice(0, 10)
const game = (i, over = {}) => ({
  date: day(i), gameType: 'R',
  stat: { gamesPlayed: 1, plateAppearances: 4, atBats: 4, hits: 0, strikeOuts: 1, ...over },
})
// Ten games with no hit (cold OPS at the 10-game checkpoint), then a single a game
// until the line is back among the normal ones.
const coldThenNormal = [
  ...Array.from({ length: 10 }, (_, i) => game(i)),
  ...Array.from({ length: 30 }, (_, i) => game(10 + i, { hits: 1 })),
]

test('nextDay steps over a month end', () => {
  assert.equal(nextDay('2026-04-30'), '2026-05-01')
})

test('a flag starts on the game that earns it: the cutoff-day game is not counted', () => {
  const walk = walkPlayer({ role: 'hitting', rows: coldThenNormal, tails: TAILS })
  // Nine games (Apr 1-9) are below the 10-game checkpoint: no entry. The tenth game
  // (Apr 10) is the first that counts, so the first entry is dated Apr 10, not Apr 9.
  assert.equal(walk[0][0], day(9))
  assert.equal(walk[0][1][0][0], 'ops')
  assert.equal(walk[0][1][0][1], 0) // cold
  assert.equal(walk[0][1][0][4], 10) // sample: ten games, so the Apr 10 game counted
})

test('a run that ends writes a closing marker, and nothing after it', () => {
  const walk = walkPlayer({ role: 'hitting', rows: coldThenNormal, tails: TAILS })
  const marker = walk.findIndex((e) => e[1] === 0)
  assert.ok(marker > 0, 'a closing marker exists')
  assert.deepEqual(walk[marker - 1][1].length > 0, true)
  // The marker is the LAST entry: the player stays unflagged, so no more is written.
  assert.equal(marker, walk.length - 1)
  // A reader taking the latest entry on or before a late date sees the marker, not the flag.
  const latest = walk.filter((e) => e[0] <= day(39)).at(-1)
  assert.equal(latest[1], 0)
})

test('a player never flagged writes nothing', () => {
  const rows = Array.from({ length: 40 }, (_, i) => game(i, { hits: 1 }))
  assert.deepEqual(walkPlayer({ role: 'hitting', rows, tails: TAILS }), [])
})

test('a doubleheader is one date, and a postseason row does not count', () => {
  const rows = [...Array.from({ length: 12 }, (_, i) => game(i)), game(11), { ...game(12), gameType: 'P' }]
  const dates = walkPlayer({ role: 'hitting', rows, tails: TAILS }).map((e) => e[0])
  assert.deepEqual(dates, [...new Set(dates)])
  assert.ok(!dates.includes(day(12)))
})

test('a game after a date never changes that date: the cutoff-day game is held out', () => {
  const full = walkPlayer({ role: 'hitting', rows: coldThenNormal, tails: TAILS })
  const cut = walkPlayer({ role: 'hitting', rows: coldThenNormal.slice(0, 12), tails: TAILS })
  assert.deepEqual(full.filter((e) => e[0] <= day(11)), cut)
})
