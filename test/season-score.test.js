import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSnapshots,
  expectedHomeWinProbability,
  marcelBaseline,
  seasonScoreFromResidual,
} from '../scripts/gen-season-score.mjs'
import { seasonScoreFor } from '../src/api/seasonScore.js'
import {
  HOME_WIN_PROBABILITY,
  HOME_FIELD_FACTOR_MIN,
  HOME_FIELD_FACTOR_MAX,
  teamHomeFieldFactor,
} from '../src/api/seasonScoreFormula.js'

// Synthetic prior-season standings rows shaped like fetchPriorRecords'
// output (and pinned against a live feed in test/standings.test.js): each
// element is one trailing season's team-record row, or null when a season
// has no data at all.
const priorSeason = (homeWins, homeLosses, roadWins, roadLosses) => ({
  records: {
    splitRecords: [
      { type: 'home', wins: homeWins, losses: homeLosses },
      { type: 'away', wins: roadWins, losses: roadLosses },
    ],
  },
})

test('the schedule expectation gives equal teams a home-field edge (default league constant)', () => {
  // This pins the DEFAULT third-parameter behavior of expectedHomeWinProbability
  // specifically — buildSnapshots itself always passes a team's own factor now.
  const home = expectedHomeWinProbability(81, 81)
  assert.equal(home, 0.54)
  assert.ok(expectedHomeWinProbability(100, 70) > home)
})

test('expectedHomeWinProbability\'s third parameter actually moves the probability when passed', () => {
  assert.ok(expectedHomeWinProbability(81, 81, 0.60) > expectedHomeWinProbability(81, 81, 0.54))
})

test('teamHomeFieldFactor: a roughly-equal home/road split lands close to, but not exactly at, the league constant', () => {
  const factor = teamHomeFieldFactor([
    priorSeason(46, 35, 45, 36),
    priorSeason(44, 37, 43, 38),
    priorSeason(45, 36, 44, 37),
  ])
  assert.notEqual(factor, HOME_WIN_PROBABILITY)
  assert.ok(Math.abs(factor - HOME_WIN_PROBABILITY) < 0.02)
})

test('teamHomeFieldFactor: no prior records at all falls back to the league constant, no NaN', () => {
  assert.equal(teamHomeFieldFactor([]), HOME_WIN_PROBABILITY)
  assert.equal(teamHomeFieldFactor([null, null, null]), HOME_WIN_PROBABILITY)
  assert.equal(teamHomeFieldFactor(undefined), HOME_WIN_PROBABILITY)
})

test('teamHomeFieldFactor: a strong home / weak road split repeated across all 3 prior seasons lands strictly between the league constant and the raw observed split', () => {
  const seasons = [priorSeason(48, 33, 33, 48), priorSeason(48, 33, 33, 48), priorSeason(48, 33, 33, 48)]
  const factor = teamHomeFieldFactor(seasons)
  // Raw observed: home win% = 48/81, road win% = 33/81 -> observed home-field
  // edge = .5 + (48/81 - 33/81)/2 = .5 + 15/162 ~= .5926.
  const rawObserved = 0.5 + (48 / 81 - 33 / 81) / 2
  assert.ok(factor > HOME_WIN_PROBABILITY)
  assert.ok(factor < rawObserved)
})

test('teamHomeFieldFactor: an extreme split still clamps within [HOME_FIELD_FACTOR_MIN, HOME_FIELD_FACTOR_MAX]', () => {
  const strong = teamHomeFieldFactor([priorSeason(81, 0, 0, 81), priorSeason(81, 0, 0, 81), priorSeason(81, 0, 0, 81)])
  const weak = teamHomeFieldFactor([priorSeason(0, 81, 81, 0), priorSeason(0, 81, 81, 0), priorSeason(0, 81, 81, 0)])
  assert.ok(strong <= HOME_FIELD_FACTOR_MAX)
  assert.ok(weak >= HOME_FIELD_FACTOR_MIN)
})

test('teamHomeFieldFactor: a season with no recorded splits degrades to using only the real seasons, not a crash', () => {
  const withGap = teamHomeFieldFactor([priorSeason(50, 31, 40, 41), null, priorSeason(48, 33, 42, 39)])
  const noGap = teamHomeFieldFactor([priorSeason(50, 31, 40, 41), priorSeason(48, 33, 42, 39)])
  assert.equal(withGap, noGap)
  // A record present but with no home/away splitRecords entries degrades the same way.
  const emptySplits = teamHomeFieldFactor([
    priorSeason(50, 31, 40, 41),
    { records: { splitRecords: [] } },
    priorSeason(48, 33, 42, 39),
  ])
  assert.equal(emptySplits, noGap)
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

// End-to-end fixture on buildSnapshots itself, distinct from the pure-function
// unit tests above. Both expectedHomeWinProbability's new homeFieldFactor
// parameter and buildSnapshots' new homeFieldByTeam parameter are optional
// with silent defaults, so a future refactor could accidentally stop
// threading homeFieldByTeam through (e.g. in buildDate) and EVERY pure-function
// unit test above would still pass — teamHomeFieldFactor and
// expectedHomeWinProbability would each still work correctly in isolation —
// while the feature was silently inert in production. Only a test that forces
// the values through the whole buildSnapshots call, the way buildDate really
// calls it, would catch that regression.
test('buildSnapshots: two teams with identical opponents and identical game shape diverge once given different home-field factors', () => {
  const TEAM_X = 10
  const TEAM_Y = 20
  const OPPONENT = 30
  const baselines = {
    [TEAM_X]: { wins: 81, kind: 'market' },
    [TEAM_Y]: { wins: 81, kind: 'market' },
    [OPPONENT]: { wins: 81, kind: 'market' },
  }
  const gamesFor = (homeId) =>
    ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05'].map((date, i) => ({
      gamePk: `${homeId}-${i}`,
      date,
      homeId,
      awayId: OPPONENT,
      homeWon: i % 2 === 0, // identical W-L-W-L-W shape for both teams
    }))

  const snapshots = buildSnapshots({
    asOf: '2026-04-06',
    baselines,
    standings: {},
    games: [...gamesFor(TEAM_X), ...gamesFor(TEAM_Y)],
    homeFieldByTeam: { [TEAM_X]: 0.6, [TEAM_Y]: 0.5 },
  })

  // Same opponent, same baselines, same win/loss shape -> under the OLD flat-
  // constant behavior these would be identical. They now diverge because only
  // the home-field factor differs.
  assert.equal(snapshots[TEAM_X].wins, snapshots[TEAM_Y].wins)
  assert.equal(snapshots[TEAM_X].losses, snapshots[TEAM_Y].losses)
  assert.notEqual(snapshots[TEAM_X].expectedWinsToDate, snapshots[TEAM_Y].expectedWinsToDate)
  assert.notEqual(snapshots[TEAM_X].residualWins, snapshots[TEAM_Y].residualWins)
  assert.notEqual(snapshots[TEAM_X].score, snapshots[TEAM_Y].score)

  // The transparency field round-trips through the real snapshot object.
  assert.equal(snapshots[TEAM_X].homeFieldFactor, 0.6)
  assert.equal(snapshots[TEAM_Y].homeFieldFactor, 0.5)
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

test('earnedPaceWins reads the feed\'s nested records.expectedRecords, not a top-level key', () => {
  // Regression guard for the gen-season-score.mjs fix in PR #321: the real
  // statsapi feed nests expectedRecords under `records`, never top-level.
  // Plants a DECOY top-level expectedRecords with a different value — if
  // pythagoreanPace regresses to reading the wrong (buggy, pre-fix) location,
  // this decoy is what would get picked up instead, and the assertion fails.
  const snapshots = buildSnapshots({
    asOf: '2026-04-03',
    baselines: {
      1: { wins: 81, kind: 'market' },
      2: { wins: 81, kind: 'market' },
    },
    standings: {
      1: {
        records: { expectedRecords: [{ type: 'xWinLoss', wins: 6, losses: 4 }] },
        expectedRecords: [{ type: 'xWinLoss', wins: 1, losses: 9 }],
      },
    },
    games: [
      { gamePk: 1, date: '2026-04-01', homeId: 1, awayId: 2, homeWon: true },
      { gamePk: 2, date: '2026-04-02', homeId: 2, awayId: 1, homeWon: false },
    ],
  })
  assert.equal(snapshots[1].earnedPaceWins, 97.2) // (6/10)*162, from the correctly-nested record
})

test('earnedPaceWins falls back to the runs-based Pythagorean split when a team has no records object at all (thin early-season feed)', () => {
  const snapshots = buildSnapshots({
    asOf: '2026-04-03',
    baselines: {
      1: { wins: 81, kind: 'market' },
      2: { wins: 81, kind: 'market' },
    },
    standings: {
      1: { runsScored: 20, runsAllowed: 10 },
    },
    games: [{ gamePk: 1, date: '2026-04-01', homeId: 1, awayId: 2, homeWon: true }],
  })
  assert.ok(Number.isFinite(snapshots[1].earnedPaceWins))
  assert.ok(snapshots[1].earnedPaceWins > 81) // outscoring opponents 2:1 should project a pace above .500
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
