import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  prospectTrendById,
  standingLabel,
  levelTier,
  tierLabel,
  confidenceState,
  deriveTrendMarks,
  ageEdgeFact,
  prospectCardView,
} from '../src/api/prospectTrend.js'

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

// ---------------------------------------------------------------------------
// tierLabel — the non-color cue beside the dots.
// ---------------------------------------------------------------------------

test('tierLabel names all five tiers', () => {
  assert.equal(tierLabel(1), 'Bottom band')
  assert.equal(tierLabel(2), 'Below band')
  assert.equal(tierLabel(3), 'Middle band')
  assert.equal(tierLabel(4), 'Above band')
  assert.equal(tierLabel(5), 'Top band')
})

test('tierLabel has no label for an out-of-range or missing tier', () => {
  assert.equal(tierLabel(0), null)
  assert.equal(tierLabel(6), null)
  assert.equal(tierLabel(null), null)
})

// ---------------------------------------------------------------------------
// confidenceState — how much to trust the dot, keyed on the same PA/outs
// floor the percentile's own qualification gate uses.
// ---------------------------------------------------------------------------

test('confidenceState is null below the qualification floor', () => {
  assert.equal(confidenceState(39, 'hitting'), null)
  assert.equal(confidenceState(29, 'pitching'), null)
})

test('confidenceState is early from the floor up to 1.5x', () => {
  assert.equal(confidenceState(40, 'hitting'), 'early')
  assert.equal(confidenceState(59, 'hitting'), 'early')
  assert.equal(confidenceState(30, 'pitching'), 'early')
  assert.equal(confidenceState(44, 'pitching'), 'early')
})

test('confidenceState is building from 1.5x up to 3x', () => {
  assert.equal(confidenceState(60, 'hitting'), 'building')
  assert.equal(confidenceState(119, 'hitting'), 'building')
  assert.equal(confidenceState(45, 'pitching'), 'building')
  assert.equal(confidenceState(89, 'pitching'), 'building')
})

test('confidenceState is established at 3x and above', () => {
  assert.equal(confidenceState(120, 'hitting'), 'established')
  assert.equal(confidenceState(400, 'hitting'), 'established')
  assert.equal(confidenceState(90, 'pitching'), 'established')
})

test('confidenceState is null for an unrecognised group or non-finite sample size', () => {
  assert.equal(confidenceState(100, 'fielding'), null)
  assert.equal(confidenceState(NaN, 'hitting'), null)
  assert.equal(confidenceState(undefined, 'hitting'), null)
})

// ---------------------------------------------------------------------------
// deriveTrendMarks — chart points (with gaps for unqualified weeks) and
// promotion/demotion markers from a player's raw history series.
// ---------------------------------------------------------------------------

const h = (date, sportId, percentile, qualified = true) => ({ date, sportId, percentile, qualified })

test('deriveTrendMarks plots a point per week, using null for an unqualified week', () => {
  const history = [h('2026-04-06', 12, 55), h('2026-04-13', 12, null, false), h('2026-04-20', 12, 62)]
  const { points } = deriveTrendMarks(history)
  assert.deepEqual(points, [
    { date: '2026-04-06', percentile: 55 },
    { date: '2026-04-13', percentile: null },
    { date: '2026-04-20', percentile: 62 },
  ])
})

test('deriveTrendMarks marks a promotion (sportId decreases) as "up"', () => {
  const history = [h('2026-04-06', 13, 70), h('2026-04-13', 13, 75), h('2026-04-20', 12, 60)]
  const { promotions } = deriveTrendMarks(history)
  assert.deepEqual(promotions, [{ date: '2026-04-20', fromSportId: 13, toSportId: 12, direction: 'up' }])
})

test('deriveTrendMarks marks a demotion (sportId increases) as "down"', () => {
  const history = [h('2026-04-06', 11, 40), h('2026-04-13', 12, 45)]
  const { promotions } = deriveTrendMarks(history)
  assert.deepEqual(promotions, [{ date: '2026-04-13', fromSportId: 11, toSportId: 12, direction: 'down' }])
})

test('deriveTrendMarks reports no promotions for a player who never changed levels', () => {
  const history = [h('2026-04-06', 12, 40), h('2026-04-13', 12, 45)]
  assert.deepEqual(deriveTrendMarks(history).promotions, [])
})

test('deriveTrendMarks degrades to empty arrays for a missing/empty history', () => {
  assert.deepEqual(deriveTrendMarks(null), { points: [], promotions: [] })
  assert.deepEqual(deriveTrendMarks([]), { points: [], promotions: [] })
})

// ---------------------------------------------------------------------------
// ageEdgeFact — only renders past a real 1-year edge, in either direction.
// ---------------------------------------------------------------------------

test('ageEdgeFact reports "younger" when the player is below the level average', () => {
  assert.deepEqual(ageEdgeFact(19, 21.1), { years: 2.1, direction: 'younger' })
})

test('ageEdgeFact reports "older" when the player is above the level average', () => {
  assert.deepEqual(ageEdgeFact(27, 24), { years: 3, direction: 'older' })
})

test('ageEdgeFact is null under the 1-year floor', () => {
  assert.equal(ageEdgeFact(21, 21.9), null)
  assert.equal(ageEdgeFact(21, 20.1), null)
})

test('ageEdgeFact is null without both a real age and a real level average', () => {
  assert.equal(ageEdgeFact(null, 21), null)
  assert.equal(ageEdgeFact(19, null), null)
  assert.equal(ageEdgeFact(NaN, 21), null)
})

// ---------------------------------------------------------------------------
// prospectCardView — the Prospect Card's whole view model, one entry point.
// ---------------------------------------------------------------------------

test('prospectCardView is state "none" for a player with no trend row, but keeps a real age edge', () => {
  assert.deepEqual(prospectCardView(null, 19, 21.1), { state: 'none', ageEdge: { years: 2.1, direction: 'younger' } })
})

test('prospectCardView is state "unqualified" with the real count and floor', () => {
  const entry = { group: 'hitting', qualified: false, sampleSize: 22, populationSize: 84 }
  assert.deepEqual(prospectCardView(entry, 19, 21.1), {
    state: 'unqualified',
    metric: 'OPS',
    sampleSize: 22,
    floor: 40,
    ageEdge: { years: 2.1, direction: 'younger' },
  })
})

test('prospectCardView is state "qualified" with tier, confidence, and trend all derived', () => {
  const entry = {
    group: 'hitting',
    sportId: 12,
    percentile: 93,
    qualified: true,
    sampleSize: 150,
    populationSize: 84,
    movement: { delta: 9, sinceDate: '2026-07-27' },
    history: [
      { date: '2026-08-03', sportId: 12, percentile: 84, qualified: true },
      { date: '2026-08-10', sportId: 12, percentile: 93, qualified: true },
    ],
  }
  const view = prospectCardView(entry, 19, 21.1)
  assert.equal(view.state, 'qualified')
  assert.equal(view.percentile, 93)
  assert.equal(view.standing, 'Top 7% OPS')
  assert.equal(view.tier, 5)
  assert.equal(view.tierLabel, 'Top band')
  assert.equal(view.confidence, 'established')
  assert.equal(view.floor, 40)
  assert.equal(view.populationSize, 84)
  assert.deepEqual(view.movement, { delta: 9, sinceDate: '2026-07-27' })
  assert.deepEqual(view.ageEdge, { years: 2.1, direction: 'younger' })
  assert.equal(view.trend.points.length, 2)
  assert.deepEqual(view.trend.promotions, [])
})
