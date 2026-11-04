// The Pitches card on a picked season (#1202). The live card reads statsapi's
// pitchArsenal for the current season; a past season, or every season
// combined, comes from the pitch-arsenal store's shard instead.
import assert from 'node:assert/strict'
import test from 'node:test'
import { arsenalLevelOf } from '../src/api/pitchArsenal.js'

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
