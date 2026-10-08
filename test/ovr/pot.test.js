// OVR step 7 (#1721): POT for Top 100 players (docs/ovr-rating.md, "POT").
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { potRating } from '../../src/api/ovr/pot.js'

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`)

test('rank 1 gives a base of 95, rank 100 gives 70', () => {
  near(potRating(20, 1, 25), 95)
  near(potRating(20, 100, 25), 70)
})

test('the age credit is 1.5 a year under 21, capped at 4, and 0 from 21 on', () => {
  near(potRating(20, 50, 20) - potRating(20, 50, 25), 1.5)
  near(potRating(20, 50, 19) - potRating(20, 50, 25), 3)
  near(potRating(20, 50, 18) - potRating(20, 50, 25), 4) // 4.5 capped
  near(potRating(20, 50, 16) - potRating(20, 50, 25), 4)
  near(potRating(20, 50, 21), potRating(20, 50, 35)) // no debit for older players
})

test('a missing age gives no credit', () => {
  near(potRating(20, 50, null), potRating(20, 50, 25))
})

test('POT is never below OVR and never above 99', () => {
  assert.equal(potRating(80, 100, 25), 80)
  assert.equal(potRating(99, 1, 17), 99)
  assert.equal(potRating(20, 1, 17), 99) // 95 + 4 = 99, the top of the band
  assert.ok(potRating(20, 1, 17) <= 99)
})

test('a player off the list gets null, even a major leaguer with a high OVR', () => {
  assert.equal(potRating(90, null, 25), null)
  assert.equal(potRating(90, undefined, 25), null)
  assert.equal(potRating(90, 0, 25), null)
})
