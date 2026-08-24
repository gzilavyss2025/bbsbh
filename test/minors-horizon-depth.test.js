// The Minors tab's Horizon + Depth Chart cards (loadMinors.js) derive both
// from the same org-scoped, trend-joined prospect rows loadMinors already
// resolves — these two functions are the pure part of that join, so they're
// pinned here rather than only exercised through the async loader.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDepthChart, promotionWatchFrom } from '../src/screens/team/data/loadMinors.js'

function prospect(overrides) {
  return {
    playerId: 1,
    name: 'Test Player',
    position: 'SS',
    orgRank: 1,
    topRank: null,
    levelLabel: 'AA',
    affiliateTeamId: 900,
    trend: null,
    ...overrides,
  }
}

test('buildDepthChart groups by position in diamond order, not scrape order', () => {
  const prospects = [
    prospect({ playerId: 1, position: 'RHP', orgRank: 1 }),
    prospect({ playerId: 2, position: 'C', orgRank: 2 }),
    prospect({ playerId: 3, position: 'SS', orgRank: 3 }),
  ]
  const { positions } = buildDepthChart(prospects)
  assert.deepEqual(positions, ['C', 'SS', 'RHP'])
})

test('buildDepthChart sorts Scouting by orgRank and Performance by percentile, independently', () => {
  const prospects = [
    prospect({ playerId: 1, position: 'SS', orgRank: 1, trend: { percentile: 40, group: 'hitting' } }),
    prospect({ playerId: 2, position: 'SS', orgRank: 2, trend: { percentile: 92, group: 'hitting' } }),
    // No trend at all — must be excluded from Performance but still appear in Scouting.
    prospect({ playerId: 3, position: 'SS', orgRank: 3, trend: null }),
  ]
  const { byPosition } = buildDepthChart(prospects)
  assert.deepEqual(byPosition.SS.scouting.map((p) => p.playerId), [1, 2, 3])
  assert.deepEqual(byPosition.SS.performance.map((p) => p.playerId), [2, 1])
})

test('buildDepthChart skips a prospect with no resolved position', () => {
  const prospects = [prospect({ playerId: 1, position: '' }), prospect({ playerId: 2, position: 'C' })]
  const { positions } = buildDepthChart(prospects)
  assert.deepEqual(positions, ['C'])
})

test('buildDepthChart puts an out-of-order position after the known diamond order', () => {
  const prospects = [prospect({ playerId: 1, position: 'UT' }), prospect({ playerId: 2, position: 'C' })]
  const { positions } = buildDepthChart(prospects)
  assert.deepEqual(positions, ['C', 'UT'])
})

test('promotionWatchFrom keeps only a real, qualified, trending-UP standing', () => {
  const prospects = [
    prospect({ playerId: 1, trend: { percentile: 70, movement: { direction: 'up', amount: 12 } } }),
    // Trending down — excluded even though qualified.
    prospect({ playerId: 2, trend: { percentile: 90, movement: { direction: 'down', amount: 8 } } }),
    // No trend at all — excluded.
    prospect({ playerId: 3, trend: null }),
  ]
  const watch = promotionWatchFrom(prospects)
  assert.deepEqual(watch.map((p) => p.playerId), [1])
})

test('promotionWatchFrom ranks by current standing, not by how far it moved, and respects the limit', () => {
  const prospects = [
    prospect({ playerId: 1, trend: { percentile: 55, movement: { direction: 'up', amount: 25 } } }),
    prospect({ playerId: 2, trend: { percentile: 95, movement: { direction: 'up', amount: 6 } } }),
    prospect({ playerId: 3, trend: { percentile: 80, movement: { direction: 'up', amount: 10 } } }),
  ]
  const watch = promotionWatchFrom(prospects, 2)
  assert.deepEqual(watch.map((p) => p.playerId), [2, 3])
})
