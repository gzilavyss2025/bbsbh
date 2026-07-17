import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTeamScoreSnapshots, pythagoreanPct, qualityScoreFromGames } from '../scripts/gen-team-score.mjs'
import { leagueSeasonGradesFor, teamScoreFor } from '../src/api/teamScore.js'
import { seasonGradeFromScores, seasonGradeFor } from '../src/api/seasonGradeFormula.js'
import { classifyLateGame } from '../src/api/lateGameSwing.js'

test('Pythagorean quality is neutral with equal runs and rewards a run advantage', () => {
  assert.equal(pythagoreanPct(20, 20), 0.5)
  assert.ok(pythagoreanPct(60, 30) > 0.5)
})

test('quality score is neutral for a .500-quality ten-game sample and damped early', () => {
  assert.equal(qualityScoreFromGames({ wins: 5, games: 10, runsScored: 40, runsAllowed: 40 }).score, 5)
  assert.equal(qualityScoreFromGames({ wins: 5, games: 9, runsScored: 40, runsAllowed: 40 }), null)
  assert.ok(qualityScoreFromGames({ wins: 10, games: 10, runsScored: 60, runsAllowed: 20 }).score < 9)
})

test('classifyLateGame detects a walk-off as the home clutch win and the away blown-tie loss', () => {
  const innings = [
    { num: 1, home: { runs: 0 }, away: { runs: 0 } },
    { num: 2, home: { runs: 0 }, away: { runs: 0 } },
    { num: 3, home: { runs: 0 }, away: { runs: 0 } },
    { num: 4, home: { runs: 0 }, away: { runs: 0 } },
    { num: 5, home: { runs: 0 }, away: { runs: 0 } },
    { num: 6, home: { runs: 0 }, away: { runs: 0 } },
    { num: 7, home: { runs: 0 }, away: { runs: 0 } },
    { num: 8, home: { runs: 0 }, away: { runs: 0 } },
    { num: 9, home: { runs: 1 }, away: { runs: 0 } },
  ]
  const { home, away } = classifyLateGame({ innings, homeRuns: 1, awayRuns: 0 })
  assert.equal(home.clutchWin, true)
  assert.equal(home.blownLead, false)
  assert.equal(away.blownLead, false)
  assert.equal(away.clutchWin, false)
})

test('classifyLateGame detects a late collapse as a blown lead for the leader and a clutch win for the comeback team', () => {
  const innings = [
    { num: 1, home: { runs: 1 }, away: { runs: 0 } },
    { num: 2, home: { runs: 1 }, away: { runs: 0 } },
    { num: 3, home: { runs: 1 }, away: { runs: 0 } },
    { num: 4, home: { runs: 1 }, away: { runs: 0 } },
    { num: 5, home: { runs: 0 }, away: { runs: 0 } },
    { num: 6, home: { runs: 0 }, away: { runs: 0 } },
    { num: 7, home: { runs: 0 }, away: { runs: 0 } },
    { num: 8, home: { runs: 0 }, away: { runs: 3 } },
    { num: 9, home: { runs: 0 }, away: { runs: 1 } },
  ]
  const { home, away } = classifyLateGame({ innings, homeRuns: 4, awayRuns: 5 })
  assert.equal(home.blownLead, true)
  assert.equal(home.blownLeadRuns, 4)
  assert.equal(away.clutchWin, true)
  assert.equal(away.clutchWinRuns, 4)
})

test('snapshots retain season quality and a last-10 form window', () => {
  const games = Array.from({ length: 11 }, (_, index) => ({
    gamePk: index + 1,
    date: `2026-04-${String(index + 1).padStart(2, '0')}`,
    homeId: 1,
    awayId: 2,
    homeRuns: index < 5 ? 5 : 2,
    awayRuns: index < 5 ? 2 : 5,
  }))
  const snapshots = buildTeamScoreSnapshots({ games, asOf: '2026-05-01' })
  assert.equal(snapshots[1].season.games, 11)
  assert.equal(snapshots[1].currentForm.games, 10)
  assert.equal(snapshots[1].season.wins, 5)
  assert.equal(snapshots[1].currentForm.wins, 4)
})

test('reader never looks ahead of the Team Page cutoff', () => {
  const data = { seasons: { 2026: { byTeamId: { 158: { '2026-07-10': { season: { score: 6.2 } }, '2026-07-12': { season: { score: 7.4 } } } } } } }
  assert.equal(teamScoreFor(data, 158, 2026, '2026-07-11').season.score, 6.2)
  assert.equal(teamScoreFor(data, 158, 2026, '2026-07-09'), null)
})

test('a walk-off win in the current-form window raises the score and is counted as a clutch win', () => {
  const walkoffInnings = [
    { num: 1, home: { runs: 0 }, away: { runs: 0 } }, { num: 2, home: { runs: 0 }, away: { runs: 0 } },
    { num: 3, home: { runs: 0 }, away: { runs: 0 } }, { num: 4, home: { runs: 0 }, away: { runs: 0 } },
    { num: 5, home: { runs: 0 }, away: { runs: 0 } }, { num: 6, home: { runs: 0 }, away: { runs: 0 } },
    { num: 7, home: { runs: 0 }, away: { runs: 0 } }, { num: 8, home: { runs: 0 }, away: { runs: 0 } },
    { num: 9, home: { runs: 3 }, away: { runs: 2 } },
  ]
  const plainGames = Array.from({ length: 10 }, (_, index) => ({
    gamePk: index + 1,
    date: `2026-04-${String(index + 1).padStart(2, '0')}`,
    homeId: 1,
    awayId: 2,
    homeRuns: 3,
    awayRuns: 2,
  }))
  const withWalkoff = plainGames.map((g, index) => (index === 9 ? { ...g, innings: walkoffInnings } : g))

  const plain = buildTeamScoreSnapshots({ games: plainGames, asOf: '2026-05-01' })[1].currentForm
  const withSwing = buildTeamScoreSnapshots({ games: withWalkoff, asOf: '2026-05-01' })[1].currentForm

  assert.equal(plain.clutchWins, 0)
  assert.equal(withSwing.clutchWins, 1)
  assert.ok(withSwing.score > plain.score)
})

test('Season Grade preserves quality at expectation and uses bounded headroom', () => {
  assert.deepEqual(seasonGradeFromScores(6.1, 8.5), {
    score: 7.7,
    adjustment: 1.6,
    quality: 6.1,
    surprise: 8.5,
  })
  assert.equal(seasonGradeFromScores(8.7, 4.1).score, 7.8)
  assert.equal(seasonGradeFromScores(7.4, 5).score, 7.4)
  assert.equal(seasonGradeFor({ score: 8 }, null), null)
})

test('league Season Grades require both inputs and never look past the cutoff', () => {
  const quality = { seasons: { 2026: { byTeamId: {
    1: { '2026-07-10': { season: { score: 6 } }, '2026-07-12': { season: { score: 9 } } },
    2: { '2026-07-10': { season: { score: 7 } } },
    3: { '2026-07-10': { season: { score: 8 } } },
  } } } }
  const surprise = { seasons: { 2026: { byTeamId: {
    1: { '2026-07-10': { score: 8 }, '2026-07-12': { score: 1 } },
    2: { '2026-07-10': { score: 5 } },
  } } } }

  assert.deepEqual(leagueSeasonGradesFor(quality, surprise, 2026, '2026-07-11'), [
    { teamId: 1, score: 7.4 },
    { teamId: 2, score: 7 },
  ])
})
