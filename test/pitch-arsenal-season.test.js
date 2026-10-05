// The Pitches card on a picked season (#1202). The live card reads statsapi's
// pitchArsenal for the current season; a past season, or every season
// combined, comes from the pitch-arsenal store's shard instead. arsenalMixRows
// reshapes that shard into the exact rows the card reads (person/advanced.js's
// arsenalView): { code, name, velo, usage (a fraction), count }.
import assert from 'node:assert/strict'
import test from 'node:test'
import { arsenalLevelOf, arsenalMixRows } from '../src/api/pitchArsenal.js'

const shard = {
  pit: {
    404: {
      name: 'A',
      mlb: [
        { code: 'SL', description: 'Slider', pitches: 25, avgVelo: 86.1 },
        { code: 'FF', description: 'Four-Seam Fastball', pitches: 75, avgVelo: 95.4 },
      ],
      aaa: [{ code: 'FF', description: 'Four-Seam Fastball', pitches: 3, avgVelo: 94 }],
    },
  },
}

test('the shard becomes the card rows, most-thrown first', () => {
  assert.deepEqual(arsenalMixRows(shard, 404, true), [
    { code: 'FF', name: 'Four-Seam Fastball', velo: 95.4, usage: 0.75, count: 75 },
    { code: 'SL', name: 'Slider', velo: 86.1, usage: 0.25, count: 25 },
  ])
})

test('a season he did not pitch, or one under the sample floor, is no card, never zeros', () => {
  assert.equal(arsenalMixRows(shard, 999, true), null)
  assert.equal(arsenalMixRows(shard, 404, false), null) // 3 Triple-A pitches
  assert.equal(arsenalMixRows(null, 404, true), null)
})

// The level comes from the picked season's own shard, not the level he pitches
// at now (#1202): a man in Triple-A in 2025 and MLB in 2026 has a 2025
// card from his AAA mix, never an empty MLB one.
test("a past season's level is the one he threw the most pitches at that season", () => {
  assert.equal(arsenalLevelOf(shard, 404), true) // 100 MLB, 3 AAA
  const aaaYear = { pit: { 7: { mlb: [{ code: 'FF', pitches: 4 }], aaa: [{ code: 'FF', pitches: 40 }, { code: 'CU', pitches: 20 }] } } }
  assert.equal(arsenalLevelOf(aaaYear, 7), false)
  assert.equal(arsenalLevelOf(aaaYear, '7'), false)
  assert.equal(arsenalLevelOf(shard, 999), null)
  assert.equal(arsenalLevelOf(null, 404), null)
})
