// Coverage for the ABS Challenge System data layer: the generator's pure half
// (scripts/lib/abs-challenges.mjs — one feed to rows, rows to the season
// export) and the reader's boards (src/api/around-the-game/absChallenges.js).
//
// Three of these pin traps that were real, not hypothetical, and each one
// fails without the code that closes it:
//
//   1. On a SUCCESSFUL challenge the feed prints the CORRECTED call, so the
//      umpire's own call is the opposite of what is written down. Reading the
//      printed call as his puts every batter in the catcher's column.
//   2. A box-score entry carries the position a man ENDED the game at, so a
//      catcher who moved to first base later reads as neither pitcher nor
//      catcher. Twenty-eight real challenges landed in the `other` bucket
//      that way in the first backfill, Iván Herrera's among them.
//   3. A club's games denominator has to come off the swept-games ledger, not
//      off the challenge rows: a club nobody challenged leaves no row, and a
//      board built from rows alone reports a league of fewer clubs than play
//      in it.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  roleFor,
  umpireCallFor,
  challengeRowsForGame,
  challengerGain,
  summarizeLevel,
  buildExport,
  MISS_BANDS,
} from '../scripts/lib/abs-challenges.mjs'
import {
  levelsIn,
  summaryFor,
  teamBoard,
  umpireBoard,
  playerBoards,
  roleRows,
  callSplitAnomalies,
  missBands,
  ROLE_CALL,
  MIN_PLAYER_CHALLENGES,
} from '../src/api/around-the-game/absChallenges.js'

// --------------------------------------------------------------------------
// umpireCallFor — the printed call is his only when the challenge failed.
// --------------------------------------------------------------------------
test('umpireCallFor: a failed challenge leaves the printed call as the umpire’s', () => {
  assert.deepEqual(umpireCallFor('C', 'fail'), { postStrike: true, callType: 'strike' })
  assert.deepEqual(umpireCallFor('B', 'fail'), { postStrike: false, callType: 'ball' })
})

test('umpireCallFor: a successful challenge flips it — the feed printed the correction', () => {
  // gamePk 823036: Garrett Mitchell's overturned strike prints as a ball.
  assert.deepEqual(umpireCallFor('B', 'success'), { postStrike: false, callType: 'strike' })
  // gamePk 815863: Kyle Hayes's overturned ball prints as a called strike.
  assert.deepEqual(umpireCallFor('C', 'success'), { postStrike: true, callType: 'ball' })
})

test('umpireCallFor: a ball in the dirt is still a ball, and anything else is unreadable', () => {
  assert.equal(umpireCallFor('*B', 'fail').callType, 'ball')
  assert.deepEqual(umpireCallFor('S', 'fail'), { postStrike: null, callType: null })
  assert.deepEqual(umpireCallFor(undefined, 'success'), { postStrike: null, callType: null })
})

// --------------------------------------------------------------------------
// roleFor — who asked for the review.
// --------------------------------------------------------------------------
const feedWithPositions = (positions) => ({
  liveData: {
    boxscore: {
      teams: {
        away: { players: Object.fromEntries(Object.entries(positions).map(([id, p]) => [`ID${id}`, { position: { abbreviation: p } }])) },
        home: { players: {} },
      },
    },
  },
})
const playWith = (batterId, pitcherId) => ({
  matchup: { batter: { id: batterId }, pitcher: { id: pitcherId } },
})

test('roleFor: the matchup names the batter and the pitcher outright', () => {
  const feed = feedWithPositions({})
  assert.equal(roleFor(feed, playWith(1, 2), 'away', 'top', 1), 'batter')
  assert.equal(roleFor(feed, playWith(1, 2), 'home', 'top', 2), 'pitcher')
})

test('roleFor: the box score identifies a catcher still listed at catcher', () => {
  const feed = feedWithPositions({ 9: 'C' })
  assert.equal(roleFor(feed, playWith(1, 2), 'away', 'bottom', 9), 'catcher')
})

test('roleFor: a fielding-side challenger the box score has moved is still the catcher', () => {
  // The real case: a catcher who ends the game at first base or at designated
  // hitter. Only three men may ask for a review, so a fielder who is not the
  // pitcher is the catcher whatever position the box score now prints.
  const feed = feedWithPositions({ 9: '1B' })
  // 'top' bats away, so a HOME challenger is fielding.
  assert.equal(roleFor(feed, playWith(1, 2), 'home', 'top', 9), 'catcher')
  // 'bottom' bats home, so an AWAY challenger is fielding.
  assert.equal(roleFor(feed, playWith(1, 2), 'away', 'bottom', 9), 'catcher')
})

test('roleFor: `other` survives only for what should be impossible', () => {
  const feed = feedWithPositions({ 9: '1B' })
  // A batting-side challenger who is not the batter.
  assert.equal(roleFor(feed, playWith(1, 2), 'away', 'top', 9), 'other')
  // A challenge the feed attributes to nobody at all.
  assert.equal(roleFor(feed, playWith(1, 2), 'away', 'top', null), 'other')
})

// --------------------------------------------------------------------------
// challengeRowsForGame — one game's feed to rows.
// --------------------------------------------------------------------------
// A minimal but honestly-shaped feed: one plate appearance in the top of the
// first, four pitches, an ABS review on the pitch-event of the third. Fields
// are exactly the ones src/api/challenges.js and this module read.
function pitch(n, code, balls, strikes, extra = {}) {
  return {
    isPitch: true,
    pitchNumber: n,
    details: { code },
    count: { balls, strikes },
    pitchData: {
      coordinates: { pX: 0.8, pZ: 2.0 },
      strikeZoneTop: 3.2,
      strikeZoneBottom: 1.6,
    },
    ...extra,
  }
}

const review = (teamId, overturned, playerId, name) => ({
  isOverturned: overturned,
  inProgress: false,
  reviewType: 'MJ',
  challengeTeamId: teamId,
  player: { id: playerId, fullName: name },
})

function oneChallengeFeed({ overturned = true, playerId = 11 } = {}) {
  return {
    gameData: { teams: { away: { id: 100, sport: { id: 1 } }, home: { id: 200 } } },
    liveData: {
      boxscore: { teams: { away: { players: {} }, home: { players: {} } } },
      plays: {
        allPlays: [
          {
            about: { inning: 1, halfInning: 'top', atBatIndex: 0 },
            matchup: { batter: { id: 11 }, pitcher: { id: 22 }, batSide: { code: 'R' } },
            playEvents: [
              pitch(1, 'B', 1, 0),
              pitch(2, 'C', 1, 1),
              pitch(3, 'B', 2, 1, { reviewDetails: review(100, overturned, playerId, 'A Hitter') }),
              pitch(4, 'S', 2, 2),
            ],
            runners: [],
          },
        ],
      },
    },
  }
}

test('challengeRowsForGame: one row per challenge, with the pre-pitch count read back', () => {
  const rows = challengeRowsForGame(oneChallengeFeed(), null)
  assert.equal(rows.length, 1)
  const r = rows[0]
  assert.equal(r.seq, 0)
  assert.equal(r.team_id, 100)
  assert.equal(r.opp_id, 200)
  assert.equal(r.side, 'away')
  assert.equal(r.role, 'batter')
  assert.equal(r.outcome, 'success')
  assert.equal(r.inning, 1)
  assert.equal(r.half, 'top')
  // The printed call on the challenged pitch is a ball, and the challenge
  // succeeded — so the umpire had called a strike.
  assert.equal(r.call_type, 'strike')
  // 0.8 ft outside the plate's own half-width plus a ball radius (0.829 ft),
  // so the nearest edge is 0.35 in away.
  assert.ok(r.miss_inches > 0 && r.miss_inches < 1)
})

test('challengeRowsForGame: a failed challenge keeps the printed call and scores no runs', () => {
  const rows = challengeRowsForGame(oneChallengeFeed({ overturned: false }), null)
  assert.equal(rows[0].outcome, 'fail')
  assert.equal(rows[0].call_type, 'ball')
  assert.equal(rows[0].favor, null)
})

test('challengeRowsForGame: a game with no ABS review produces nothing', () => {
  const feed = oneChallengeFeed()
  delete feed.liveData.plays.allPlays[0].playEvents[2].reviewDetails
  assert.deepEqual(challengeRowsForGame(feed, null), [])
})

test('challengeRowsForGame: run value needs the table, and is null without it', () => {
  // A table whose every state is worth the same is enough to prove the wiring:
  // pitchFavor still returns a number rather than null.
  const flat = { states: {}, re24: { '0-0': { sum: 50, n: 100 } } }
  const withTable = challengeRowsForGame(oneChallengeFeed(), flat)
  assert.equal(typeof withTable[0].favor, 'number')
  assert.equal(challengeRowsForGame(oneChallengeFeed(), null)[0].favor, null)
})

// --------------------------------------------------------------------------
// challengerGain — the sign convention.
// --------------------------------------------------------------------------
test('challengerGain: favor is signed toward the batting side, so a batting challenger flips it', () => {
  // 'top' bats away. The umpire's call had handed the batting side +0.4, and
  // the overturn takes it back — so the away club, batting, gained 0.4.
  assert.equal(challengerGain({ half: 'top', side: 'away', favor: -0.4 }), 0.4)
  // The same call challenged by the fielding club reads the other way.
  assert.equal(challengerGain({ half: 'top', side: 'home', favor: 0.4 }), 0.4)
  assert.equal(challengerGain({ half: 'bottom', side: 'home', favor: -0.4 }), 0.4)
  assert.equal(challengerGain({ half: 'bottom', side: 'away', favor: 0.4 }), 0.4)
})

test('challengerGain: null when the call was never scored', () => {
  assert.equal(challengerGain({ half: 'top', side: 'away', favor: null }), null)
})

// --------------------------------------------------------------------------
// summarizeLevel — the export splits.
// --------------------------------------------------------------------------
const row = (over) => ({
  game_pk: 1, seq: 0, level: 'MLB', date: '2026-04-01', team_id: 100, opp_id: 200,
  side: 'away', player_id: 11, player_name: 'A Hitter', role: 'batter',
  outcome: 'success', inning: 3, half: 'top', umpire_id: 7, umpire_name: 'An Umpire',
  call_type: 'strike', favor: -0.5, miss_inches: 0.5, ...over,
})
const game = (over) => ({
  game_pk: 1, date: '2026-04-01', season: 2026, level: 'MLB',
  away_team_id: 100, home_team_id: 200, umpire_id: 7, challenges: 1, ...over,
})

test('summarizeLevel: totals, rate and the run figures', () => {
  const s = summarizeLevel(
    [row({}), row({ seq: 1, outcome: 'fail', favor: null })],
    [game({ challenges: 2 })],
  )
  assert.equal(s.total, 2)
  assert.equal(s.success, 1)
  assert.equal(s.successRate, 0.5)
  assert.equal(s.games, 1)
  assert.equal(s.perGame, 2)
  assert.equal(s.runsRecovered, 0.5)
  // The away club was batting in the top of the third, so it gained the 0.5.
  assert.equal(s.runsToChallenger, 0.5)
  assert.equal(s.scoredOverturns, 1)
})

test('summarizeLevel: a club nobody challenged still appears, with its games', () => {
  // The home club has no challenge row at all. It must still be on the board:
  // its denominator comes off the ledger, not off the rows.
  const s = summarizeLevel([row({})], [game({}), game({ game_pk: 2, challenges: 0 })])
  const ids = s.byTeam.map((t) => t.teamId)
  assert.deepEqual(ids, [100, 200])
  const home = s.byTeam.find((t) => t.teamId === 200)
  assert.equal(home.games, 2)
  assert.equal(home.n, 0)
  assert.equal(home.rate, null)
  assert.equal(s.gamesWithChallenge, 1)
})

test('summarizeLevel: a club is out of challenges after its SECOND loss, and early before the 7th', () => {
  const lost = (seq, inning) => row({ seq, outcome: 'fail', favor: null, inning })
  const early = summarizeLevel([lost(0, 2), lost(1, 5)], [game({})])
  assert.equal(early.byTeam.find((t) => t.teamId === 100).ranOut, 1)
  assert.equal(early.byTeam.find((t) => t.teamId === 100).ranOutEarly, 1)
  // Emptied in the eighth: run out, but not early.
  const late = summarizeLevel([lost(0, 2), lost(1, 8)], [game({})])
  assert.equal(late.byTeam.find((t) => t.teamId === 100).ranOut, 1)
  assert.equal(late.byTeam.find((t) => t.teamId === 100).ranOutEarly, 0)
  // One loss is not running out.
  const one = summarizeLevel([lost(0, 2)], [game({})])
  assert.equal(one.byTeam.find((t) => t.teamId === 100).ranOut, 0)
})

test('summarizeLevel: distance bands are read from the edge outward', () => {
  const at = (seq, inch) => row({ seq, miss_inches: inch })
  const s = summarizeLevel([at(0, 0.4), at(1, 1.5), at(2, 9)], [game({})])
  const byKey = Object.fromEntries(s.byMiss.map((b) => [b.key, b.n]))
  assert.equal(byKey.b0, 1)
  assert.equal(byKey.b1, 1)
  assert.equal(byKey.b4, 1)
  assert.equal(s.byMiss.length, MISS_BANDS.length)
})

test('summarizeLevel: the biggest overturn is the largest swing, ties going to the later date', () => {
  const s = summarizeLevel(
    [
      row({ seq: 0, favor: -0.2 }),
      row({ seq: 1, favor: -0.9, player_name: 'The Big One' }),
      row({ seq: 2, favor: 0.9, date: '2026-04-02', player_name: 'The Later One' }),
      row({ seq: 3, outcome: 'fail', favor: null, player_name: 'Never' }),
    ],
    [game({})],
  )
  assert.equal(s.biggest.playerName, 'The Later One')
  assert.equal(s.biggest.runs, 0.9)
})

test('summarizeLevel: nothing on file degrades to nulls rather than to zeroes', () => {
  const s = summarizeLevel([], [])
  assert.equal(s.total, 0)
  assert.equal(s.successRate, null)
  assert.equal(s.perGame, null)
  assert.equal(s.biggest, null)
  assert.deepEqual(s.byTeam, [])
})

test('buildExport: levels are split, and a level with no rows is still carried', () => {
  const out = buildExport(
    [row({}), row({ seq: 1, level: 'AAA', team_id: 300 })],
    [game({}), game({ game_pk: 2, level: 'AAA', away_team_id: 300, home_team_id: 400 })],
    { season: 2026, generatedAt: 'now' },
  )
  assert.deepEqual(Object.keys(out.levels).sort(), ['AAA', 'MLB'])
  assert.equal(out.levels.MLB.total, 1)
  assert.equal(out.levels.AAA.total, 1)
  assert.equal(out.season, 2026)
  assert.equal(out.generatedAt, 'now')
})

// --------------------------------------------------------------------------
// The reader's boards.
// --------------------------------------------------------------------------
const data = buildExport(
  [
    row({ seq: 0 }),
    row({ seq: 1, outcome: 'fail', favor: null }),
    row({ seq: 2, team_id: 200, side: 'home', player_id: 33, player_name: 'A Catcher', role: 'catcher', call_type: 'ball' }),
  ],
  [game({})],
  { season: 2026, generatedAt: 'now' },
)

test('levelsIn: only levels with swept games are offered', () => {
  assert.deepEqual(levelsIn(data).map((l) => l.key), ['MLB'])
  assert.deepEqual(levelsIn(null), [])
})

test('teamBoard: ranks on the sorted column, ties sharing the best rank', () => {
  const rows = teamBoard(summaryFor(data, 'MLB'), 'n')
  assert.equal(rows[0].teamId, 100) // two challenges
  assert.equal(rows[0].rank, 1)
  assert.equal(rows[1].rank, 2)
})

test('teamBoard: an unknown sort key falls back to the first column rather than throwing', () => {
  assert.equal(teamBoard(summaryFor(data, 'MLB'), 'nonsense').length, 2)
})

test('umpireBoard: the games floor keeps a thin sample off the board', () => {
  const summary = summaryFor(data, 'MLB')
  assert.deepEqual(umpireBoard(summary), []) // one game worked, floor is 15
  assert.equal(umpireBoard(summary, 'rate', 1).length, 1)
})

test('playerBoards: the rate board takes a floor, the count board does not', () => {
  const summary = summaryFor(data, 'MLB')
  const boards = playerBoards(summary)
  assert.equal(boards.minChallenges, MIN_PLAYER_CHALLENGES)
  assert.equal(boards.qualified, 0)
  assert.deepEqual(boards.byRate, [])
  assert.equal(boards.byCount.length, 2)
  // With the floor dropped to one, both players qualify.
  assert.equal(playerBoards(summary, 1).byRate.length, 2)
})

test('roleRows: a role nobody used is left off', () => {
  const roles = roleRows(summaryFor(data, 'MLB')).map((r) => r.role)
  assert.deepEqual(roles, ['batter', 'catcher'])
})

test('callSplitAnomalies: a batter challenges a strike and a catcher a ball, so nothing disagrees', () => {
  assert.deepEqual(callSplitAnomalies(summaryFor(data, 'MLB')), [])
  assert.equal(ROLE_CALL.batter, 'strike')
  assert.equal(ROLE_CALL.catcher, 'ball')
})

test('callSplitAnomalies: a call the challenger’s job cannot ask for is surfaced, not hidden', () => {
  const odd = buildExport(
    // A batter recorded against a called BALL, which the rule does not allow.
    [row({ seq: 0, call_type: 'ball' })],
    [game({})],
    { season: 2026 },
  )
  const found = callSplitAnomalies(summaryFor(odd, 'MLB'))
  assert.equal(found.length, 2)
})

test('missBands: shares add to one over the challenges that carry a distance', () => {
  const bands = missBands(summaryFor(data, 'MLB'))
  const total = bands.reduce((n, b) => n + (b.share ?? 0), 0)
  assert.ok(Math.abs(total - 1) < 1e-9)
})
