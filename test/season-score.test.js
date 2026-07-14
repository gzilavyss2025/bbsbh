import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSnapshots,
  expectedHomeWinProbability,
  marcelBaseline,
  seasonScoreFromResidual,
} from '../scripts/gen-season-score.mjs'
import { seasonScoreFor } from '../src/api/seasonScore.js'

test('the schedule expectation gives equal teams a home-field edge', () => {
  const home = expectedHomeWinProbability(81, 81)
  assert.equal(home, 0.54)
  assert.ok(expectedHomeWinProbability(100, 70) > home)
})

test('the score remains neutral at expectation and is damped in a tiny sample', () => {
  assert.equal(seasonScoreFromResidual(0, 0).score, 5)
  assert.ok(seasonScoreFromResidual(5, 2.5).score < 9)
  assert.ok(seasonScoreFromResidual(-12, 20).score < 5)
})

test('Marcel weights the latest season most and regresses toward .500', () => {
  const baseline = marcelBaseline([
    { wins: 100, losses: 62 },
    { wins: 81, losses: 81 },
    { wins: 62, losses: 100 },
  ])
  assert.ok(baseline > 81)
  assert.ok(baseline < 100)
})

test('snapshots retain actual wins, schedule expectation, and separate trend', () => {
  const snapshots = buildSnapshots({
    asOf: '2026-04-03',
    baselines: {
      1: { wins: 81, kind: 'market' },
      2: { wins: 81, kind: 'marcel' },
    },
    standings: {},
    games: [
      { gamePk: 1, date: '2026-04-01', homeId: 1, awayId: 2, homeWon: true },
      { gamePk: 2, date: '2026-04-02', homeId: 2, awayId: 1, homeWon: false },
    ],
  })

  assert.deepEqual(
    { wins: snapshots[1].wins, losses: snapshots[1].losses, trend: snapshots[1].trend },
    { wins: 2, losses: 0, trend: { wins: 2, losses: 0, games: 2 } },
  )
  assert.equal(snapshots[1].baselineKind, 'market')
  assert.ok(snapshots[1].expectedWinsToDate > 0)
  assert.ok(snapshots[1].score > 5)
})

test('the reader never looks ahead of the Team Page cutoff', () => {
  const data = {
    seasons: {
      2026: {
        byTeamId: {
          158: {
            '2026-07-10': { score: 6.2 },
            '2026-07-12': { score: 7.4 },
          },
        },
      },
    },
  }
  assert.equal(seasonScoreFor(data, 158, 2026, '2026-07-11').score, 6.2)
  assert.equal(seasonScoreFor(data, 158, 2026, '2026-07-12').score, 7.4)
  assert.equal(seasonScoreFor(data, 158, 2026, '2026-07-09'), null)
})
