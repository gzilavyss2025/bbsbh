// The Minors tab's Horizon + Depth Chart cards (loadMinors.js) derive both
// from the same org-scoped, trend-joined prospect rows loadMinors already
// resolves — these two functions are the pure part of that join, so they're
// pinned here rather than only exercised through the async loader.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDepthChart, promotionWatchFrom, statLineFor } from '../src/screens/team/data/loadMinors.js'

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

test('statLineFor builds W-L/ERA/K/WHIP for a pitcher', () => {
  const stats = statLineFor('RHP', {
    pitching: { wins: 8, losses: 3, era: 3.451, strikeOuts: 97, whip: 1.182 },
  })
  assert.deepEqual(stats, [
    { k: 'W-L', v: '8-3' },
    { k: 'ERA', v: '3.45' },
    { k: 'K', v: '97' },
    { k: 'WHIP', v: '1.18' },
  ])
})

test('statLineFor builds AVG/HR/RBI/OPS for a hitter, with no leading zero on rate stats', () => {
  const stats = statLineFor('SS', {
    hitting: { avg: 0.2724, homeRuns: 13, rbi: 80, ops: 0.9615 },
  })
  assert.deepEqual(stats, [
    { k: 'AVG', v: '.272' },
    { k: 'HR', v: '13' },
    { k: 'RBI', v: '80' },
    { k: 'OPS', v: '.962' },
  ])
})

test('statLineFor keeps a whole-number OPS at or above 1.000 intact', () => {
  const stats = statLineFor('OF', { hitting: { avg: 0.31, homeRuns: 5, rbi: 20, ops: 1.021 } })
  assert.equal(stats.find((s) => s.k === 'OPS').v, '1.021')
})

test('statLineFor returns null with no pool row, or no line for the player\'s own group', () => {
  assert.equal(statLineFor('RHP', null), null)
  assert.equal(statLineFor('RHP', { pitching: null, hitting: { avg: 0.3 } }), null)
})
