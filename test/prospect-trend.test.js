import { test } from 'node:test'
import assert from 'node:assert/strict'
import { prospectTrendById, standingLabel, levelTier } from '../src/api/prospectTrend.js'

const SNAPSHOT = {
  generatedAt: '2026-08-10',
  dataThrough: '2026-08-10',
  players: [
    { playerId: 111, group: 'hitting', sportId: 12, percentile: 72, qualified: true, movement: null },
    { playerId: 222, group: 'pitching', sportId: 11, percentile: null, qualified: false, movement: null },
  ],
}

test('prospectTrendById returns the row for a known playerId', () => {
  assert.deepEqual(prospectTrendById(SNAPSHOT, 111), SNAPSHOT.players[0])
})

test('prospectTrendById returns the unqualified row as-is, not null', () => {
  assert.deepEqual(prospectTrendById(SNAPSHOT, 222), SNAPSHOT.players[1])
})

test('prospectTrendById returns null for a player with no current-level line', () => {
  assert.equal(prospectTrendById(SNAPSHOT, 999), null)
})

test('prospectTrendById degrades to null on a missing/empty snapshot', () => {
  assert.equal(prospectTrendById(null, 111), null)
  assert.equal(prospectTrendById({}, 111), null)
})

// ---------------------------------------------------------------------------
// standingLabel — the /prospects cell says the percentile the way a broadcast
// says it, because "93rd" in a column two cells from an actual RANK column asks
// a reader to know it means a percentile, and then which end of it is good.
// ---------------------------------------------------------------------------

test('a high percentile is stated as the share of the level he is ahead of', () => {
  assert.equal(standingLabel(93, 'hitting'), 'Top 7% OPS')
  assert.equal(standingLabel(100, 'hitting'), 'Top 0% OPS')
  // The boundary belongs to the band it names.
  assert.equal(standingLabel(60, 'hitting'), 'Top 40% OPS')
})

test('a low percentile keeps its own number — "Bottom 12%", not "Top 88%"', () => {
  assert.equal(standingLabel(12, 'hitting'), 'Bottom 12% OPS')
  assert.equal(standingLabel(40, 'hitting'), 'Bottom 40% OPS')
})

test('the middle band is named, not printed as false precision', () => {
  // 41 through 59. A player one point either side of the median is not doing
  // two different things, and the sample cannot support the distinction.
  assert.equal(standingLabel(41, 'hitting'), 'Middle OPS')
  assert.equal(standingLabel(50, 'hitting'), 'Middle OPS')
  assert.equal(standingLabel(59, 'hitting'), 'Middle OPS')
})

test('every cell names the stat it ranks, because the column ranks two of them', () => {
  // No caption under the table defines this — the cell has to stand alone, and
  // a bat and an arm in the same column are not ranked on the same thing.
  assert.equal(standingLabel(98, 'pitching'), 'Top 2% ERA')
  assert.equal(standingLabel(12, 'pitching'), 'Bottom 12% ERA')
  // Higher is always better: percentileRank already inverts ERA, so a top
  // percentile means a LOW earned run average.
  assert.equal(standingLabel(98, 'hitting'), 'Top 2% OPS')
})

test('an unrecognised group still yields a readable band rather than nothing', () => {
  assert.equal(standingLabel(93, undefined), 'Top 7%')
})

test('a non-numeric percentile has no label — the caller renders "Too early"', () => {
  assert.equal(standingLabel(null, 'hitting'), null)
  assert.equal(standingLabel(undefined, 'hitting'), null)
  assert.equal(standingLabel(NaN, 'hitting'), null)
})

// ---------------------------------------------------------------------------
// levelTier — ProspectTrendPill's 5-dot rating, built by splitting
// standingLabel's own Bottom/Middle/Top bands in half rather than a fresh set
// of edges, so the dots and the spoken label never disagree about a boundary.
// ---------------------------------------------------------------------------

test('the Bottom band (<=40) splits into tiers 1 and 2 at its own midpoint', () => {
  assert.equal(levelTier(0), 1)
  assert.equal(levelTier(20), 1)
  assert.equal(levelTier(21), 2)
  assert.equal(levelTier(40), 2)
})

test('the Middle band (41-59) is entirely tier 3', () => {
  assert.equal(levelTier(41), 3)
  assert.equal(levelTier(50), 3)
  assert.equal(levelTier(59), 3)
})

test('the Top band (>=60) splits into tiers 4 and 5 at its own midpoint', () => {
  assert.equal(levelTier(60), 4)
  assert.equal(levelTier(79), 4)
  assert.equal(levelTier(80), 5)
  assert.equal(levelTier(100), 5)
})

test('a non-numeric percentile has no tier, same empty state as standingLabel', () => {
  assert.equal(levelTier(null), null)
  assert.equal(levelTier(undefined), null)
  assert.equal(levelTier(NaN), null)
})
