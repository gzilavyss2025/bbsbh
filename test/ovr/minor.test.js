// OVR step 7 (#1721): a minor leaguer's rating and the minor-league half of the career
// blend. Pure: literal rows in, numbers out.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CEILING, careerOvr, minorRating } from '../../src/api/ovr/minor.js'
import { CONSTANTS } from '../../src/api/ovr/career.js'
import { LEVEL_WEIGHT } from '../../src/api/milbSeasons.js'

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)
const { W } = CONSTANTS
const row = (over = {}) => ({ season: 2026, sport: 11, group: 'hitting', n: 400, pct: 50, ...over })

test('the ceilings are the decided ones', () => {
  assert.deepEqual(CEILING, { 11: 58, 12: 55, 13: 45, 14: 39, 16: 30 })
})

test('minorRating runs from the floor of 20 to the level ceiling', () => {
  for (const [sport, ceiling] of Object.entries(CEILING)) {
    near(minorRating(0, sport), 20)
    near(minorRating(100, sport), ceiling)
  }
  near(minorRating(97, 13), 20 + 25 * 0.97) // a 97th-percentile A+ hitter is about 44
  assert.equal(minorRating(50, 99), null) // not a level we rate
})

test('one minor-league season rates at its own level, whatever the level weight', () => {
  near(careerOvr(null, [row({ sport: 14, pct: 100 })]), 39)
  near(careerOvr(null, [row({ sport: 11, pct: 100 })]), 58)
})

test('no usable row gives null: a row under the playing-time floor has no percentile', () => {
  assert.equal(careerOvr(null, []), null)
  assert.equal(careerOvr(null, [row({ pct: null })]), null)
})

test('a higher level weighs more in one season', () => {
  const rows = [row({ sport: 11, pct: 100 }), row({ sport: 14, pct: 100 })]
  const [a, b] = [LEVEL_WEIGHT[11], LEVEL_WEIGHT[14]]
  near(careerOvr(null, rows), (a * 58 + b * 39) / (a + b))
})

test('playing time: 200 PA weighs half of 400, and more than 400 is capped', () => {
  const mlb = { ovr: 80, years: [2026] }
  const w = (n) => careerOvr(mlb, [row({ n, pct: 0 })])
  const full = LEVEL_WEIGHT[11] * W[0]
  near(w(400), (W[0] * 80 + full * 20) / (W[0] + full))
  near(w(200), (W[0] * 80 + (full / 2) * 20) / (W[0] + full / 2))
  near(w(4000), w(400))
  // a pitcher's full weight is 450 outs, not 400
  const p = careerOvr(mlb, [row({ group: 'pitching', n: 225, pct: 0 })])
  near(p, (W[0] * 80 + (full / 2) * 20) / (W[0] + full / 2))
})

test('recency: the newest season weighs most, the same way as the MLB blend', () => {
  const rows = [row({ season: 2026, pct: 100 }), row({ season: 2025, pct: 0 })]
  const [a, b] = [W[0], W[1]].map((x) => x * LEVEL_WEIGHT[11])
  near(careerOvr(null, rows), (a * 58 + b * 20) / (a + b))
})

test('an MLB rating is weighted by its seasons and pulled toward the minor-league line', () => {
  const mlb = { ovr: 70, years: [2026, 2025] }
  const out = careerOvr(mlb, [row({ season: 2024, sport: 12, pct: 100 })])
  const m = W[2] * LEVEL_WEIGHT[12]
  near(out, ((W[0] + W[1]) * 70 + m * 55) / (W[0] + W[1] + m))
  assert.ok(out < 70)
})

test('with no minor-league row an MLB rating comes back unchanged', () => {
  assert.equal(careerOvr({ ovr: 63.37, years: [2026, 2025, 2024] }, []), 63.37)
})
