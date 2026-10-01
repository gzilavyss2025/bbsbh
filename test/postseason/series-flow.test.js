import assert from 'node:assert/strict'
import test from 'node:test'
import { flowPanels, gamePoints, historyFlowBuckets } from '../../src/lib/postseason/seriesFlow.js'

const play = (home, inning, top = true) => ({
  homeTeamWinProbability: home,
  about: { inning, isTopInning: top },
})

test('a game opens even and ends where the feed ends, from the home club', () => {
  const { points, low, high } = gamePoints([play(40, 1), play(20, 5), play(100, 9, false)], 158, 158)
  assert.deepEqual(points.map((p) => p.y), [50, 40, 20, 100])
  assert.equal(points[0].x, 0)
  assert.equal(points.at(-1).x, 1)
  assert.deepEqual(low, { pct: 20, inning: 5, half: 'top' })
  assert.deepEqual(high, { pct: 100, inning: 9, half: 'bottom' })
})

test('the road club sees the mirror of the home share', () => {
  const { points } = gamePoints([play(40, 1), play(100, 9, false)], 158, 135)
  assert.deepEqual(points.map((p) => p.y), [50, 60, 0])
})

test('entries with no number or no inning are skipped; no data is an empty panel', () => {
  assert.deepEqual(gamePoints([{ about: { inning: 1 } }, { homeTeamWinProbability: 50 }], 158, 158).points, [])
  assert.deepEqual(gamePoints(null, 158, 158).points, [])
})

test('counted games get points; today and later games are empty slots whatever the signals hold', () => {
  const signals = {
    1: { winProb: [play(60, 1), play(100, 9, false)] },
    // A signal for today's game must never reach a panel.
    3: { winProb: [play(1, 1), play(0, 9)] },
  }
  const panels = flowPanels(
    {
      results: [{ gamePk: 1, gameNumber: 1, winnerId: 158 }],
      today: { gameNumber: 3 },
      upcoming: [{ gameNumber: 4 }, { gameNumber: 5 }],
    },
    signals,
    158,
    { 1: 158 },
  )
  assert.deepEqual(panels.map((p) => [p.kind, p.gameNumber]), [
    ['played', 1],
    ['today', 3],
    ['ahead', 4],
    ['ahead', 5],
  ])
  assert.equal(panels[0].points.length, 3)
  for (const p of panels.slice(1)) assert.deepEqual(p.points, [])
})

test('a decided series draws no ghost slots', () => {
  const panels = flowPanels(
    { results: [{ gamePk: 1, gameNumber: 1, winnerId: 158 }], today: null, upcoming: [] },
    {},
    158,
    {},
  )
  assert.equal(panels.length, 1)
  assert.deepEqual(panels[0].points, [])
})

test('a game whose home club is unknown draws no line rather than a guessed side', () => {
  // The game cards (which name the home club) and the win-chance signals are
  // two reads. When the cards read fails, the panel must not flip the line on a
  // guess: a home club's win would draw as a loss.
  assert.deepEqual(gamePoints([play(40, 1), play(100, 9, false)], undefined, 158).points, [])
  const [panel] = flowPanels(
    { results: [{ gamePk: 1, gameNumber: 1, winnerId: 158 }], today: null, upcoming: [] },
    { 1: { winProb: [play(60, 1), play(100, 9, false)] } },
    158,
    {},
  )
  assert.deepEqual(panel.points, [])
  assert.equal(panel.low, null)
})

test('a finished series from the history file: every game counted, no today, no slot ahead', () => {
  const buckets = historyFlowBuckets([
    { gameNumber: 1, gamePk: 11, awayTeamId: 112, awayScore: 3, homeTeamId: 158, homeScore: 9 },
    { gameNumber: 2, gamePk: 12, awayTeamId: 112, awayScore: 7, homeTeamId: 158, homeScore: 3 },
  ])
  assert.deepEqual(buckets, {
    results: [
      { gamePk: 11, gameNumber: 1, winnerId: 158 },
      { gamePk: 12, gameNumber: 2, winnerId: 112 },
    ],
    today: null,
    upcoming: [],
  })
  assert.deepEqual(historyFlowBuckets(null).results, [])
})
