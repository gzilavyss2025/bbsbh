// OVR step 2 (#1715, docs/ovr-rating.md "OVR for an MLB player"): the pure rating
// module. Savant percentiles in, bucket bars and one OVR out. No fetch, no
// war.json: the caller hands in `fld` as a percentile.
// The spread tests run on a seeded synthetic pool, never on
// public/data/savant-percentiles.json, which changes every night.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  CONSTANTS,
  inverseNormalCdf,
  percentileToRating,
  rateHitter,
  ratePitcher,
} from '../../src/api/ovr/rating.js'

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)

// ------------------------------------------------------------ inverse normal

test('inverseNormalCdf matches known z values', () => {
  near(inverseNormalCdf(0.5), 0, 1e-9)
  near(inverseNormalCdf(0.8413447), 1, 1e-4)
  near(inverseNormalCdf(0.9772499), 2, 1e-4)
  near(inverseNormalCdf(0.975), 1.959964, 1e-5)
  near(inverseNormalCdf(0.001), -3.090232, 1e-5)
  near(inverseNormalCdf(0.02), -inverseNormalCdf(0.98), 1e-9)
})

// ------------------------------------------------------ percentile to rating

test('percentile 50 maps to 60', () => {
  near(percentileToRating(50), 60, 1e-9)
})

test('percentile 84.13 maps to about 72 and 97.72 to about 84', () => {
  near(percentileToRating(84.13), 72, 0.01)
  near(percentileToRating(97.72), 84, 0.05)
})

test('the rating is floored at 20 and capped at 99', () => {
  assert.equal(percentileToRating(0.02), 20)
  assert.equal(percentileToRating(99.98), 99)
})

test('percentile 0 and 100 clamp to the epsilon instead of going infinite', () => {
  const eps = CONSTANTS.PCT_EPSILON
  assert.ok(eps > 0 && eps < 1)
  assert.equal(percentileToRating(0), percentileToRating(eps))
  assert.equal(percentileToRating(100), percentileToRating(100 - eps))
  assert.equal(percentileToRating(-5), percentileToRating(0))
  assert.equal(percentileToRating(250), percentileToRating(100))
  assert.ok(Number.isFinite(percentileToRating(0)) && Number.isFinite(percentileToRating(100)))
})

// ----------------------------------------------------------- bars and skips

const FULL_HITTER = { xwoba: 50, squaredUp: 50, ev: 50, hardHit: 50, brl: 50, batSpeed: 50, sprintSpeed: 50, fld: 50 }
const FULL_PITCHER = { whiff: 50, k: 50, fbVelo: 50, hardHit: 50, xera: 50, bb: 50 }

test('a bar is the mean of its rated metrics, not stretched', () => {
  const r = rateHitter({ ...FULL_HITTER, xwoba: 84.13, squaredUp: 50 })
  near(r.bars.contact, (72 + 60) / 2, 0.01)
  near(r.bars.power, 60, 1e-9)
})

test('a null or missing metric is skipped, not counted as zero', () => {
  const r = rateHitter({ ...FULL_HITTER, xwoba: 84.13, squaredUp: null })
  near(r.bars.contact, 72, 0.01)
  const r2 = rateHitter({ xwoba: 84.13, ev: 50 })
  near(r2.bars.contact, 72, 0.01)
})

test('a bucket with no metric has no bar', () => {
  const r = rateHitter({ xwoba: 60, ev: 60 })
  assert.deepEqual(Object.keys(r.bars).sort(), ['contact', 'power'])
})

test('a pitcher gets Stuff, Results and Control bars, and no Discipline', () => {
  const r = ratePitcher({ ...FULL_PITCHER, chase: 99 })
  assert.deepEqual(Object.keys(r.bars).sort(), ['control', 'results', 'stuff'])
})

// ------------------------------------------------------------- minimum data

test('a hitter with only sprintSpeed gets null', () => {
  assert.equal(rateHitter({ sprintSpeed: 90 }), null)
})

test('a hitter with Contact and Power gets a rating', () => {
  const r = rateHitter({ xwoba: 70, ev: 70 })
  assert.ok(r && Number.isFinite(r.ovr))
})

test('a hitter with Contact but no Power gets null', () => {
  assert.equal(rateHitter({ xwoba: 70, squaredUp: 70, sprintSpeed: 70 }), null)
})

test('a pitcher needs all three buckets', () => {
  assert.equal(ratePitcher({ whiff: 70, k: 70, xera: 70 }), null)
  assert.equal(ratePitcher({ fbVelo: 70 }), null)
  assert.ok(ratePitcher({ whiff: 70, xera: 70, bb: 70 }))
})

test('empty or missing input gives null', () => {
  assert.equal(rateHitter({}), null)
  assert.equal(rateHitter(undefined), null)
  assert.equal(ratePitcher(null), null)
})

// ---------------------------------------------------------------- roll-up

test('weights are the spec values and sum to 100', () => {
  assert.deepEqual(CONSTANTS.hitter.weights, { power: 22, contact: 33, speed: 17, fielding: 28 })
  assert.deepEqual(CONSTANTS.pitcher.weights, { stuff: 30, results: 45, control: 25 })
})

test('the roll-up is the weighted mean of the bars', () => {
  // All buckets present: contact 72, power 60, speed 60, fielding 60.
  const r = rateHitter({ ...FULL_HITTER, xwoba: 84.13, squaredUp: 84.13 })
  near(r.rollup, 60 + (12 * 33) / 100, 0.01)
})

test('a missing bucket shares its weight across the rest', () => {
  // No speed, no fielding: contact 72 (w 33) and power 60 (w 22) only.
  const r = rateHitter({ xwoba: 84.13, ev: 50 })
  near(r.rollup, (72 * 33 + 60 * 22) / (33 + 22), 0.01)
})

test('the stretch widens the deviation from 60 and the floor and cap still hold', () => {
  const r = rateHitter({ ...FULL_HITTER, xwoba: 84.13, squaredUp: 84.13, ev: 84.13, hardHit: 84.13, brl: 84.13, batSpeed: 84.13 })
  // contact 72, power 72, speed 60, fielding 60 -> rollup 60 + 12 * 55/100
  near(r.rollup, 66.6, 0.01)
  near(r.ovr, 60 + 2 * 6.6, 0.01)
  const p = ratePitcher({ whiff: 84.13, k: 84.13, fbVelo: 84.13, hardHit: 84.13, xera: 84.13, bb: 84.13 })
  near(p.rollup, 72, 0.01)
  near(p.ovr, 60 + 1.5 * 12, 0.01)
  const top = rateHitter({ xwoba: 99.9, squaredUp: 99.9, ev: 99.9, hardHit: 99.9, brl: 99.9, batSpeed: 99.9, sprintSpeed: 99.9, fld: 99.9 })
  assert.equal(top.ovr, 99)
  const bottom = rateHitter({ xwoba: 0.1, squaredUp: 0.1, ev: 0.1, hardHit: 0.1, brl: 0.1, batSpeed: 0.1, sprintSpeed: 0.1, fld: 0.1 })
  assert.equal(bottom.ovr, 20)
})

// ------------------------------------------------- spread on a synthetic pool

// Seeded, so the pool never changes. Each metric is a noisy copy of one latent
// factor (moderately correlated buckets); a percentile is the metric's rank.
function rng(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pool(keys, n, loading, seed) {
  const rand = rng(seed)
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
  const g = Array.from({ length: n }, gauss)
  const out = Array.from({ length: n }, () => ({}))
  for (const k of keys) {
    const z = g.map((x) => loading * x + Math.sqrt(1 - loading * loading) * gauss())
    const order = z.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
    order.forEach(([, i], rank) => {
      out[i][k] = ((rank + 1) / (n + 1)) * 100
    })
  }
  return out
}

const sd = (xs) => {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length)
}

const HITTER_KEYS = ['xwoba', 'squaredUp', 'ev', 'hardHit', 'brl', 'batSpeed', 'sprintSpeed', 'fld']
const PITCHER_KEYS = ['whiff', 'k', 'fbVelo', 'hardHit', 'xera', 'bb']
const hitters = pool(HITTER_KEYS, 3000, 0.3, 7).map(rateHitter)
const pitchers = pool(PITCHER_KEYS, 3000, 0.45, 11).map(ratePitcher)

test('fixture: the roll-up spread is about 6 (hitters) and 7.8 (pitchers) before the stretch', () => {
  near(sd(hitters.map((r) => r.rollup)), 6, 0.6)
  near(sd(pitchers.map((r) => r.rollup)), 7.8, 0.6)
})

test('after the stretch the standard deviation lands near 12', () => {
  near(sd(hitters.map((r) => r.ovr)), 12, 1)
  near(sd(pitchers.map((r) => r.ovr)), 12, 1)
})

test('no result passes 99, and none falls under 20', () => {
  for (const r of [...hitters, ...pitchers]) {
    assert.ok(r.ovr <= 99 && r.ovr >= 20)
  }
})

test('the order of players does not change', () => {
  for (const players of [hitters, pitchers]) {
    const byRollup = [...players].sort((a, b) => a.rollup - b.rollup)
    for (let i = 1; i < byRollup.length; i++) {
      assert.ok(byRollup[i].ovr >= byRollup[i - 1].ovr)
    }
  }
})
