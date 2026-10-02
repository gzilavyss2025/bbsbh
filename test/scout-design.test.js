// The Matchup Scout design prototype's pure half (src/screens/designlab/scout/
// model.js, spec docs/scout-design.md): the Phase 2 floors and bands, and the
// cutoff that hides a plate appearance dated on or after it (ADR-0087,
// ADR-0088). The region geometry's tests are in test/scout-regions.test.js.
import assert from 'node:assert/strict'
import test from 'node:test'
import { REGIONS } from '../src/lib/zone/regions.js'
import { band, expected, h2hBefore, h2hTotals, hitterRegions } from '../src/screens/designlab/scout/model.js'
import { h2hRows } from '../src/screens/designlab/scout/fixture.js'
import { isoToday } from '../src/lib/dates.js'

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

test('the head-to-head hides every plate appearance dated on or after the cutoff', () => {
  const rows = h2hRows()
  assert.equal(rows.at(-1).date, isoToday(), 'the fixture carries a row dated today')
  const shown = h2hBefore(rows, isoToday())
  assert.equal(shown.length, rows.length - 1)
  assert.ok(shown.every((r) => r.date < isoToday()))
  // ?d= moves the cutoff: a game ON that date is hidden too.
  const dated = h2hBefore(rows, '2025-10-08')
  assert.ok(dated.every((r) => r.date < '2025-10-08'))
  assert.equal(dated.length, 5)
  const t = h2hTotals(dated)
  assert.deepEqual([t.pa, t.k, t.bb], [5, 1, 1])
  assert.equal(t.slash, '.500/.600/1.250')
})
