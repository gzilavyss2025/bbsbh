// The player page's hitting-side counterpart to test/pitcher-advanced.test.js:
// the Advanced rate card (advancedHittingView, fed by person-fetch's
// season/seasonAdvanced/sabermetrics bundle), the batted-ball profile
// (battedBallView), and the league-rank chip strip (hittingRanksView). All
// pure shaping — fixtures mirror live statsapi field names/values captured
// for personId 661388 (William Contreras) on 2026-08-04 (seasonAdvanced
// proportions arrive as ".406"-style strings, sabermetrics figures as
// floats, rankings as per-league rank numbers/strings). The batted-ball
// bucket counts below are the actual live values — they sum exactly to
// ballsInPlay (145 + 83 + 83 + 30 = 341).
import assert from 'node:assert/strict'
import test from 'node:test'
import { advancedHittingView, battedBallView, hittingRanksView } from '../src/api/person.js'

// ---------------------------------------------------------------------------
// advancedHittingView
// ---------------------------------------------------------------------------

const SEASON_ADVANCED = {
  pitchesPerPlateAppearance: '3.507',
  walksPerPlateAppearance: '.085',
  strikeoutsPerPlateAppearance: '.143',
  walksPerStrikeout: '.594',
  iso: '.122',
  babip: '.293',
  ballsInPlay: 341,
  groundOuts: 107,
  groundHits: 38,
  lineOuts: 30,
  lineHits: 53,
  flyOuts: 67,
  flyHits: 16,
  popOuts: 30,
  popHits: 0,
  totalSwings: 729,
  swingAndMisses: 144,
}
const SABERMETRICS = { woba: 0.31586, wRcPlus: 98.8173 }

test('advancedHittingView shapes all eight facts from a live-shaped bundle', () => {
  const view = advancedHittingView({ seasonAdvanced: SEASON_ADVANCED, sabermetrics: SABERMETRICS })
  const byLabel = Object.fromEntries(view.facts.map((f) => [f.label, f.value]))
  assert.equal(byLabel.wOBA, '.316')
  assert.equal(byLabel['wRC+'], '99')
  assert.equal(byLabel['K%'], '14.3%')
  assert.equal(byLabel['BB%'], '8.5%')
  assert.equal(byLabel['BB/K'], '.59')
  assert.equal(byLabel.ISO, '.122')
  assert.equal(byLabel.BABIP, '.293')
  assert.equal(byLabel['P/PA'], '3.51')
  // Every fact carries its own explainer for the card's per-fact "i" glyph.
  assert.ok(view.facts.every((f) => typeof f.note === 'string' && f.note.length > 0))
})

test('advancedHittingView degrades to null on a missing or sparse bundle', () => {
  assert.equal(advancedHittingView(null), null)
  assert.equal(advancedHittingView({ seasonAdvanced: null, sabermetrics: null }), null)
  // A sabermetrics-only bundle (two facts: wOBA, wRC+) is below the four-fact floor.
  assert.equal(advancedHittingView({ seasonAdvanced: null, sabermetrics: SABERMETRICS }), null)
})

// ---------------------------------------------------------------------------
// battedBallView
// ---------------------------------------------------------------------------

test('battedBallView computes share/AVG per bucket in fixed ground/line/fly/pop order', () => {
  const view = battedBallView(SEASON_ADVANCED)
  assert.equal(view.ballsInPlay, 341)
  assert.deepEqual(view.rows.map((r) => r.key), ['ground', 'line', 'fly', 'pop'])
  assert.deepEqual(view.rows.map((r) => r.name), ['Ground balls', 'Line drives', 'Fly balls', 'Pop-ups'])
  const [ground, line, fly, pop] = view.rows
  // ground: 107 outs + 38 hits = 145 total.
  assert.equal(ground.share, 145 / 341)
  assert.equal(ground.avg, 38 / 145)
  // line: 30 + 53 = 83.
  assert.equal(line.share, 83 / 341)
  assert.equal(line.avg, 53 / 83)
  // fly: 67 + 16 = 83.
  assert.equal(fly.share, 83 / 341)
  assert.equal(fly.avg, 16 / 83)
  // pop: 30 + 0 = 30, zero hits but a non-zero total — avg is 0, not null.
  assert.equal(pop.share, 30 / 341)
  assert.equal(pop.avg, 0)
})

test('battedBallView gives a bucket with zero balls in play a null AVG', () => {
  const view = battedBallView({
    ballsInPlay: 50,
    groundOuts: 0, groundHits: 0,
    lineOuts: 50, lineHits: 0,
    flyOuts: 0, flyHits: 0,
    popOuts: 0, popHits: 0,
  })
  const [ground, line, fly, pop] = view.rows
  assert.equal(ground.avg, null)
  assert.equal(ground.share, 0)
  assert.equal(line.avg, 0)
  assert.equal(line.share, 1)
  assert.equal(fly.avg, null)
  assert.equal(pop.avg, null)
})

test('battedBallView returns null below the 50-ball sample floor, or with no data', () => {
  assert.equal(battedBallView(null), null)
  assert.equal(battedBallView({ ...SEASON_ADVANCED, ballsInPlay: 49 }), null)
  assert.equal(battedBallView({ ...SEASON_ADVANCED, ballsInPlay: 0 }), null)
  assert.equal(battedBallView({ ...SEASON_ADVANCED, ballsInPlay: undefined }), null)
})

// ---------------------------------------------------------------------------
// hittingRanksView
// ---------------------------------------------------------------------------

test('hittingRanksView keeps top-10 ranks only, sorted, capped at four chips', () => {
  const view = hittingRanksView([
    {
      league: { name: 'American League' },
      stat: {
        homeRuns: '1', rbi: '2', avg: '3', ops: '4', stolenBases: '11', hits: '25',
      },
    },
  ])
  assert.equal(view.league, 'AL')
  // HR 1, RBI 2, AVG 3, OPS 4 all qualify — SB (11th) and H (25th) don't.
  assert.equal(view.items.length, 4)
  assert.deepEqual(view.items.map((i) => i.text), ['1st', '2nd', '3rd', '4th'])
  assert.deepEqual(view.items.map((i) => i.label), ['HR', 'RBI', 'AVG', 'OPS'])
  assert.ok(!view.items.some((i) => i.label === 'SB' || i.label === 'H'))
})

test('hittingRanksView returns null with no qualifying rank or no split', () => {
  assert.equal(hittingRanksView([]), null)
  assert.equal(
    hittingRanksView([{ league: { name: 'National League' }, stat: { homeRuns: '38', rbi: '45' } }]),
    null,
  )
})
