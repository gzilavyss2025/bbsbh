// Coverage for the ABS Challenge System data layer: the generator's pure half
// (scripts/lib/abs/ — rows.mjs turns one feed into rows, export.mjs turns
// rows into the season export) and the reader's boards
// (src/api/around-the-game/absChallenges.js).
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
  isPlayedGame,
  replayBank,
  bankHolds,
  armedAt,
  auditBank,
  challengeRowsForGame,
  challengerGain,
  inningsFromOuts,
  exposureRowsFor,
  exposureByPlayer,
  exposureRates,
  summarizeLevel,
  buildExport,
  MISS_BANDS,
} from '../scripts/lib/abs/index.mjs'
import {
  levelsIn,
  summaryFor,
  teamBoard,
  umpireBoard,
  playerBoards,
  roleRows,
  callSplitAnomalies,
  callSplitOffBy,
  missBands,
  ROLE_CALL,
  MIN_PLAYER_CHALLENGES,
} from '../src/api/around-the-game/absChallenges.js'

// --------------------------------------------------------------------------
// replayBank — a club is armed again in extra innings.
// --------------------------------------------------------------------------
// The regulation rule — two issued, one kept per overturn, out after the
// SECOND loss — is not the whole rule, and the season's own rows say so: 54
// club-games carry a THIRD failed challenge, every one of them in extras, and
// none in regulation.
//
// The obvious check does not check anything. `gameData.absChallenges.remaining`
// equals max(0, 2 - usedFailed) on 342 of 342 club-sides, with no exceptions —
// it is derived from the failure count, not a tracked balance — so a model
// reconciled against it would pass while being wrong. These assert against the
// ROWS instead, which is where the rule is actually visible.
const L = (inning, half = 'top') => ({ inning, half, outcome: 'fail' })
const W = (inning, half = 'top') => ({ inning, half, outcome: 'success' })

test('replayBank: two losses empty a club, and in regulation that is the end of it', () => {
  const b = replayBank([L(3), L(7)], 9)
  assert.equal(b.held, 0)
  assert.equal(b.toppedUp, 0)
  assert.deepEqual(b.emptiedIn, [7])
  assert.equal(b.atStart.get(8), 0)
  assert.equal(b.atStart.get(9), 0)
})

test('replayBank: an overturn is paid for and handed straight back', () => {
  // Four overturns cost nothing in the end, but each one is SPENT first — a
  // club with none left cannot ask, win or lose. Four wins leave it on two.
  const b = replayBank([W(1), W(2), W(3), W(4)], 9)
  assert.equal(b.held, 2)
  assert.deepEqual(b.emptiedIn, [])
  assert.equal(b.overdrawn, 0)
})

test('replayBank: the order matters, which a failure count cannot see', () => {
  // Same two losses and one overturn, two different nights. `W L L` is
  // spendable out of a bank of two; `L L W` asks for a fourth challenge the
  // club does not hold. gamePk 816599 is the real one: both clubs end on one
  // overturn and two losses, and only team 416 overdraws.
  assert.equal(replayBank([W(1), L(5), L(9)], 9).overdrawn, 0)
  assert.equal(replayBank([L(1), L(5), W(9)], 9).overdrawn, 1)
})

test('replayBank: a club that ran out is armed again in the tenth', () => {
  // gamePk 822685 (MLB): the club lost at the 2nd, the 3rd and the 10th. A
  // third loss is impossible out of a two-challenge bank.
  const b = replayBank([L(2), L(3), L(10)], 10)
  assert.equal(b.atStart.get(9), 0)
  assert.equal(b.atStart.get(10), 1)
  assert.equal(b.toppedUp, 1)
  assert.equal(b.overdrawn, 0)
})

test('replayBank: one top-up is not enough — the five-loss game needs three', () => {
  // gamePk 815625 (Triple-A): losses at the 3rd, 4th, 10th, 12th and 13th of a
  // thirteen-inning game. The only club-game in the season above three, and
  // the one that rules out a single replenishment.
  const b = replayBank([L(3), L(4), L(10), L(12), L(13)], 13)
  assert.equal(b.toppedUp, 3)
  assert.equal(b.overdrawn, 0)
  // Armed at the start of every extra inning, spent in three of the four.
  for (const inning of [10, 11, 12, 13]) assert.equal(b.atStart.get(inning), 1)
})

test('replayBank: an extra inning a club enters holding one does not add a second', () => {
  // gamePk 816215 (Triple-A): losses at the 10th, the 10th again, and the
  // 11th. The club reached the tenth with BOTH still in hand — it had not
  // challenged in regulation — so the two in one inning are its own, not a
  // top-up, and only the eleventh tops it back up.
  const b = replayBank([L(10), L(10, 'bottom'), L(11)], 11)
  assert.equal(b.atStart.get(10), 2)
  assert.equal(b.atStart.get(11), 1)
  assert.equal(b.toppedUp, 1)
  assert.equal(b.overdrawn, 0)
})

test('replayBank: overdrawing is counted and carried, never thrown', () => {
  // Three losses in regulation cannot happen. If the rows ever say it did, the
  // model is wrong about the rule and this is how it says so — floored at
  // zero, counted, carried on, because two real club-games do exactly this and
  // a replay that threw would take the season's export down over two rows.
  const b = replayBank([L(2), L(4), L(6)], 9)
  assert.equal(b.overdrawn, 1)
  assert.equal(b.held, 0)
  assert.equal(bankHolds([L(2), L(4), L(6)], 9), false)
  assert.equal(bankHolds([L(2), L(4), L(10)], 10), true)
})

test('replayBank: an emptying the club immediately undid is not one', () => {
  // Lost in the 3rd, then asked again in the 3rd and won: the bank touched
  // zero and was back to one before the inning was out. That is not a club
  // that ran out.
  assert.deepEqual(replayBank([L(3), W(3, 'bottom')], 9).emptiedIn, [])
  assert.deepEqual(replayBank([L(3), L(3, 'bottom')], 9).emptiedIn, [3])
})

test('replayBank: without the game length it replays only what happened', () => {
  // The ledger does not carry a game's length yet. Given none, the replay runs
  // to the last inning the club challenged in — enough to replay every
  // emptying the rows can see, and not enough to claim a club was re-armed in
  // an extra inning it never challenged in.
  assert.equal(replayBank([L(2), L(3), L(10)]).innings, 10)
  assert.equal(replayBank([L(2), L(3), L(10)]).toppedUp, 1)
  // A club that emptied in the fifth of a game that went to the twelfth: with
  // no length, the replay stops at the fifth and claims no top-up.
  assert.equal(replayBank([L(1), L(5)]).toppedUp, 0)
  assert.equal(replayBank([L(1), L(5)], 12).toppedUp, 1)
})

test('auditBank: the standing check names the club-game and the order it spent in', () => {
  const rows = [
    // A club that lost three in regulation — impossible under the rule.
    { game_pk: 1, team_id: 10, outcome: 'fail', inning: 2, half: 'top' },
    { game_pk: 1, team_id: 10, outcome: 'fail', inning: 4, half: 'top' },
    { game_pk: 1, team_id: 10, outcome: 'fail', inning: 6, half: 'top' },
    // The same three losses, the last one in extras — fine.
    { game_pk: 2, team_id: 11, outcome: 'fail', inning: 2, half: 'top' },
    { game_pk: 2, team_id: 11, outcome: 'fail', inning: 4, half: 'top' },
    { game_pk: 2, team_id: 11, outcome: 'fail', inning: 11, half: 'top' },
    // Four overturns never empty a club, however many it asks for.
    { game_pk: 3, team_id: 12, outcome: 'success', inning: 1, half: 'top' },
    { game_pk: 3, team_id: 12, outcome: 'success', inning: 2, half: 'top' },
    { game_pk: 3, team_id: 12, outcome: 'success', inning: 3, half: 'top' },
    { game_pk: 3, team_id: 12, outcome: 'success', inning: 4, half: 'top' },
  ]
  assert.deepEqual(auditBank(rows), [
    { gamePk: 1, teamId: 10, overdrawn: 1, order: '2L 4L 6L' },
  ])
})

test('auditBank: the two club-games that are MLB’s own data are named, not floored', () => {
  // gamePk 816599 team 416 spent `1L 5L 9W` — the 9th-inning overturn had to
  // be paid for out of a bank the 5th had already emptied. Checked row by row
  // against the feed; the other club in the same game comes out legal. Listed
  // rather than silently allowed, so a THIRD entry means MLB moved the rule.
  const real = [
    { game_pk: 816599, team_id: 416, outcome: 'fail', inning: 1, half: 'top' },
    { game_pk: 816599, team_id: 416, outcome: 'fail', inning: 5, half: 'top' },
    { game_pk: 816599, team_id: 416, outcome: 'success', inning: 9, half: 'top' },
  ]
  assert.equal(replayBank(real).overdrawn, 1)
  assert.deepEqual(auditBank(real), [])
  // The same shape under any other gamePk is still reported.
  const other = real.map((r) => ({ ...r, game_pk: 999999 }))
  assert.equal(auditBank(other).length, 1)
})

test('armedAt: the question the chances denominator asks of a half-inning', () => {
  const cs = [L(2), L(3), L(10)]
  assert.equal(armedAt(cs, 1, 10), true)
  assert.equal(armedAt(cs, 3, 10), true) // it still held one entering the 3rd
  assert.equal(armedAt(cs, 4, 10), false)
  assert.equal(armedAt(cs, 9, 10), false)
  assert.equal(armedAt(cs, 10, 10), true) // armed again
})

// --------------------------------------------------------------------------
// isPlayedGame — which games are allowed onto the denominator.
// --------------------------------------------------------------------------
// The ledger is what every per-game figure divides by, so a game that was
// never played does not sit there harmlessly. These five are the ONLY
// `codedGameState` values the whole 2026 MLB and Triple-A schedule takes, and
// each object below is the real status the schedule returns for the gamePk
// named beside it, field for field.
const STATUS = {
  // gamePk 824940 — an ordinary game, played and played out.
  final: {
    abstractGameState: 'Final',
    codedGameState: 'F',
    detailedState: 'Final',
    statusCode: 'F',
    startTimeTBD: false,
    abstractGameCode: 'F',
  },
  // gamePk 824295 — rain stopped it after nine half-innings. A REAL game: it
  // carries four challenges, and they belong on the board.
  completedEarly: {
    abstractGameState: 'Final',
    codedGameState: 'F',
    detailedState: 'Completed Early',
    statusCode: 'FR',
    startTimeTBD: false,
    reason: 'Rain',
    abstractGameCode: 'F',
  },
  // gamePk 814842 — called off for weather. Zero innings, zero plays, and an
  // abstract state of Final, which is how 23 of these reached the Triple-A
  // ledger under the old abstract-Final rule.
  cancelled: {
    abstractGameState: 'Final',
    codedGameState: 'C',
    detailedState: 'Cancelled',
    statusCode: 'CR',
    startTimeTBD: false,
    reason: 'Rain',
    abstractGameCode: 'F',
  },
  // gamePk 815811 — the one that changed its mind after being swept. It was
  // postponed, replayed the next day, suspended by rain after two innings, and
  // then cancelled outright. Its FEED still reads `Suspended: Rain` with an
  // abstract state of Live; its schedule row reads this. Two innings and one
  // challenge sat in the ledger as a whole game until --recheck evicted it.
  suspendedThenCancelled: {
    abstractGameState: 'Final',
    codedGameState: 'C',
    detailedState: 'Cancelled',
    statusCode: 'CR',
    startTimeTBD: true,
    reason: 'Rain',
    abstractGameCode: 'F',
  },
  // gamePk 824621 — never played on that date.
  postponed: {
    abstractGameState: 'Final',
    codedGameState: 'D',
    detailedState: 'Postponed',
    statusCode: 'DI',
    startTimeTBD: false,
    reason: 'Inclement Weather',
    abstractGameCode: 'F',
  },
  // gamePk 824382 — not played yet.
  scheduled: {
    abstractGameState: 'Preview',
    codedGameState: 'S',
    detailedState: 'Scheduled',
    statusCode: 'S',
    startTimeTBD: false,
    abstractGameCode: 'P',
  },
}

test('isPlayedGame: a game that happened is admitted, shortened by rain or not', () => {
  assert.equal(isPlayedGame(STATUS.final), true)
  assert.equal(isPlayedGame(STATUS.completedEarly), true)
})

test('isPlayedGame: a cancelled game is not a game, whatever its abstract state says', () => {
  // Both of these read `abstractGameState: 'Final'`. That is the trap the old
  // rule fell into, and the reason the test asserts it here rather than only
  // asserting the result.
  assert.equal(STATUS.cancelled.abstractGameState, 'Final')
  assert.equal(STATUS.suspendedThenCancelled.abstractGameState, 'Final')
  assert.equal(isPlayedGame(STATUS.cancelled), false)
  assert.equal(isPlayedGame(STATUS.suspendedThenCancelled), false)
})

test('isPlayedGame: postponed and not-yet-played stay out', () => {
  assert.equal(isPlayedGame(STATUS.postponed), false)
  assert.equal(isPlayedGame(STATUS.scheduled), false)
})

test('isPlayedGame: the detailed string is never read, so a new reason cannot leak in', () => {
  // Every detailed state carries its reason — `Cancelled: Rain`,
  // `Completed Early: Rain` — so matching on it means every new reason is a
  // new string nobody knew to exclude. A reason MLB has not invented yet,
  // against a coded state that is not F, still stays out.
  assert.equal(isPlayedGame({ ...STATUS.cancelled, detailedState: 'Cancelled: Locusts' }), false)
  assert.equal(isPlayedGame({ codedGameState: 'F', detailedState: 'Something New' }), true)
})

test('isPlayedGame: a missing status is not a played game', () => {
  assert.equal(isPlayedGame(undefined), false)
  assert.equal(isPlayedGame(null), false)
  assert.equal(isPlayedGame({}), false)
})

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
// exposure — how much baseball a man saw.
// --------------------------------------------------------------------------
// The denominator questions 5 and 6 need, and the one new fetch in the whole
// job. Every fixture below is the real shape returned by
//   /api/v1/teams/{id}/roster?rosterType=fullSeason&season=2026
//     &hydrate=person(stats(type=season,group=[hitting,fielding],season=2026,sportId=1))
// for the player named beside it, checked against the live API before any of
// this was relied on.

test('inningsFromOuts: MLB writes innings in OUTS, not in decimals', () => {
  // William Contreras caught "1020.2" — that is 1020 and TWO THIRDS. Across a
  // whole Brewers roster the only fractional parts that appear are 0, 1 and 2,
  // which is what proves the notation.
  assert.equal(inningsFromOuts('1020.2'), 1020 + 2 / 3)
  assert.equal(inningsFromOuts('28.0'), 28)
  assert.equal(inningsFromOuts('7.1'), 7 + 1 / 3)
  assert.equal(inningsFromOuts('0.0'), 0)
  assert.equal(inningsFromOuts('45'), 45)
  // parseFloat would have said 1020.2 — half an inning light on one catcher.
  assert.notEqual(inningsFromOuts('1020.2'), 1020.2)
})

test('inningsFromOuts: anything that is not outs notation is null, not a guess', () => {
  // A third of an inning written as .3 would mean the notation had changed
  // under us, and a silent parseFloat would carry the change through.
  assert.equal(inningsFromOuts('7.3'), null)
  assert.equal(inningsFromOuts('7.9'), null)
  assert.equal(inningsFromOuts(''), null)
  assert.equal(inningsFromOuts(null), null)
  assert.equal(inningsFromOuts(undefined), null)
  assert.equal(inningsFromOuts('-3.1'), null)
})

// A roster entry, shaped like the live response.
const person = (id, name, pos, groups) => ({
  position: { abbreviation: pos },
  person: { id, fullName: name, stats: groups },
})
const hitting = (splits) => ({ group: { displayName: 'hitting' }, splits })
const fielding = (splits) => ({ group: { displayName: 'fielding' }, splits })

test('exposureRowsFor: a catcher who also hits carries BOTH denominators', () => {
  // William Contreras, Brewers (158): 2,152 pitches seen at the plate, and
  // 1020.2 innings caught plus 18 games at DH that are not catching.
  const rows = exposureRowsFor(
    {
      roster: [
        person(1, 'William Contreras', 'C', [
          hitting([{ team: { id: 158 }, stat: { numberOfPitches: 2152, plateAppearances: 602 } }]),
          fielding([
            { team: { id: 158 }, position: { abbreviation: 'C' }, stat: { gamesStarted: 114, innings: '1020.2', games: 120 } },
            { team: { id: 158 }, position: { abbreviation: 'DH' }, stat: { gamesStarted: 18, innings: '0.0', games: 18 } },
          ]),
        ]),
      ],
    },
    { season: 2026, level: 'MLB', teamId: 158 },
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].pitches, 2152)
  assert.equal(rows[0].plate_appearances, 602)
  assert.equal(rows[0].catcher_innings, 1020 + 2 / 3)
  // The DH split is not catching, so it adds nothing to either catcher column.
  assert.equal(rows[0].catcher_starts, 114)
})

test('exposureRowsFor: a traded player is credited to the right club, never the aggregate', () => {
  // Bo Naylor's hitting group reads 94 PA with NO `team` key at all — the
  // aggregate, listed FIRST — then 90 for Cleveland (114) and 4 for Milwaukee
  // (158). Reading the first split would credit Milwaukee with all 94.
  const roster = {
    roster: [
      person(2, 'Bo Naylor', 'C', [
        hitting([
          { stat: { numberOfPitches: 400, plateAppearances: 94 } },
          { team: { id: 114 }, stat: { numberOfPitches: 380, plateAppearances: 90 } },
          { team: { id: 158 }, stat: { numberOfPitches: 20, plateAppearances: 4 } },
        ]),
      ]),
    ],
  }
  const brewers = exposureRowsFor(roster, { season: 2026, level: 'MLB', teamId: 158 })
  assert.equal(brewers[0].plate_appearances, 4)
  assert.equal(brewers[0].pitches, 20)
  // The same response read as Cleveland's gives Cleveland's half, so each
  // club's own call writes only its own rows.
  const guardians = exposureRowsFor(roster, { season: 2026, level: 'MLB', teamId: 114 })
  assert.equal(guardians[0].plate_appearances, 90)
  // And the two halves are the aggregate, which is the check that nothing was
  // double-counted or dropped.
  assert.equal(brewers[0].plate_appearances + guardians[0].plate_appearances, 94)
})

test('exposureRowsFor: a pitcher with no hitting split is null, never zero', () => {
  // Null divides to "no rate"; zero divides to Infinity. 93 of 102 MLB
  // pitchers who challenged have neither denominator, and that is correct.
  const rows = exposureRowsFor(
    {
      roster: [
        person(3, 'A Reliever', 'P', [
          fielding([{ team: { id: 158 }, position: { abbreviation: 'P' }, stat: { gamesStarted: 0, innings: '64.1' } }]),
        ]),
      ],
    },
    { season: 2026, level: 'MLB', teamId: 158 },
  )
  assert.equal(rows[0].pitches, null)
  assert.equal(rows[0].plate_appearances, null)
  // He pitched, but he did not CATCH, so the catcher columns stay empty too.
  assert.equal(rows[0].catcher_innings, null)
  assert.equal(rows[0].catcher_starts, null)
})

test('exposureRowsFor: a man who never challenged still gets a row', () => {
  // Half of question 5 is "how many qualified hitters never asked at all", and
  // a table built from the challenge rows cannot see them — they leave no row
  // there. Four qualified MLB hitters are in this position.
  const rows = exposureRowsFor(
    {
      roster: [
        person(4, 'A Quiet Hitter', '1B', [
          hitting([{ team: { id: 158 }, stat: { numberOfPitches: 2000, plateAppearances: 500 } }]),
        ]),
      ],
    },
    { season: 2026, level: 'MLB', teamId: 158 },
  )
  assert.equal(rows.length, 1)
  assert.equal(rows[0].plate_appearances, 500)
  assert.equal(rows[0].name, 'A Quiet Hitter')
})

test('exposureRowsFor: an empty or malformed roster yields nothing rather than throwing', () => {
  const opts = { season: 2026, level: 'MLB', teamId: 158 }
  assert.deepEqual(exposureRowsFor({ roster: [] }, opts), [])
  assert.deepEqual(exposureRowsFor({}, opts), [])
  assert.deepEqual(exposureRowsFor(null, opts), [])
  // An entry with no person id is skipped, not written with a null key.
  assert.deepEqual(exposureRowsFor({ roster: [{ person: {} }] }, opts), [])
})

test('exposureByPlayer: a traded man is asked how often HE argues, so his clubs add up', () => {
  const total = exposureByPlayer([
    { player_id: 2, pitches: 380, plate_appearances: 90, catcher_innings: 600, catcher_starts: 70 },
    { player_id: 2, pitches: 20, plate_appearances: 4, catcher_innings: 30, catcher_starts: 3 },
  ])
  assert.deepEqual(total.get(2), {
    pitches: 400, plateAppearances: 94, catcherInnings: 630, catcherStarts: 73,
  })
})

test('exposureByPlayer: a null column stays null rather than becoming a zero', () => {
  const total = exposureByPlayer([
    { player_id: 3, pitches: null, plate_appearances: null, catcher_innings: null, catcher_starts: null },
  ])
  assert.deepEqual(total.get(3), {
    pitches: null, plateAppearances: null, catcherInnings: null, catcherStarts: null,
  })
})

test('exposureRates: each rate takes ONLY the challenges its own denominator explains', () => {
  // THE TRAP THIS MODULE EXISTS FOR. Francisco Alvarez called for 102 reviews
  // — 22 at the plate and 80 behind it. Dividing all 102 by the pitches he saw
  // as a BATTER invents a man who argues with every other pitch he sees, and
  // it is what put a catcher at the top of the "most eager hitter" board.
  const r = exposureRates(
    { batter: 22, catcher: 80 },
    { pitches: 1635, plateAppearances: 400, catcherInnings: 674, catcherStarts: 74 },
  )
  assert.equal(r.asBatter, 22)
  assert.equal(r.asCatcher, 80)
  assert.equal(r.per1000Pitches.toFixed(2), '13.46') // not 62.39
  assert.equal(r.per9Caught.toFixed(3), '1.068')
  // Neither rate borrows the other's numerator.
  assert.notEqual(r.per1000Pitches, (102 / 1635) * 1000)
})

test('exposureRates: no denominator is null, which is not the same as no challenges', () => {
  // "He never batted" and "he batted and never asked" are different facts, and
  // a board that printed both as 0.0 would lose the more interesting one.
  const none = exposureRates({ batter: 4 }, { pitches: null, catcherInnings: null })
  assert.equal(none.per1000Pitches, null)
  assert.equal(none.per9Caught, null)
  // A denominator of nought is no opportunity, so it is no number either —
  // never Infinity.
  assert.equal(exposureRates({ batter: 1 }, { pitches: 0 }).per1000Pitches, null)
  // A man with a denominator and no challenges of that kind is a real zero.
  assert.equal(exposureRates({ catcher: 9 }, { pitches: 1000 }).per1000Pitches, 0)
  // And nothing at all does not throw.
  assert.equal(exposureRates(null, null).per1000Pitches, null)
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

// callSplitOffBy — how many challenges the disagreement is worth. The first of
// these fails against the old arithmetic, which added the disagreeing rows'
// `n` and so reported 21 challenges for one bad row (4,813 on the real
// Triple-A board). The second pins the case that arithmetic got right by luck,
// and the one a plain sum of `off` would get wrong in the other direction.
test('callSplitOffBy: a challenger at no recognisable position is ONE challenge off, not a bucket', () => {
  // The Triple-A board's real case. Twenty batters challenging called strikes,
  // twenty catchers challenging called balls, and one man the box score put at
  // no position anybody can read — whose challenge still lands in the ball
  // column. The ball bucket is then 21 against the 20 the roles predict.
  const rows = []
  for (let i = 0; i < 20; i += 1) rows.push(row({ seq: i, player_id: 100 + i }))
  for (let i = 0; i < 20; i += 1) {
    rows.push(row({ seq: 100 + i, player_id: 200 + i, role: 'catcher', call_type: 'ball' }))
  }
  rows.push(row({ seq: 999, player_id: 999, role: 'other', call_type: 'ball' }))

  const summary = summaryFor(buildExport(rows, [game({ challenges: 41 })], { season: 2026 }), 'MLB')
  const found = callSplitAnomalies(summary)
  assert.equal(found.length, 1)
  assert.equal(found[0].callType, 'ball')
  assert.equal(found[0].n, 21)
  assert.equal(callSplitOffBy(found), 1)
})

test('callSplitOffBy: a misfiled challenge moves two buckets and is still one challenge', () => {
  // A batter recorded against a called BALL. It is absent from the strike
  // bucket the roles predict AND present in the ball bucket they do not, so
  // both rows disagree — by one challenge between them, not two.
  const found = callSplitAnomalies(
    summaryFor(buildExport([row({ call_type: 'ball' })], [game({})], { season: 2026 }), 'MLB'),
  )
  assert.equal(found.length, 2)
  assert.deepEqual(
    found.map((c) => c.off).sort((a, b) => a - b),
    [-1, 1],
  )
  assert.equal(callSplitOffBy(found), 1)
})

test('callSplitOffBy: a season that holds the rule is nothing off', () => {
  assert.equal(callSplitOffBy(callSplitAnomalies(summaryFor(data, 'MLB'))), 0)
})

test('missBands: shares add to one over the challenges that carry a distance', () => {
  const bands = missBands(summaryFor(data, 'MLB'))
  const total = bands.reduce((n, b) => n + (b.share ?? 0), 0)
  assert.ok(Math.abs(total - 1) < 1e-9)
})
