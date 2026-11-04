// The Matchup Scout's pure half (src/lib/scout/metrics.js, spec
// docs/scout-design.md): the Phase 2 floors and bands. The region geometry's
// tests are in test/scout-regions.test.js.
import assert from 'node:assert/strict'
import test from 'node:test'
import { REGIONS } from '../src/lib/zone/regions.js'
import { band, expected, hitterRegions } from '../src/lib/scout/metrics.js'

test('a region under the floor has a count and no value, and no colour band', () => {
  const zeros = () => Array(25).fill(0)
  const counters = { wobaSum: zeros(), paEnd: zeros() }
  counters.paEnd[12] = 9
  counters.wobaSum[12] = 9 * 0.4
  counters.paEnd[6] = 10
  counters.wobaSum[6] = 10 * 0.3
  const hit = hitterRegions(counters, 'xwoba')
  assert.deepEqual(hit.r2c2, { n: 9, value: null })
  assert.equal(hit.r1c1.n, 10)
  assert.ok(Math.abs(hit.r1c1.value - 0.3) < 1e-9)
  assert.equal(band('xwoba', hit.r2c2.value, 0.32), null)
  // The expected value uses the whole-type value where a region is thin.
  const share = Object.fromEntries(REGIONS.map((r) => [r, 0]))
  share.r2c2 = 0.5
  share.r1c1 = 0.5
  assert.ok(Math.abs(expected(share, hit, 0.35) - (0.5 * 0.35 + 0.5 * 0.3)) < 1e-9)
})
