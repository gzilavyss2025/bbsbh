import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTeamScoreSnapshots, pythagoreanPct, qualityScoreFromGames } from '../scripts/gen-team-score.mjs'
import { leagueSeasonGradesFor, teamScoreFor, gradeTiersByTeamId } from '../src/api/teamScore.js'
import { seasonGradeFromScores, seasonGradeFor } from '../src/api/seasonGradeFormula.js'
import { classifyLateGame } from '../src/api/lateGameSwing.js'
import { scheduleStrengthAdjustment, SOS_ADJUSTMENT_CAP } from '../src/api/teamScoreFormula.js'

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

test('scheduleStrengthAdjustment is zero at a .500 schedule, signed away from it, and caps at extremes', () => {
  assert.equal(scheduleStrengthAdjustment(0.5, 162), 0)
  assert.equal(scheduleStrengthAdjustment(null, 162), 0)
  assert.equal(scheduleStrengthAdjustment(0.55, 0), 0)
  assert.ok(scheduleStrengthAdjustment(0.55, 162) > 0)
  assert.ok(scheduleStrengthAdjustment(0.45, 162) < 0)
  assert.equal(scheduleStrengthAdjustment(0.9, 162), SOS_ADJUSTMENT_CAP)
  assert.equal(scheduleStrengthAdjustment(0.1, 162), -SOS_ADJUSTMENT_CAP)
  // Half a season's games earns roughly half the wins-equivalent credit of a
  // full season at the same opponent strength.
  const full = scheduleStrengthAdjustment(0.52, 162)
  const half = scheduleStrengthAdjustment(0.52, 81)
  assert.ok(Math.abs(half - full / 2) < 1e-9)
})

test('Quality credits a tougher schedule and debits a softer one for two teams with identical records', () => {
  // X and Y each go 5-5 in ten identical-shaped games (same run pattern, so
  // wins/pythagWins/weightedWins match exactly) — the only thing that
  // differs is who they played. X's only opponent (A) has a weak overall
  // record (5-15 once A's games against B are folded in); Y's only
  // opponent (C) has a strong one (15-5 once C's games against D are folded
  // in). Quality must separate them on strength of schedule alone.
  const winLossGames = (gamePkStart, homeId, awayId, count, homeWinsFirst) =>
    Array.from({ length: count }, (_, index) => ({
      gamePk: gamePkStart + index,
      date: `2026-04-${String(index + 1).padStart(2, '0')}`,
      homeId,
      awayId,
      homeRuns: index < homeWinsFirst ? 5 : 2,
      awayRuns: index < homeWinsFirst ? 2 : 5,
    }))

  const X = 101, Y = 102, A = 201, C = 202, B = 301, D = 302
  const games = [
    ...winLossGames(1, X, A, 10, 5),
    ...winLossGames(101, Y, C, 10, 5),
    ...winLossGames(201, B, A, 10, 10), // A loses every game here — drags its record down
    ...winLossGames(301, C, D, 10, 10), // C wins every game here — lifts its record up
  ]

  const snapshots = buildTeamScoreSnapshots({ games, asOf: '2026-05-01' })
  const x = snapshots[X].season
  const y = snapshots[Y].season

  // Identical underlying performance...
  assert.equal(x.wins, y.wins)
  assert.equal(x.runDifferential, y.runDifferential)
  assert.equal(x.pythagWins, y.pythagWins)
  // ...but opposite schedule strength, and a Quality score that reflects it.
  assert.equal(x.avgOpponentWinPct, 0.25)
  assert.equal(y.avgOpponentWinPct, 0.75)
  assert.ok(x.sosAdjustment < 0)
  assert.ok(y.sosAdjustment > 0)
  assert.ok(y.score > x.score)
  assert.equal(x.score, 4.2)
  assert.equal(y.score, 5.8)
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
    1: {
      '2026-07-10': { season: { score: 6, weightedWinsAbove500: 3.2 } },
      '2026-07-12': { season: { score: 9, weightedWinsAbove500: 9.9 } },
    },
    2: { '2026-07-10': { season: { score: 7, weightedWinsAbove500: -1.5 } } },
    3: { '2026-07-10': { season: { score: 8, weightedWinsAbove500: 4.4 } } },
  } } } }
  const surprise = { seasons: { 2026: { byTeamId: {
    1: {
      '2026-07-10': { score: 8, residualWins: 2.1 },
      '2026-07-12': { score: 1, residualWins: 8.8 },
    },
    2: { '2026-07-10': { score: 5, residualWins: -0.6 } },
  } } } }

  // The 07-12 snapshots (weightedWinsAbove500: 9.9, residualWins: 8.8) sit
  // past the cutoff and must never leak into team 1's tiebreak — only the
  // 07-10 pair is eligible.
  assert.deepEqual(leagueSeasonGradesFor(quality, surprise, 2026, '2026-07-11'), [
    { teamId: 1, score: 7.4, tiebreak: [3.2, 2.1] },
    { teamId: 2, score: 7, tiebreak: [-1.5, -0.6] },
  ])
})

test('Season Grade tiers split a nine-team pool into even thirds by rank, not by score', () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ teamId: i + 1, score: 9 - i, tiebreak: [] }))
  const tiers = gradeTiersByTeamId(rows)
  assert.deepEqual([...tiers.entries()], [
    [1, 'high'], [2, 'high'], [3, 'high'],
    [4, 'mid'], [5, 'mid'], [6, 'mid'],
    [7, 'low'], [8, 'low'], [9, 'low'],
  ])
})

test('Season Grade tiers handle a pool size not divisible by three without losing a team', () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ teamId: i + 1, score: 8 - i, tiebreak: [] }))
  const tiers = gradeTiersByTeamId(rows)
  const counts = { high: 0, mid: 0, low: 0 }
  for (const tier of tiers.values()) counts[tier] += 1
  assert.equal(tiers.size, 8)
  assert.equal(counts.high + counts.mid + counts.low, 8)
  // Best-ranked team is always 'high', worst-ranked is always 'low'.
  assert.equal(tiers.get(1), 'high')
  assert.equal(tiers.get(8), 'low')
})
