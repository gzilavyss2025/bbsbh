import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTeamScoreSnapshots, pythagoreanPct, qualityScoreFromGames } from '../scripts/gen-team-score.mjs'
import { teamScoreFor } from '../src/api/teamScore.js'

test('Pythagorean quality is neutral with equal runs and rewards a run advantage', () => {
  assert.equal(pythagoreanPct(20, 20), 0.5)
  assert.ok(pythagoreanPct(60, 30) > 0.5)
})

test('quality score is neutral for a .500-quality ten-game sample and damped early', () => {
  assert.equal(qualityScoreFromGames({ wins: 5, games: 10, runsScored: 40, runsAllowed: 40 }).score, 5)
  assert.equal(qualityScoreFromGames({ wins: 5, games: 9, runsScored: 40, runsAllowed: 40 }), null)
  assert.ok(qualityScoreFromGames({ wins: 10, games: 10, runsScored: 60, runsAllowed: 20 }).score < 9)
})

test('snapshots retain season quality and a last-30 form window', () => {
  const games = Array.from({ length: 31 }, (_, index) => ({
    gamePk: index + 1,
    date: `2026-04-${String(index + 1).padStart(2, '0')}`,
    homeId: 1,
    awayId: 2,
    homeRuns: index < 20 ? 5 : 2,
    awayRuns: index < 20 ? 2 : 5,
  }))
  const snapshots = buildTeamScoreSnapshots({ games, asOf: '2026-05-01' })
  assert.equal(snapshots[1].season.games, 31)
  assert.equal(snapshots[1].currentForm.games, 30)
  assert.equal(snapshots[1].season.wins, 20)
  assert.equal(snapshots[1].currentForm.wins, 19)
})

test('reader never looks ahead of the Team Page cutoff', () => {
  const data = { seasons: { 2026: { byTeamId: { 158: { '2026-07-10': { season: { score: 6.2 } }, '2026-07-12': { season: { score: 7.4 } } } } } } }
  assert.equal(teamScoreFor(data, 158, 2026, '2026-07-11').season.score, 6.2)
  assert.equal(teamScoreFor(data, 158, 2026, '2026-07-09'), null)
})
