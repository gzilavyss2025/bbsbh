import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTeamScoreSnapshots, pythagoreanPct, qualityScoreFromGames } from '../scripts/gen-team-score.mjs'
import { leagueSeasonGradesFor, teamScoreFor, gradeTiersByTeamId } from '../src/api/teamScore.js'
import { seasonGradeFromScores, seasonGradeFor } from '../src/api/seasonGradeFormula.js'
import { classifyLateGame } from '../src/api/lateGameSwing.js'
import {
  scheduleStrengthAdjustment,
  SOS_ADJUSTMENT_CAP,
  venueRunFactor,
  VENUE_FACTOR_PRIOR_GAMES,
  PARK_FACTOR_MIN,
  PARK_FACTOR_MAX,
} from '../src/api/teamScoreFormula.js'

const round1 = (n) => Math.round(n * 10) / 10

// Repeats the same fixed score between two teams at one venue — the building
// block for the park-adjustment fixtures below, which need a well-sampled
// venue (50-60 games) rather than the handful winLossGames below produces.
const repeatedGames = ({ gamePkStart, homeId, awayId, count, homeRuns, awayRuns, venueId }) =>
  Array.from({ length: count }, (_, index) => ({
    gamePk: gamePkStart + index,
    date: `2026-04-${String((index % 28) + 1).padStart(2, '0')}`,
    homeId,
    awayId,
    homeRuns,
    awayRuns,
    venueId,
  }))

test('Pythagorean quality is neutral with equal runs and rewards a run advantage', () => {
  assert.equal(pythagoreanPct(20, 20), 0.5)
  assert.ok(pythagoreanPct(60, 30) > 0.5)
})

test('quality score is neutral for a .500-quality ten-game sample and damped early', () => {
  assert.equal(qualityScoreFromGames({ wins: 5, games: 10, runsScored: 40, runsAllowed: 40 }).score, 5)
  assert.equal(qualityScoreFromGames({ wins: 5, games: 9, runsScored: 40, runsAllowed: 40 }), null)
  assert.ok(qualityScoreFromGames({ wins: 10, games: 10, runsScored: 60, runsAllowed: 20 }).score < 9)
})

test('venueRunFactor is neutral at equal averages, guards zero denominators, and signs with the deviation', () => {
  // Neutral regardless of sample size — a venue that scores exactly like the
  // league gets no adjustment whether it's hosted 1 game or 500.
  assert.equal(venueRunFactor(9, 9, 1), 1)
  assert.equal(venueRunFactor(9, 9, 500), 1)
  // Zero-guards: no league average or no games at the venue yet both mean
  // "nothing to compare against," so stay neutral rather than divide by zero.
  assert.equal(venueRunFactor(9, 0, 20), 1)
  assert.equal(venueRunFactor(9, 9, 0), 1)
  // Sign follows the deviation: a higher venue average than the league's
  // pushes the factor above 1, a lower one pulls it below.
  assert.ok(venueRunFactor(11, 9, 20) > 1)
  assert.ok(venueRunFactor(7, 9, 20) < 1)
})

test('venueRunFactor shrinks a raw ratio exactly halfway to neutral at VENUE_FACTOR_PRIOR_GAMES games', () => {
  const raw = 11 / 9
  const factor = venueRunFactor(11, 9, VENUE_FACTOR_PRIOR_GAMES)
  assert.ok(Math.abs(factor - (1 + (raw - 1) / 2)) < 1e-9)
})

test('venueRunFactor clamps an extreme raw ratio even at a large sample', () => {
  assert.equal(venueRunFactor(30, 9, 1000), PARK_FACTOR_MAX)
  assert.equal(venueRunFactor(2, 9, 1000), PARK_FACTOR_MIN)
})

// Two well-sampled "anchor" venues (HI averages well above league runs/game,
// LO well below, each hosting 65 games so their factor sits close to the raw
// ratio rather than the small-sample shrinkage — VENUE_FACTOR_PRIOR_GAMES=30
// is well under 65) plus two comparison teams, X and Y, who both finish 5-5
// with IDENTICAL raw runsScored/runsAllowed/runDifferential — the only
// difference is WHERE each of their 10 games happened. THE TRAP this pins:
// giving every one of a team's own games the same run ratio would make the
// park adjustment a no-op in aggregate, for the same scale-invariance reason
// a team-level multiplier is (see teamScoreFormula.js's header comment on
// venueRunFactor) — so X and Y each need two DIFFERENT game shapes (a 9-1
// blowout win and a 1-2 narrow loss), with venues assigned the OPPOSITE way
// between them: X's blowouts at HI / narrow losses at LO, Y's blowouts at LO
// / narrow losses at HI. Real per-venue run factors are genuinely
// heterogeneous (Coors ~1.26, T-Mobile ~0.84), which is what this asymmetry
// stands in for.
function parkFixtureGames() {
  const HI = 9001, LO = 9002
  const C = 401, D = 402, E = 403, F = 404
  const X = 501, OX = 502, Y = 503, OY = 504
  return {
    X,
    Y,
    games: [
      ...repeatedGames({ gamePkStart: 1, homeId: C, awayId: D, count: 55, homeRuns: 7, awayRuns: 3, venueId: HI }),
      ...repeatedGames({ gamePkStart: 101, homeId: E, awayId: F, count: 55, homeRuns: 4, awayRuns: 2, venueId: LO }),
      // X's 5 blowout wins at HI, 5 narrow losses at LO.
      ...repeatedGames({ gamePkStart: 201, homeId: X, awayId: OX, count: 5, homeRuns: 9, awayRuns: 1, venueId: HI }),
      ...repeatedGames({ gamePkStart: 206, homeId: X, awayId: OX, count: 5, homeRuns: 1, awayRuns: 2, venueId: LO }),
      // Y gets the SAME two game shapes at the SWAPPED venues.
      ...repeatedGames({ gamePkStart: 301, homeId: Y, awayId: OY, count: 5, homeRuns: 9, awayRuns: 1, venueId: LO }),
      ...repeatedGames({ gamePkStart: 306, homeId: Y, awayId: OY, count: 5, homeRuns: 1, awayRuns: 2, venueId: HI }),
    ],
  }
}

test('Quality park-adjusts identical raw records differently depending on which venue hosted which games', () => {
  const { X, Y, games } = parkFixtureGames()
  const snapshots = buildTeamScoreSnapshots({ games, asOf: '2026-06-01' })
  const x = snapshots[X].season
  const y = snapshots[Y].season

  // Raw figures are provably untouched by the park adjustment.
  assert.equal(x.wins, y.wins)
  assert.equal(x.runsScored, y.runsScored)
  assert.equal(x.runsAllowed, y.runsAllowed)
  assert.equal(x.runDifferential, y.runDifferential)
  assert.equal(x.runsScored, 50)
  assert.equal(x.runsAllowed, 15)
  assert.equal(x.runDifferential, 35)

  // avgParkFactor is an unweighted mean of the SAME two venue factors for
  // both teams (each plays exactly 5 games at HI and 5 at LO, just with the
  // shapes swapped) — a straight average can't tell the two teams apart,
  // which is exactly why parkAdjustedRunDifferential (below), not this
  // figure alone, is what has to carry the effect.
  assert.equal(x.avgParkFactor, 1)
  assert.equal(y.avgParkFactor, 1)

  // Y's blowout wins happened at the LOW-scoring park (their 9 runs get
  // divided by a below-1 factor, inflating them) while X's blowout wins
  // happened at the HIGH-scoring park (their 9 runs get divided by an
  // above-1 factor, shrinking them) — so despite identical raw stat lines,
  // Y's park-adjusted output comes out ahead.
  assert.ok(y.parkAdjustedRunDifferential > x.parkAdjustedRunDifferential)
  assert.ok(y.pythagWins > x.pythagWins)
  assert.ok(y.score > x.score)

  // Pinned exact values from a real run of buildTeamScoreSnapshots against
  // this fixture (scripts/_check.mjs, deleted after use — see the SOS
  // commit for the same workflow).
  assert.equal(x.parkAdjustedRunDifferential, 28.9)
  assert.equal(y.parkAdjustedRunDifferential, 42.7)
  assert.equal(x.pythagWins, 8.7)
  assert.equal(y.pythagWins, 9.2)
  assert.equal(x.score, 6)
  assert.equal(y.score, 6.1)
})

test('Current Form ignores the park adjustment even over a window straddling both venues', () => {
  // X's own 10 games already straddle HI and LO (5 blowout wins at one, 5
  // narrow losses at the other), and 10 games is exactly CURRENT_FORM_GAMES,
  // so X's whole season IS its current-form window — the same fixture Test B
  // uses, reused here as the regression that nothing leaked into
  // currentFormScoreFromGames via the qualityScoreFromGames core they share.
  const { X, games } = parkFixtureGames()
  const snapshots = buildTeamScoreSnapshots({ games, asOf: '2026-06-01' })
  const form = snapshots[X].currentForm
  const rawPythagWins = round1(pythagoreanPct(50, 15) * 10)
  assert.equal(form.pythagWins, rawPythagWins)
  assert.equal(form.pythagWins, 9)
})

test('a thin two-game sample at a brand-new venue shrinks close to neutral despite an extreme raw ratio', () => {
  const NEW_VENUE = 9003
  const Z = 601, W = 602, P = 701, Q = 702
  const games = [
    // A modest-scoring baseline league so there's a real average to compare
    // against — venueId null, same as a game whose venue never resolved.
    ...repeatedGames({ gamePkStart: 1, homeId: P, awayId: Q, count: 20, homeRuns: 5, awayRuns: 4, venueId: null }),
    // Z's whole sample at the new venue: 2 games, both lopsided 15-3 — an
    // extreme raw ratio a real park would never sustain.
    ...repeatedGames({ gamePkStart: 101, homeId: Z, awayId: W, count: 2, homeRuns: 15, awayRuns: 3, venueId: NEW_VENUE }),
  ]
  const snapshots = buildTeamScoreSnapshots({ games, asOf: '2026-06-01' })
  assert.ok(Math.abs(snapshots[Z].season.avgParkFactor - 1) < 0.1)
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
