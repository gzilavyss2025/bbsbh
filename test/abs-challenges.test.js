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
  firstExtraInning,
  gameShape,
  halfPlayed,
  halvesPlayed,
  chancesByInning,
  halfKey,
  challengeRowsForGame,
  challengerGain,
  inningsFromOuts,
  exposureRowsFor,
  exposureByPlayer,
  exposureRates,
  hasExposure,
  ranOutBoard,
  momentumCuts,
  streaksByPlayer,
  streakBoards,
  STREAK_TOP,
  summarizeLevel,
  buildExport,
  buildExposureExport,
  buildExposureClubsExport,
  MISS_BANDS,
} from '../scripts/lib/abs/index.mjs'
import {
  levelsIn,
  summaryFor,
  teamBoard,
  umpireBoard,
  umpireTails,
  umpireSpread,
  UMPIRE_SORTS,
  UMPIRE_TAIL,
  playerBoards,
  roleRows,
  callSplitAnomalies,
  callSplitOffBy,
  missBands,
  inningSeries,
  roleInnings,
  roleSpan,
  ranOutNights,
  ranOutSeries,
  streakBoard,
  streakRoles,
  inGameLossCap,
  momentum,
  momentumLevels,
  RAN_OUT_EARLY_THROUGH,
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
// firstExtraInning — extras do not start at the tenth everywhere.
// --------------------------------------------------------------------------
// 171 Triple-A games on file are seven-inning doubleheader games, and in those
// the eighth IS the extra inning. Nothing shipped was wrong while the bank was
// replayed without a length; the chances denominator passes one on every game,
// which is what makes this matter.
test('firstExtraInning: the tenth in a nine-inning game, the eighth in a seven', () => {
  assert.equal(firstExtraInning(9), 10)
  assert.equal(firstExtraInning(7), 8)
  // A caller that does not know gets the nine-inning answer.
  assert.equal(firstExtraInning(null), 10)
  assert.equal(firstExtraInning(undefined), 10)
})

test('firstExtraInning: a club that emptied in the 7th of a SEVEN-inning game is armed in the 8th', () => {
  // gamePk 816247 is the real shape: scheduledInnings 7, currentInning 8.
  const spent = [
    { inning: 3, half: 'top', outcome: 'fail' },
    { inning: 7, half: 'top', outcome: 'fail' },
  ]
  // Told the game's real length, the rule re-arms it — this is the answer that
  // was wrong 15 times on the season before scheduled_innings was stored.
  assert.equal(armedAt(spent, 8, 8, 7), true)
  // Left to assume nine innings, the model calls it unarmed.
  assert.equal(armedAt(spent, 8, 8, null), false)
})

// --------------------------------------------------------------------------
// gameShape — the three columns, read off a linescore.
// --------------------------------------------------------------------------
// The same object arrives from a game feed (liveData.linescore) and from a
// schedule row hydrated with `linescore`. Each fixture below is the real shape
// the API returns for the gamePk named beside it.
test('gameShape: a home club that never batted in the ninth has no `runs` KEY', () => {
  // gamePk 824872 — the home club led after the top of the ninth.
  const shape = gameShape({
    currentInning: 9,
    scheduledInnings: 9,
    isTopInning: true,
    innings: [{ num: 9, home: { hits: 0, errors: 0, leftOnBase: 0 } }],
  })
  assert.deepEqual(shape, { finalInning: 9, bottomPlayed: 0, scheduledInnings: 9 })
})

test('gameShape: a home club retired in order carries `runs: 0`, and DID bat', () => {
  // gamePk 823413. This is the pair the rule turns on: a reader that tested
  // `home.runs > 0` would drop every scoreless home half in the season.
  const shape = gameShape({
    currentInning: 9,
    scheduledInnings: 9,
    isTopInning: false,
    innings: [{ num: 9, home: { runs: 0, hits: 0, errors: 0, leftOnBase: 0 } }],
  })
  assert.equal(shape.bottomPlayed, 1)
})

test('gameShape: a seven-inning game that went to the eighth keeps both lengths', () => {
  // gamePk 816247 — a Triple-A doubleheader game, scheduled for seven.
  const shape = gameShape({
    currentInning: 8,
    scheduledInnings: 7,
    innings: [{ num: 8, home: { runs: 1 } }],
  })
  assert.deepEqual(shape, { finalInning: 8, bottomPlayed: 1, scheduledInnings: 7 })
})

test('gameShape: a game that was never played has no shape at all', () => {
  // gamePk 815811 (cancelled) and 816704 (postponed) both carry an empty
  // linescore. isPlayedGame already keeps them off the ledger; this is the
  // belt to that brace.
  assert.deepEqual(gameShape({}), {
    finalInning: null, bottomPlayed: null, scheduledInnings: null,
  })
  assert.deepEqual(gameShape(undefined), {
    finalInning: null, bottomPlayed: null, scheduledInnings: null,
  })
})

// --------------------------------------------------------------------------
// halvesPlayed / chancesByInning — the denominator itself.
// --------------------------------------------------------------------------
test('halvesPlayed: the bottom of the last inning is the only one in doubt', () => {
  // A game the home club never batted the ninth of: eight full innings, then
  // a single half.
  assert.equal(halvesPlayed(8, 9, 0), 2)
  assert.equal(halvesPlayed(9, 9, 0), 1)
  // A walk-off: the home club batted, so the half counts even though it was
  // cut short. The club was exposed in it, which is what a chance is.
  assert.equal(halvesPlayed(9, 9, 1), 2)
  // An inning the game never reached offers nothing.
  assert.equal(halvesPlayed(10, 9, 1), 0)
})

const shaped = (over) => ({
  game_pk: 1, away_team_id: 100, home_team_id: 200,
  final_inning: 9, bottom_played: 1, scheduled_innings: 9, ...over,
})

test('chancesByInning: both clubs are exposed in every half-inning played', () => {
  // Nobody challenged, so both clubs are armed throughout: two halves times
  // two clubs is four chances an inning.
  const { byInning, total, dropped } = chancesByInning([], [shaped({})])
  assert.equal(byInning.get(1), 4)
  assert.equal(byInning.get(9), 4)
  assert.equal(total, 36)
  assert.equal(dropped, 0)
})

test('chancesByInning: a home club that never batted the ninth offers half of it', () => {
  const { byInning, total } = chancesByInning([], [shaped({ bottom_played: 0 })])
  assert.equal(byInning.get(8), 4)
  // One half-inning, both clubs exposed in it.
  assert.equal(byInning.get(9), 2)
  assert.equal(total, 34)
})

test('chancesByInning: a club that emptied in the third stops offering chances', () => {
  const lost = (inning) => ({
    game_pk: 1, team_id: 100, inning, half: 'top', outcome: 'fail',
  })
  const { byInning } = chancesByInning([lost(2), lost(3)], [shaped({})])
  // The away club entered the TOP of the third holding one and spent it there,
  // so it offers that top and not the bottom behind it: three, not four.
  assert.equal(byInning.get(3), 3)
  // From the fourth only the home club is armed, so an inning offers two.
  assert.equal(byInning.get(4), 2)
  assert.equal(byInning.get(9), 2)
})

test('chancesByInning: an emptying in the TOP costs the club the bottom of that inning', () => {
  // THE HALF IS THE UNIT. Read per inning, a club that spends its last
  // challenge in the top is still credited the bottom of the same inning —
  // a half it could not have argued in. It is 0.62% of MLB's season and it
  // falls in the late innings the appetite finding is measured across, which
  // is why it is counted rather than absorbed (docs/adr/0075).
  const spentInTop = [
    { game_pk: 1, team_id: 100, inning: 1, half: 'top', outcome: 'fail' },
    { game_pk: 1, team_id: 100, inning: 7, half: 'top', outcome: 'fail' },
  ]
  const { byInning } = chancesByInning(spentInTop, [shaped({})])
  // Through the sixth both clubs are armed in both halves.
  assert.equal(byInning.get(6), 4)
  // The seventh: the away club's top counts, its bottom does not.
  assert.equal(byInning.get(7), 3)
  // From the eighth it offers nothing at all.
  assert.equal(byInning.get(8), 2)

  // The same two losses spent in the BOTTOM cost it the whole of the next
  // inning instead, and none of the one it emptied in.
  const spentInBottom = spentInTop.map((c) => ({ ...c, half: 'bottom' }))
  const bottom = chancesByInning(spentInBottom, [shaped({})]).byInning
  assert.equal(bottom.get(7), 4)
  assert.equal(bottom.get(8), 2)
})

test('replayBank: the bank is carried ACROSS the two halves of an inning', () => {
  // atStart is recorded once, before the inning's rows are spent, so it says
  // the club was armed for the whole of the inning it emptied in. atHalf is
  // the honest reading the chances denominator asks for.
  const { atStart, atHalf } = replayBank([
    { inning: 4, half: 'top', outcome: 'fail' },
    { inning: 4, half: 'top', outcome: 'fail' },
  ], 9)
  assert.equal(atStart.get(4), 2)
  assert.equal(atHalf.get(halfKey(4, 'top')), 2)
  assert.equal(atHalf.get(halfKey(4, 'bottom')), 0)
  assert.equal(atHalf.get(halfKey(5, 'top')), 0)
})

test('replayBank: a challenge in the bottom leaves the top of its own inning armed', () => {
  const { atHalf } = replayBank([
    { inning: 2, half: 'bottom', outcome: 'fail' },
    { inning: 2, half: 'bottom', outcome: 'fail' },
  ], 9)
  assert.equal(atHalf.get(halfKey(2, 'top')), 2)
  assert.equal(atHalf.get(halfKey(2, 'bottom')), 2)
  assert.equal(atHalf.get(halfKey(3, 'top')), 0)
})

test('replayBank: an emptying is still DATED to the inning, not to the half', () => {
  // "Ran out in the sixth" is what the club board's column means and what
  // LAST_EARLY_INNING is drawn around. Splitting the bank by half must not
  // move it.
  const { emptiedIn } = replayBank([
    { inning: 6, half: 'bottom', outcome: 'fail' },
    { inning: 6, half: 'bottom', outcome: 'fail' },
  ], 9)
  assert.deepEqual(emptiedIn, [6])
})

test('armedAt: the half decides it, and the top is the default', () => {
  const spent = [
    { inning: 1, half: 'top', outcome: 'fail' },
    { inning: 5, half: 'top', outcome: 'fail' },
  ]
  assert.equal(armedAt(spent, 5, 9, 9, 'top'), true)
  assert.equal(armedAt(spent, 5, 9, 9, 'bottom'), false)
  // Asked about the inning rather than a half, it answers for the start of it.
  assert.equal(armedAt(spent, 5, 9, 9), true)
})

test('halfPlayed: only the bottom of the last inning is ever in doubt', () => {
  assert.equal(halfPlayed(9, 'top', 9, 0), true)
  assert.equal(halfPlayed(9, 'bottom', 9, 0), false)
  assert.equal(halfPlayed(9, 'bottom', 9, 1), true)
  assert.equal(halfPlayed(8, 'bottom', 9, 0), true)
  assert.equal(halfPlayed(10, 'top', 9, 1), false)
})

test('chancesByInning: a SEVEN-inning game re-arms an empty club in the eighth', () => {
  // The trap scheduled_innings exists to close. Without it the away club reads
  // as unarmed in the 8th, and the inning offers two chances instead of four.
  const lost = (inning) => ({
    game_pk: 1, team_id: 100, inning, half: 'top', outcome: 'fail',
  })
  const rows = [lost(3), lost(7)]
  const seven = chancesByInning(rows, [
    shaped({ final_inning: 8, scheduled_innings: 7 }),
  ])
  assert.equal(seven.byInning.get(8), 4)
  // Told nothing, the model assumes nine and leaves the club out of it.
  const assumedNine = chancesByInning(rows, [
    shaped({ final_inning: 8, scheduled_innings: null }),
  ])
  assert.equal(assumedNine.byInning.get(8), 2)
})

test('chancesByInning: a game with no length is DROPPED, never counted as nought innings', () => {
  // The guard for a game swept before the columns existed. Counting a NULL as
  // a short game would shrink every denominator and inflate every rate.
  const { byInning, total, dropped, games } = chancesByInning([], [
    shaped({}),
    shaped({ game_pk: 2, final_inning: null, bottom_played: null, scheduled_innings: null }),
  ])
  assert.equal(dropped, 1)
  assert.equal(games, 1)
  assert.equal(total, 36)
  assert.equal(byInning.get(1), 4)
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
    { player_id: 2, name: 'Bo Naylor', position: 'C', pitches: 380, plate_appearances: 90, catcher_innings: 600, catcher_starts: 70 },
    { player_id: 2, name: 'Bo Naylor', position: 'C', pitches: 20, plate_appearances: 4, catcher_innings: 30, catcher_starts: 3 },
  ])
  assert.deepEqual(total.get(2), {
    name: 'Bo Naylor', position: 'C',
    pitches: 400, plateAppearances: 94, catcherInnings: 630, catcherStarts: 73,
  })
})

test('exposureByPlayer: a null column stays null rather than becoming a zero', () => {
  const total = exposureByPlayer([
    { player_id: 3, name: 'A Pitcher', position: 'P', pitches: null, plate_appearances: null, catcher_innings: null, catcher_starts: null },
  ])
  assert.deepEqual(total.get(3), {
    name: 'A Pitcher', position: 'P',
    pitches: null, plateAppearances: null, catcherInnings: null, catcherStarts: null,
  })
})

test('exposureByPlayer: THE NAME COMES WITH HIM, because most of these men have no other row', () => {
  // The fold is the only place the roster rows and the challenge rows meet,
  // and 115 of the 659 MLB men it ships leave no challenge row anywhere — the
  // qualified hitters who never once argued among them. Dropped here they are
  // unprintable, and a board built on the list can show only player ids.
  const total = exposureByPlayer([
    { player_id: 4, name: 'Yandy Diaz', position: '1B', pitches: 2100, plate_appearances: 520 },
  ])
  assert.equal(total.get(4).name, 'Yandy Diaz')
  assert.equal(total.get(4).position, '1B')
  // A row the feed left unnamed does not overwrite one that has a name.
  const mixed = exposureByPlayer([
    { player_id: 5, name: '', position: '', pitches: 10 },
    { player_id: 5, name: 'Real Name', position: 'RF', pitches: 10 },
  ])
  assert.equal(mixed.get(5).name, 'Real Name')
  assert.equal(mixed.get(5).position, 'RF')
})

test('hasExposure: a nought is no more a denominator than a null is', () => {
  // A pitcher who never came to the plate carries a hitting split reading 0
  // rather than no split at all, and a zero divides to no rate exactly as a
  // null does. Both are ballast: the row supports no rate, and cannot answer
  // "he had the opportunity and never took it" either.
  assert.equal(hasExposure({ pitches: 1200, plateAppearances: 300 }), true)
  assert.equal(hasExposure({ pitches: null, catcherInnings: 4 }), true)
  assert.equal(hasExposure({ pitches: 0, plateAppearances: 0 }), false)
  assert.equal(
    hasExposure({ pitches: null, plateAppearances: null, catcherInnings: null, catcherStarts: null }),
    false,
  )
  assert.equal(hasExposure(null), false)
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
  away_team_id: 100, home_team_id: 200, umpire_id: 7, challenges: 1,
  // An ordinary nine-inning game the home club batted in. The three shape
  // columns are on every row --recheck has seen, so the fixture carries them.
  final_inning: 9, bottom_played: 1, scheduled_innings: 9, ...over,
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

test('summarizeLevel: an inning carries the chances its count sat against', () => {
  // One challenge in the third of one nine-inning game the home club batted
  // in. Both clubs are armed all night, so every inning offered four chances.
  const s = summarizeLevel([row({})], [game({})])
  const third = s.byInning.find((i) => i.inning === 3)
  assert.equal(third.n, 1)
  assert.equal(third.chances, 4)
  assert.equal(third.perChance, 0.25)
  assert.equal(s.chances, 36)
  assert.equal(s.chancesGames, 1)
  // The guard for a game with no length fires on nothing, which is the point.
  assert.equal(s.chancesGamesDropped, 0)
})

test('summarizeLevel: a game swept before the columns existed is dropped, and says so', () => {
  const s = summarizeLevel([row({})], [game({ final_inning: null, scheduled_innings: null })])
  assert.equal(s.chancesGamesDropped, 1)
  assert.equal(s.chancesGames, 0)
  assert.equal(s.chances, 0)
  // A dropped game leaves the rate null rather than dividing by nought.
  assert.equal(s.byInning.find((i) => i.inning === 3).perChance, null)
})

test('summarizeLevel: the role rates add back up to the club rate, in every inning', () => {
  // THE INVARIANT THE ONE-DENOMINATOR RULE EXISTS FOR. A batter can only
  // challenge in his club's batting half, so a role drawn on its own half of
  // the chances sums to twice the club figure and reads as though catchers
  // alone out-ask the club they play for. Counted on the club denominator the
  // three add up, which is the only way the panel can be read.
  const s = summarizeLevel(
    [
      row({ seq: 0, role: 'batter', inning: 3 }),
      row({ seq: 1, role: 'catcher', inning: 3, outcome: 'fail', favor: null }),
      row({ seq: 2, role: 'pitcher', inning: 5, outcome: 'fail', favor: null }),
    ],
    [game({ challenges: 3 })],
  )
  for (const inning of s.byInning) {
    const roles = s.byInningRole.filter((r) => r.inning === inning.inning)
    assert.equal(
      roles.reduce((n, r) => n + r.n, 0),
      inning.n,
      `counts disagree in inning ${inning.inning}`,
    )
    assert.equal(
      roles.reduce((n, r) => n + r.perChance, 0),
      inning.perChance,
      `rates disagree in inning ${inning.inning}`,
    )
    // Every role gets a row in every inning that saw a challenge, so a panel
    // draws a flat line rather than a gap where a role was quiet.
    assert.deepEqual(roles.map((r) => r.role), ['batter', 'catcher', 'pitcher', 'other'])
  }
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

test('buildExport: the report file carries no denominator a player is divided by', () => {
  // THE SIZE GUARD, PINNED. Ten exposure fields on every byPlayer row cost
  // 321 KB on a file every visitor to /abs-challenges downloads whole and
  // shows none of them on; with the full list folded in too it ran 895 KB
  // against main's 198 KB. They belong in abs-exposure.json, and a row that
  // grows them back here is the regression this test exists to catch.
  const out = buildExport([row({})], [game({})], { season: 2026, generatedAt: 'now' })
  assert.deepEqual(Object.keys(out.levels.MLB.byPlayer[0]).sort(), [
    'name', 'playerId', 'rate', 'role', 'success', 'teamId', 'n',
  ].sort())
  // And the list of every man who played is not in this file at all.
  assert.equal('exposure' in out.levels.MLB, false)
})

// --------------------------------------------------------------------------
// buildExposureExport — the denominator list, in its own file.
// --------------------------------------------------------------------------
const seenRow = (over) => ({
  season: 2026, level: 'MLB', team_id: 100, player_id: 11, name: 'A Hitter',
  position: 'LF', pitches: 1000, plate_appearances: 250,
  catcher_innings: null, catcher_starts: null, ...over,
})

test('buildExposureExport: a man is named, positioned and given the rates he supports', () => {
  const out = buildExposureExport([row({})], [seenRow({})], { season: 2026, generatedAt: 'now' })
  const p = out.levels.MLB.players[0]
  assert.equal(p.playerId, 11)
  assert.equal(p.name, 'A Hitter')
  assert.equal(p.position, 'LF')
  assert.equal(p.pitches, 1000)
  // One batter challenge over a thousand pitches seen.
  assert.equal(p.asBatter, 1)
  assert.equal(p.per1000Pitches, 1)
  // He never caught, so the catcher rate is no number rather than a nought.
  assert.equal(p.per9Caught, null)
  assert.equal(out.season, 2026)
  assert.equal(out.generatedAt, 'now')
})

test('buildExposureExport: the men who NEVER challenged are in it, and they are the point', () => {
  // Three of the four qualified MLB hitters who never called for a review
  // leave no challenge row anywhere, so a list built from the challenge rows
  // cannot see them. This file is the only place they exist.
  const out = buildExposureExport(
    [row({})],
    [seenRow({}), seenRow({ player_id: 12, name: 'Never Asked', pitches: 2100, plate_appearances: 520 })],
    { season: 2026 },
  )
  const quiet = out.levels.MLB.players.find((p) => p.playerId === 12)
  assert.equal(quiet.name, 'Never Asked')
  // A real zero, not a null: he had 2,100 pitches of opportunity and took none.
  assert.equal(quiet.asBatter, 0)
  assert.equal(quiet.per1000Pitches, 0)
})

test('buildExposureExport: each rate takes only the challenges its own denominator explains', () => {
  // The catcher-who-also-hits trap, through the file rather than the helper.
  const rows = [
    row({ seq: 0, player_id: 20, player_name: 'A Catcher', role: 'batter' }),
    row({ seq: 1, player_id: 20, player_name: 'A Catcher', role: 'catcher' }),
    row({ seq: 2, player_id: 20, player_name: 'A Catcher', role: 'catcher' }),
  ]
  const out = buildExposureExport(rows, [
    seenRow({ player_id: 20, name: 'A Catcher', position: 'C', pitches: 1000, catcher_innings: 900 }),
  ], { season: 2026 })
  const p = out.levels.MLB.players[0]
  assert.equal(p.asBatter, 1)
  assert.equal(p.asCatcher, 2)
  assert.equal(p.per1000Pitches, 1) // his ONE batter challenge, not all three
  assert.equal(p.per9Caught, 0.02) // his two catcher challenges over 900 innings
})

test('buildExposureExport: a man with no opportunity at all is dropped, not shipped as nulls', () => {
  const out = buildExposureExport([], [
    seenRow({}),
    // A pitcher who never batted and never caught: nulls throughout.
    seenRow({ player_id: 13, name: 'A Pitcher', position: 'P', pitches: null, plate_appearances: null }),
    // And one whose hitting split reads nought rather than being absent.
    seenRow({ player_id: 14, name: 'Another Pitcher', position: 'P', pitches: 0, plate_appearances: 0 }),
  ], { season: 2026 })
  assert.deepEqual(out.levels.MLB.players.map((p) => p.playerId), [11])
})

test('buildExposureExport: levels are split, and nothing on file is an empty object', () => {
  const out = buildExposureExport([], [
    seenRow({}),
    seenRow({ level: 'AAA', player_id: 21, name: 'A Triple-A Hitter' }),
  ], { season: 2026 })
  assert.deepEqual(Object.keys(out.levels).sort(), ['AAA', 'MLB'])
  assert.equal(out.levels.AAA.players.length, 1)
  assert.deepEqual(buildExposureExport([], [], { season: 2026 }).levels, {})
})

// --------------------------------------------------------------------------
// buildExposureClubsExport — the same denominators, split by club.
// --------------------------------------------------------------------------
// The fold above is right for a season floor and wrong for a club board, and
// this cut is the difference. Two of these pin what the fold costs.

test('buildExposureClubsExport: a traded man is TWO rows, each with the club he was there for', () => {
  // The fold sums him into one 350-plate-appearance season. Here he is 250 for
  // one club and 100 for the other, and his challenges follow the club he made
  // them for — which is what the team hub card's attribution rests on.
  const rows = [
    row({ seq: 0, team_id: 100, player_id: 11 }),
    row({ seq: 1, team_id: 101, player_id: 11 }),
    row({ seq: 2, team_id: 101, player_id: 11 }),
  ]
  const out = buildExposureClubsExport(
    rows,
    [
      seenRow({ team_id: 100, pitches: 1000, plate_appearances: 250 }),
      seenRow({ team_id: 101, pitches: 400, plate_appearances: 100 }),
    ],
    { season: 2026, generatedAt: 'now' },
  )
  const first = out.levels.MLB.byTeam['100']
  const second = out.levels.MLB.byTeam['101']
  assert.equal(first.length, 1)
  assert.equal(first[0].plateAppearances, 250)
  assert.equal(first[0].asBatter, 1)
  assert.equal(second[0].plateAppearances, 100)
  assert.equal(second[0].asBatter, 2)
  // Neither row carries the other's numbers, and the season is the sum.
  assert.equal(first[0].pitches + second[0].pitches, 1400)
})

test('buildExposureClubsExport: counts and denominators, and NOT the rates', () => {
  // `per1000Pitches` prints as eleven significant figures. Three a row over
  // 1,740 rows was 210 KB of the first draft, for arithmetic the reader does
  // in one line.
  const out = buildExposureClubsExport([row({})], [seenRow({})], { season: 2026 })
  const p = out.levels.MLB.byTeam['100'][0]
  assert.deepEqual(Object.keys(p).sort(), [
    'asBatter', 'asCatcher', 'catcherInnings', 'name', 'pitches', 'plateAppearances', 'playerId',
  ])
})

test('buildExposureClubsExport: a man with no opportunity at that club is dropped', () => {
  const out = buildExposureClubsExport([], [
    seenRow({}),
    seenRow({ team_id: 100, player_id: 13, name: 'A Pitcher', pitches: null, plate_appearances: null }),
    seenRow({ team_id: 100, player_id: 14, name: 'Another', pitches: 0, plate_appearances: 0 }),
  ], { season: 2026 })
  assert.deepEqual(out.levels.MLB.byTeam['100'].map((p) => p.playerId), [11])
})

test('buildExposureClubsExport: MLB only, because no surface draws Triple-A yet', () => {
  // ADR-0076: shipping rows before a surface reads them is the thing the split
  // was made to stop. The loop is per level, so the day a board wants Triple-A
  // it is one word here.
  const out = buildExposureClubsExport([], [
    seenRow({}),
    seenRow({ level: 'AAA', team_id: 400, player_id: 21, name: 'A Triple-A Hitter' }),
  ], { season: 2026 })
  assert.deepEqual(Object.keys(out.levels), ['MLB'])
  const both = buildExposureClubsExport([], [
    seenRow({}),
    seenRow({ level: 'AAA', team_id: 400, player_id: 21, name: 'A Triple-A Hitter' }),
  ], { season: 2026, levels: ['MLB', 'AAA'] })
  assert.equal(both.levels.AAA.byTeam['400'].length, 1)
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

// --------------------------------------------------------------------------
// The plate-umpire board's fourth sort, and its two ends.
// --------------------------------------------------------------------------
// A board of umpires, each worked enough games to clear the floor, built
// straight rather than through buildExport — the cut under test is the
// ordering and the tails, not the export.
const umpSummary = (n) => ({
  perGame: 4.18,
  byUmpire: Array.from({ length: n }, (_, i) => ({
    umpireId: 100 + i,
    name: `Umpire ${i}`,
    games: 20,
    // Spread evenly from 3.13 to 5.40, the season's real range.
    n: 80 + i,
    success: 40,
    rate: 0.5,
    perGame: 3.13 + (i * (5.4 - 3.13)) / Math.max(1, n - 1),
  })),
})

test('UMPIRE_SORTS: one chip per question, because the board shows both ends of it', () => {
  assert.deepEqual(UMPIRE_SORTS.map((s) => s.key), ['rate', 'perGame'])
  // No sort names a field other than its own key any more. The `field`
  // indirection existed only for the low chips.
  assert.ok(UMPIRE_SORTS.every((s) => s.field == null))
})

test('umpireTails: a low chip would have re-printed the same twelve men', () => {
  // WHY THE LOW CHIPS WENT. Sorting the board the other way returns the
  // identical rows reversed, and the head and tail of a reversed list are the
  // tail and head of the original — the same twelve umpires, swapped over. A
  // control that promises a new view and re-prints the old one reads as broken
  // data, so the chip picks the COLUMN and both of its ends come free.
  const summary = umpSummary(30)
  const most = umpireBoard(summary, 'perGame')
  const reversed = [...most].reverse()
  const a = umpireTails(most)
  const b = umpireTails(reversed)
  assert.deepEqual(a.head.map((u) => u.umpireId), b.tail.map((u) => u.umpireId).reverse())
  assert.deepEqual(a.tail.map((u) => u.umpireId), b.head.map((u) => u.umpireId).reverse())
  assert.equal(a.between, b.between)
})

test('umpireBoard: every qualifying man is on the board, whatever the tails show', () => {
  // The expander's contract. UmpireBoard.jsx renders `umps` whole when
  // `showAll` is on, so the men the tails leave out have to BE here — 75 of
  // MLB's 87 were unreachable when the two ends were the only view.
  const board = umpireBoard(umpSummary(30), 'perGame')
  assert.equal(board.length, 30)
  const { head, tail, between } = umpireTails(board)
  assert.equal(head.length + tail.length + between, board.length)
  // And the ranks are the board's own, so expanding renumbers nothing.
  assert.equal(board[0].rank, 1)
  assert.equal(board[board.length - 1].rank, 30)
})

test('umpireTails: both ends on one board, with the middle counted not hidden', () => {
  const rows = umpireBoard(umpSummary(30), 'perGame')
  const { head, tail, between } = umpireTails(rows)
  assert.equal(head.length, UMPIRE_TAIL)
  assert.equal(tail.length, UMPIRE_TAIL)
  assert.equal(between, 30 - UMPIRE_TAIL * 2)
  // The two ends are the real ends, and nothing is shown twice.
  assert.equal(head[0].umpireId, rows[0].umpireId)
  assert.equal(tail[tail.length - 1].umpireId, rows[rows.length - 1].umpireId)
  assert.equal(new Set([...head, ...tail].map((u) => u.umpireId)).size, UMPIRE_TAIL * 2)
})

test('umpireTails: a board too short to have two ends is returned whole', () => {
  // Triple-A on a thin sample, and the degenerate cases either side of it.
  const rows = umpireBoard(umpSummary(8), 'perGame')
  const { head, tail, between } = umpireTails(rows)
  assert.equal(head.length, 8)
  assert.deepEqual(tail, [])
  assert.equal(between, 0)
  assert.deepEqual(umpireTails([]), { head: [], tail: [], between: 0 })
  assert.deepEqual(umpireTails(null), { head: [], tail: [], between: 0 })
})

test('umpireTails: one row past twice the tail is where the middle starts', () => {
  const whole = umpireTails(umpireBoard(umpSummary(UMPIRE_TAIL * 2), 'perGame'))
  assert.equal(whole.between, 0)
  assert.equal(whole.tail.length, 0)
  const split = umpireTails(umpireBoard(umpSummary(UMPIRE_TAIL * 2 + 1), 'perGame'))
  assert.equal(split.between, 1)
  assert.equal(split.tail.length, UMPIRE_TAIL)
})

test('umpireSpread: the scale is the widest margin on the league rate', () => {
  const rows = umpireBoard(umpSummary(10), 'perGame')
  // 5.40 is 1.22 above 4.18; 3.13 is 1.05 below it. The wider side wins, so
  // the longest bar reaches the end of its track and none overflows.
  assert.equal(umpireSpread(rows, 4.18).toFixed(2), '1.22')
  // It does not move with the sort, only with the board.
  assert.equal(
    umpireSpread(umpireBoard(umpSummary(10), 'perGameLow'), 4.18),
    umpireSpread(rows, 4.18),
  )
})

test('umpireSpread: nothing to scale against returns null rather than zero', () => {
  // A caller draws no bar on null; a zero would divide the width by nought.
  assert.equal(umpireSpread([], 4.18), null)
  assert.equal(umpireSpread(null, 4.18), null)
  assert.equal(umpireSpread([{ perGame: 4.18 }], 4.18), null)
  // No league rate is no baseline, whatever the rows say.
  assert.equal(umpireSpread([{ perGame: 5.4 }], null), null)
  // A row with no rate of its own is skipped, not counted as nought.
  assert.equal(umpireSpread([{ perGame: null }, { perGame: 5.18 }], 4.18).toFixed(2), '1.00')
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

// --------------------------------------------------------------------------
// ranOutBoard — the nights a club was left with nothing to argue with.
// --------------------------------------------------------------------------
// The per-club `ranOut` column counts HOW MANY nights; this is the nights
// themselves, and the band is every club-game that emptied in the earliest
// inning any did. Four of these pin cases the count could not see: a club that
// lost only one, a club emptied in an extra inning, both losses inside one
// half, and the tiebreak that decides which of nine equal nights prints first.

test('ranOutBoard: one loss is not an emptying', () => {
  const board = ranOutBoard([row({ seq: 0, outcome: 'fail' })], [game({})])
  assert.equal(board.emptied, 0)
  assert.equal(board.earliest, null)
  assert.deepEqual(board.band, [])
  // Both sides of the game are still a denominator, challenged or not.
  assert.equal(board.clubGames, 2)
})

test('ranOutBoard: both losses inside one half, and the half is recorded', () => {
  const board = ranOutBoard(
    [
      row({ seq: 0, outcome: 'fail', inning: 1, half: 'top' }),
      row({ seq: 1, outcome: 'fail', inning: 1, half: 'top', player_id: 12, player_name: 'B Hitter' }),
    ],
    [game({ challenges: 2 })],
  )
  assert.equal(board.earliest, 1)
  assert.equal(board.emptied, 1)
  assert.equal(board.band.length, 1)
  assert.equal(board.band[0].inning, 1)
  assert.equal(board.band[0].half, 'top')
  // Both losses are on the row, in the order they were spent — a board that
  // named only the second would hide the man who asked twice.
  assert.deepEqual(board.band[0].fails.map((f) => f.playerName), ['A Hitter', 'B Hitter'])
})

test('ranOutBoard: an overturn between two losses is not an emptying', () => {
  // L W L leaves the club empty at the THIRD call, not the first loss: the
  // overturn handed the challenge straight back. A board counting losses would
  // date this night to the fifth.
  const board = ranOutBoard(
    [
      row({ seq: 0, outcome: 'fail', inning: 2 }),
      row({ seq: 1, outcome: 'success', inning: 5 }),
      row({ seq: 2, outcome: 'fail', inning: 8 }),
    ],
    [game({ challenges: 3 })],
  )
  assert.equal(board.earliest, 8)
  assert.deepEqual(board.byInning, [{ inning: 8, n: 1 }])
})

test('ranOutBoard: a club emptied in extras, and only the FIRST emptying counts', () => {
  // Out in the tenth, armed again in the eleventh by the extra-inning top-up,
  // and out again at once. The night is dated to the tenth: it is "games it
  // ran out in", not "times it ran out".
  const board = ranOutBoard(
    [
      row({ seq: 0, outcome: 'fail', inning: 3 }),
      row({ seq: 1, outcome: 'fail', inning: 10 }),
      row({ seq: 2, outcome: 'fail', inning: 11 }),
    ],
    [game({ challenges: 3, final_inning: 11 })],
  )
  assert.equal(board.emptied, 1)
  assert.equal(board.earliest, 10)
  assert.equal(board.band[0].inning, 10)
  // Every loss up to the emptying, which is two — the third belongs to the
  // top-up the eleventh handed back.
  assert.equal(board.band[0].fails.length, 2)
})

test('ranOutBoard: the band ties break on the half, then the sequence, then the date', () => {
  const rows = [
    // Three club-games all emptied in the first. Written out of order on
    // purpose, so the sort is doing the work rather than the input.
    ...[0, 1].map((i) => row({ game_pk: 3, seq: 40 + i, date: '2026-05-02', outcome: 'fail', inning: 1, half: 'top' })),
    ...[0, 1].map((i) => row({ game_pk: 1, seq: i, outcome: 'fail', inning: 1, half: 'bottom', team_id: 200, side: 'home' })),
    ...[0, 1].map((i) => row({ game_pk: 2, seq: 40 + i, date: '2026-04-30', outcome: 'fail', inning: 1, half: 'top' })),
  ]
  const games = [
    game({ challenges: 2 }),
    game({ game_pk: 2, date: '2026-04-30', challenges: 2 }),
    game({ game_pk: 3, date: '2026-05-02', challenges: 2 }),
  ]
  const board = ranOutBoard(rows, games)
  assert.equal(board.band.length, 3)
  // The bottom-of-the-first night sorts last however early its sequence is;
  // the two tops share a sequence, so the earlier date prints first.
  assert.deepEqual(board.band.map((b) => [b.gamePk, b.half]), [
    [2, 'top'],
    [3, 'top'],
    [1, 'bottom'],
  ])
})

test('ranOutBoard: the rows carry nothing a score could be read from', () => {
  const board = ranOutBoard(
    [
      row({ seq: 0, outcome: 'fail', inning: 1 }),
      row({ seq: 1, outcome: 'fail', inning: 1, half: 'bottom' }),
    ],
    [game({ challenges: 2 })],
  )
  // The exact key set, asserted rather than scanned: /abs-challenges is
  // spoiler-free, this is the only board on it that names a night, and a field
  // added later without thought is how that classification would quietly stop
  // being true.
  assert.deepEqual(Object.keys(board.band[0]).sort(), [
    'date', 'fails', 'gamePk', 'half', 'inning', 'oppId', 'seq', 'side', 'teamId',
  ])
  assert.deepEqual(Object.keys(board.band[0].fails[0]).sort(), [
    'callType', 'half', 'inning', 'missInches', 'playerId', 'playerName', 'role',
  ])
})

test('ranOutBoard: the distribution counts every emptied club-game, band or not', () => {
  const rows = [
    row({ seq: 0, outcome: 'fail', inning: 2 }),
    row({ seq: 1, outcome: 'fail', inning: 2 }),
    row({ game_pk: 2, seq: 0, outcome: 'fail', inning: 8 }),
    row({ game_pk: 2, seq: 1, outcome: 'fail', inning: 9 }),
  ]
  const board = ranOutBoard(rows, [game({ challenges: 2 }), game({ game_pk: 2, challenges: 2 })])
  assert.deepEqual(board.byInning, [{ inning: 2, n: 1 }, { inning: 9, n: 1 }])
  assert.equal(board.emptied, 2)
  assert.equal(board.band.length, 1) // only the second-inning night
  assert.equal(board.clubGames, 4)
})

// --------------------------------------------------------------------------
// ranOutNights — the reader's half.
// --------------------------------------------------------------------------

// The fixture the reader tests share: one club out in the second, one out in
// the ninth, over two games.
const ranOutData = buildExport(
  [
    row({ seq: 0, outcome: 'fail', inning: 2 }),
    row({ seq: 1, outcome: 'fail', inning: 2 }),
    row({ game_pk: 2, date: '2026-04-02', seq: 0, outcome: 'fail', inning: 8 }),
    row({ game_pk: 2, date: '2026-04-02', seq: 1, outcome: 'fail', inning: 9 }),
  ],
  [game({ challenges: 2 }), game({ game_pk: 2, date: '2026-04-02', challenges: 2 })],
  { season: 2026, generatedAt: 'now' },
)

test('ranOutNights: the early and late split is where the band gets its context', () => {
  const out = ranOutNights(summaryFor(ranOutData, 'MLB'))
  assert.equal(out.earliest, 2)
  assert.equal(out.emptied, 2)
  assert.equal(out.clubGames, 4)
  assert.equal(out.share, 0.5)
  assert.equal(out.early, 1)
  assert.equal(out.late, 1)
  assert.deepEqual(out.byInning.map((b) => b.share), [0.5, 0.5])
  assert.equal(out.band.length, 1)
})

test('ranOutNights: a level nobody ran out in draws no board at all', () => {
  const quiet = buildExport([row({ seq: 0, outcome: 'fail' })], [game({})], { season: 2026 })
  assert.equal(ranOutNights(summaryFor(quiet, 'MLB')), null)
  assert.equal(ranOutNights(null), null)
})

test('RAN_OUT_EARLY_THROUGH: the reader and the export agree on what "early" is', () => {
  // The constant is held twice — LAST_EARLY_INNING runs in Node, this one runs
  // in the browser — so the two are pinned to each other here. Every club's
  // `ranOutEarly` added up is the same set of nights this constant admits.
  const summary = summaryFor(ranOutData, 'MLB')
  const perClub = summary.byTeam.reduce((n, t) => n + t.ranOutEarly, 0)
  const perNight = summary.ranOutNights.byInning
    .filter((b) => b.inning <= RAN_OUT_EARLY_THROUGH)
    .reduce((n, b) => n + b.n, 0)
  assert.equal(perClub, perNight)
  assert.equal(perClub, 1)
})

// A season whose second club-game does not empty until the ELEVENTH. The club
// loses one in the third, carries the other into extras, and the extra-inning
// top-up leaves it holding exactly one to lose there — which is how a FIRST
// emptying lands past regulation at all.
const extrasData = buildExport(
  [
    row({ seq: 0, outcome: 'fail', inning: 2 }),
    row({ seq: 1, outcome: 'fail', inning: 2 }),
    row({ game_pk: 2, date: '2026-04-02', seq: 0, outcome: 'fail', inning: 3 }),
    row({ game_pk: 2, date: '2026-04-02', seq: 1, outcome: 'fail', inning: 11 }),
  ],
  [
    game({ challenges: 2 }),
    game({ game_pk: 2, date: '2026-04-02', challenges: 2, final_inning: 11 }),
  ],
  { season: 2026, generatedAt: 'now' },
)

test('ranOutSeries: everything past the ninth is ONE column, re-divided and not averaged', () => {
  const nights = ranOutNights(summaryFor(extrasData, 'MLB'))
  assert.deepEqual(
    nights.byInning.map((b) => b.inning),
    [2, 11],
  )
  const series = ranOutSeries(nights)
  // Two columns, and the eleventh is not one of them.
  assert.equal(series.length, 2)
  assert.deepEqual(
    series.map((r) => r.inning),
    [2, 10],
  )
  const pooled = series[1]
  assert.equal(pooled.extras, true)
  assert.equal(pooled.n, 1)
  // The pooled share is the pooled count over every emptying, which is what
  // the nine columns beside it already are — never the mean of its members.
  assert.equal(pooled.share, 0.5)
  assert.equal(series[0].extras, false)
})

test('ranOutSeries: the marked column is the one whose rows the board prints', () => {
  const series = ranOutSeries(ranOutNights(summaryFor(ranOutData, 'MLB')))
  // No extras in this fixture, so nothing is pooled and nothing is hollow.
  assert.equal(series.length, 2)
  assert.ok(series.every((r) => r.extras === false))
  assert.deepEqual(
    series.map((r) => r.mark),
    [true, false],
  )
})

test('ranOutSeries: a band that is itself in extras marks the pooled column', () => {
  // The pooled column is numbered REGULATION_INNINGS + 1, so a band in the
  // ELEVENTH never equals it — the mark has to follow the pooling rather than
  // the inning number, or the board would print rows no column points at.
  const series = ranOutSeries({
    earliest: 11,
    emptied: 2,
    clubGames: 8,
    byInning: [{ inning: 11, n: 2, share: 1 }],
  })
  assert.equal(series.length, 1)
  assert.equal(series[0].inning, 10)
  assert.equal(series[0].extras, true)
  assert.equal(series[0].mark, true)
})

test('ranOutSeries: nothing on file draws nothing', () => {
  assert.deepEqual(ranOutSeries(null), [])
  assert.deepEqual(ranOutSeries({ byInning: [] }), [])
})

// --------------------------------------------------------------------------
// streaksByPlayer / streakBoards — runs of being right, and runs of being wrong.
// --------------------------------------------------------------------------
// Four of these pin the cases a naive walk gets wrong: a run that crosses two
// games, a man with a single challenge, a quiet game in the middle of a run,
// and the role a two-way man is grouped under.

// One man's calls, in the order given, as rows. `at` is [gamePk, date].
const calls = (outcomes, { playerId = 11, name = 'A Hitter', role = 'batter', gamePk = 1, date = '2026-04-01' } = {}) =>
  outcomes.map((o, i) =>
    row({
      game_pk: gamePk,
      date,
      seq: i,
      player_id: playerId,
      player_name: name,
      role,
      outcome: o === 'W' ? 'success' : 'fail',
    }),
  )

test('streaksByPlayer: a run crosses two games, because the season does not stop at one', () => {
  const rows = [
    ...calls(['W', 'W'], { gamePk: 1, date: '2026-04-01' }),
    ...calls(['W', 'L'], { gamePk: 2, date: '2026-04-02' }),
  ]
  const [p] = streaksByPlayer(rows)
  assert.equal(p.n, 4)
  assert.equal(p.success, 3)
  assert.equal(p.seasonWin, 3)
  // Inside one game he never got past two.
  assert.equal(p.gameWin, 2)
  assert.equal(p.seasonLoss, 1)
})

test('streaksByPlayer: a game he did not challenge in does not break the run', () => {
  // He wins one in April, says nothing for a month, and wins two more. That is
  // a run of three: he did nothing in between to be wrong about.
  const rows = [
    ...calls(['W'], { gamePk: 1, date: '2026-04-01' }),
    // Another man's night, in between.
    ...calls(['L', 'L'], { gamePk: 2, date: '2026-05-01', playerId: 22, name: 'B Hitter' }),
    ...calls(['W', 'W'], { gamePk: 3, date: '2026-06-01' }),
  ]
  const mine = streaksByPlayer(rows).find((p) => p.playerId === 11)
  assert.equal(mine.seasonWin, 3)
})

test('streaksByPlayer: one challenge is a run of one, and nothing in the other column', () => {
  const [p] = streaksByPlayer(calls(['L']))
  assert.equal(p.n, 1)
  assert.equal(p.seasonLoss, 1)
  assert.equal(p.seasonWin, 0)
  assert.equal(p.gameLoss, 1)
  assert.equal(p.gameWin, 0)
})

test('streaksByPlayer: a man is grouped by the job he MOSTLY did, not the one he did first', () => {
  // He opens the season behind the plate once and spends the rest of it at
  // bat. The board that groups him has to call him a batter.
  const rows = [
    ...calls(['W'], { gamePk: 1, date: '2026-04-01', role: 'catcher' }),
    ...calls(['W', 'L'], { gamePk: 2, date: '2026-04-02', role: 'batter' }),
  ]
  const [p] = streaksByPlayer(rows)
  assert.equal(p.role, 'batter')
})

test('streaksByPlayer: the order is the DATE, not the order the rows arrive in', () => {
  // September written first, April second. Read in row order his season is
  // L W W; read by date it is W W L, and only the second is his year.
  const rows = [
    ...calls(['L'], { gamePk: 9, date: '2026-09-01' }),
    ...calls(['W', 'W'], { gamePk: 1, date: '2026-04-01' }),
  ]
  const [p] = streaksByPlayer(rows)
  assert.equal(p.seasonWin, 2)
})

test('streakBoards: each board ranks on its own run, with the season total beside it', () => {
  const rows = [
    ...calls(['W', 'W', 'W'], { gamePk: 1, playerId: 11, name: 'Long Run' }),
    ...calls(['W', 'L', 'W', 'W'], { gamePk: 2, date: '2026-04-02', playerId: 22, name: 'More Calls' }),
  ]
  const board = streakBoards(rows).boards.seasonWin.batter
  assert.equal(board.max, 3)
  assert.deepEqual(board.rows.map((r) => [r.name, r.run, r.n]), [
    ['Long Run', 3, 3],
    ['More Calls', 2, 4],
  ])
})

test('streakBoards: the distribution counts every man, including the ones no row names', () => {
  const rows = []
  // Thirteen men with a run of two apiece, which is one more than a board shows.
  for (let i = 0; i < 13; i += 1) {
    rows.push(...calls(['W', 'W'], { gamePk: i + 1, date: `2026-04-0${(i % 9) + 1}`, playerId: 100 + i, name: `Man ${i}` }))
  }
  const board = streakBoards(rows).boards.seasonWin.batter
  assert.equal(board.rows.length, STREAK_TOP)
  assert.equal(board.players, 13)
  assert.deepEqual(board.reached, [{ run: 2, n: 13 }])
})

test('streakBoards: a role nobody challenged from is left off rather than shipped empty', () => {
  const board = streakBoards(calls(['W', 'W'])).boards.seasonWin
  assert.deepEqual(Object.keys(board), ['batter'])
})

test('streaksByPlayer: three losses in one night are REPORTED, not clamped at the rulebook', () => {
  // Two issued and one spent per call caps a run of losses at two — in
  // REGULATION. A club that has run out is armed again in each extra inning,
  // and three Triple-A catchers lost three in a row on the season because of
  // it. A walk that stopped at two to match the rule would erase them, so this
  // fixture spends three and expects three back.
  //
  // What the rule does constrain is the BANK, and bank.mjs is where that is
  // checked — auditBank replays every club-game on file against it.
  const [p] = streaksByPlayer(calls(['L', 'L', 'L']))
  assert.equal(p.gameLoss, 3)
  assert.equal(p.seasonLoss, 3)
})

// --------------------------------------------------------------------------
// streakBoard / inGameLossCap — the reader's half.
// --------------------------------------------------------------------------

const streakData = buildExport(
  [
    ...calls(['W', 'W', 'W'], { gamePk: 1, playerId: 11, name: 'Long Run' }),
    ...calls(['W', 'W'], { gamePk: 2, date: '2026-04-02', playerId: 22, name: 'Short Run' }),
    ...calls(['W', 'W'], { gamePk: 3, date: '2026-04-03', playerId: 33, name: 'Also Short' }),
    ...calls(['L'], { gamePk: 4, date: '2026-04-04', playerId: 44, name: 'One Loss', role: 'pitcher' }),
  ],
  [1, 2, 3, 4].map((pk) => game({ game_pk: pk, date: `2026-04-0${pk}`, challenges: 3 })),
  { season: 2026, generatedAt: 'now' },
)

test('streakBoard: the rows come with how many men tie below them', () => {
  const board = streakBoard(summaryFor(streakData, 'MLB'), 'seasonWin', 'batter')
  assert.equal(board.max, 3)
  assert.equal(board.cut, 2)
  // Both two-run men are on screen, so nobody is tied below them.
  assert.equal(board.tiedBelow, 0)
  assert.equal(board.unshown, 0)
})

test('streakBoard: a board that cannot reach a run of two is not a board', () => {
  // One pitcher, one loss, no run. STREAK_MIN_RUN keeps it off the page rather
  // than drawing a list of everybody who was ever wrong once.
  const summary = summaryFor(streakData, 'MLB')
  assert.equal(streakBoard(summary, 'seasonLoss', 'pitcher'), null)
  assert.deepEqual(streakRoles(summary, 'seasonWin'), ['batter'])
  assert.equal(streakBoard(null, 'seasonWin', 'batter'), null)
})

test('inGameLossCap: the cap is READ, never stated as the rulebook', () => {
  // The fixture's longest run of losses inside one game is one, by one man —
  // so the page says one. A page that printed "two is the rule" would be
  // asserting a rulebook the extra-inning top-up already breaks in Triple-A.
  assert.deepEqual(inGameLossCap(summaryFor(streakData, 'MLB')), { max: 1, players: 1 })
  assert.equal(inGameLossCap(null), null)
})

// --------------------------------------------------------------------------
// momentumCuts — after a win, after a loss, and the control that is the point.
// --------------------------------------------------------------------------
// The naive cut answers a question nobody asked: a club that has just lost one
// holds one fewer, so it asks less afterwards BY RULE. The strict cut holds
// the rulebook still — the club's second call, with exactly one left in hand —
// so the only thing separating two clubs is how the last call went. These pin
// the cell selection, the censoring, and the two ways the numerator and the
// denominator can stop describing the same half-innings.

// One club's night. `at` is [inning, half, outcome] per call.
const night = (calls, { gamePk = 1, teamId = 100, playerId = 11 } = {}) =>
  calls.map(([inning, half, outcome], i) =>
    row({
      game_pk: gamePk,
      seq: i,
      team_id: teamId,
      player_id: playerId,
      inning,
      half,
      outcome: outcome === 'W' ? 'success' : 'fail',
    }),
  )

test('momentumCuts: the chances run from the NEXT half, not from the one he stood in', () => {
  // One call, in the top of the eighth of a nine-inning game the home club
  // batted in. What is left is the bottom of the eighth and both halves of the
  // ninth — three, and not the four an inning-level count would give.
  const out = momentumCuts(night([[8, 'top', 'W']]), [game({})])
  assert.equal(out.club.naive.win.chances, 3)
  assert.equal(out.club.naive.win.next, 0)
  assert.equal(out.club.naive.win.rate, 0)
})

test('momentumCuts: a club emptied by the call itself is left out by the arithmetic', () => {
  // Two losses in the ninth of a nine-inning game. The first still had the
  // bottom of the ninth in front of it, and the club was armed for it — one
  // chance. The second emptied the club with nothing left to play, so it
  // offers nothing and enters neither side of the rate.
  //
  // THAT IS THE CENSORING THE QUESTION NEEDS, and it falls out of the rate
  // rather than out of a rule that drops rows: nobody has to decide which
  // events to exclude, because an event with no chances after it adds nought
  // to both the top and the bottom.
  const out = momentumCuts(night([[9, 'top', 'L'], [9, 'bottom', 'L']]), [game({ challenges: 2 })])
  assert.equal(out.club.naive.loss.events, 2)
  assert.equal(out.club.naive.loss.chances, 1)
  // And the club did ask again in that one half — the second loss itself.
  assert.equal(out.club.naive.loss.next, 1)

  // A club emptied with a whole game still to play has no chances either, all
  // the way to the ninth — which is the rulebook the naive cut mistakes for
  // nerve.
  const early = momentumCuts(night([[1, 'top', 'L'], [1, 'bottom', 'L']]), [game({ challenges: 2 })])
  assert.equal(early.club.naive.loss.chances, 1)
})

test('momentumCuts: an emptied club is armed again in extras, and those halves count', () => {
  // Out in the second of a game that went to the eleventh. The tenth and the
  // eleventh arm it again, so it really did have chances — a model that
  // stopped at the emptying would call the rest of the night unavailable.
  const out = momentumCuts(
    night([[2, 'top', 'L'], [2, 'bottom', 'L']]),
    [game({ challenges: 2, final_inning: 11 })],
  )
  assert.ok(out.club.naive.loss.chances >= 4)
})

test('momentumCuts: a second call in the same half is counted by neither side', () => {
  // Two calls in the top of the first. The denominator for the first starts at
  // the bottom of the first, so the second call cannot be in the numerator —
  // or the rate exceeds what the club was ever offered.
  const out = momentumCuts(
    night([[1, 'top', 'W'], [1, 'top', 'W']]),
    [game({ challenges: 2 })],
  )
  assert.equal(out.club.naive.win.next, 0)
})

test('momentumCuts: the strict cell is the SECOND call with exactly one in hand', () => {
  // W then L leaves the club holding one, and the last call went against it.
  const wl = momentumCuts(night([[1, 'top', 'W'], [3, 'top', 'L']]), [game({ challenges: 2 })])
  assert.equal(wl.club.strict.loss.events, 1)
  assert.equal(wl.club.strict.win.events, 0)

  // L then W leaves the club holding one as well, and the last call went its
  // way. Same rulebook position, opposite news — which is the whole control.
  const lw = momentumCuts(night([[1, 'top', 'L'], [3, 'top', 'W']]), [game({ challenges: 2 })])
  assert.equal(lw.club.strict.win.events, 1)
  assert.equal(lw.club.strict.loss.events, 0)
})

test('momentumCuts: a club that spent both, or kept both, is not in the control at all', () => {
  // L L leaves nothing in hand and W W leaves two. Neither is comparable with
  // a club holding one, so neither reaches the strict cell.
  const ll = momentumCuts(night([[1, 'top', 'L'], [3, 'top', 'L']]), [game({ challenges: 2 })])
  assert.equal(ll.club.strict.win.events + ll.club.strict.loss.events, 0)
  const ww = momentumCuts(night([[1, 'top', 'W'], [3, 'top', 'W']]), [game({ challenges: 2 })])
  assert.equal(ww.club.strict.win.events + ww.club.strict.loss.events, 0)
})

test('momentumCuts: the player cut counts the same MAN, over his club’s chances', () => {
  const rows = [
    ...night([[1, 'top', 'W']], { playerId: 11 }),
    ...night([[5, 'top', 'W']], { playerId: 11, gamePk: 1 }).map((r) => ({ ...r, seq: 1 })),
    ...night([[7, 'top', 'W']], { playerId: 22, gamePk: 1 }).map((r) => ({ ...r, seq: 2 })),
  ]
  const out = momentumCuts(rows, [game({ challenges: 3 })])
  // The first call is followed by two more from the club and one more from the
  // man who made it.
  assert.equal(out.club.naive.win.next, 2 + 1 + 0)
  assert.equal(out.player.naive.win.next, 1 + 0 + 0)
  // Both units divide by the same club half-innings, so they sit on one scale.
  assert.equal(out.player.naive.win.chances, out.club.naive.win.chances)
})

test('momentumCuts: a game with no length on file is skipped, never counted short', () => {
  const out = momentumCuts(night([[1, 'top', 'W']]), [game({ final_inning: null })])
  assert.equal(out.club.naive.win.events, 0)
})

// --------------------------------------------------------------------------
// momentum / momentumLevels — the reader's half.
// --------------------------------------------------------------------------

test('momentum: both cuts come back together, because showing one alone is the error', () => {
  const data = buildExport(
    [
      ...night([[1, 'top', 'W'], [3, 'top', 'L']]),
      ...night([[1, 'top', 'L'], [3, 'top', 'W']], { gamePk: 2, teamId: 200 }),
    ],
    [game({ challenges: 2 }), game({ game_pk: 2, challenges: 2 })],
    { season: 2026, generatedAt: 'now' },
  )
  const out = momentum(summaryFor(data, 'MLB'))
  assert.equal(out.unit, 'club')
  assert.ok(out.naive.win)
  assert.ok(out.strict.loss)
  assert.equal(out.strict.win.events, 1)
  assert.equal(out.strict.loss.events, 1)
  // Neither side called again, so the gap is nothing and says so.
  assert.equal(out.strict.gap, 0)
  assert.equal(momentum(null), null)
  assert.equal(momentum(summaryFor(data, 'MLB'), 'player').unit, 'player')
})

test('momentumLevels: two leagues that disagree on the sign have not found an effect', () => {
  const data = buildExport(
    [
      // MLB: the club that lost its second call goes on to ask again.
      ...night([[1, 'top', 'W'], [2, 'top', 'L'], [5, 'top', 'W']]),
      ...night([[1, 'top', 'L'], [2, 'top', 'W']], { gamePk: 2, teamId: 200 }),
      // Triple-A: the other way round.
      ...night([[1, 'top', 'W'], [2, 'top', 'L']], { gamePk: 3 }).map((r) => ({ ...r, level: 'AAA' })),
      ...night([[1, 'top', 'L'], [2, 'top', 'W'], [5, 'top', 'W']], { gamePk: 4, teamId: 200 }).map(
        (r) => ({ ...r, level: 'AAA' }),
      ),
    ],
    [
      game({ challenges: 3 }),
      game({ game_pk: 2, challenges: 2 }),
      game({ game_pk: 3, level: 'AAA', challenges: 2 }),
      game({ game_pk: 4, level: 'AAA', challenges: 3 }),
    ],
    { season: 2026, generatedAt: 'now' },
  )
  const out = momentumLevels(data)
  assert.deepEqual(out.rows.map((r) => r.level), ['MLB', 'AAA'])
  assert.ok(out.rows[0].gap < 0) // MLB: busier after a loss
  assert.ok(out.rows[1].gap > 0) // Triple-A: busier after a win
  assert.equal(out.agree, false)
})

test('momentum: the standard errors ship with the gap, not under it', () => {
  // A gap worth less than one standard error is not a result, and the page
  // cannot print the number without the thing that says so.
  const data = buildExport(
    [
      ...night([[1, 'top', 'W'], [2, 'top', 'L'], [5, 'top', 'W']]),
      ...night([[1, 'top', 'L'], [2, 'top', 'W'], [5, 'top', 'W']], { gamePk: 2, teamId: 200 }),
    ],
    [game({ challenges: 3 }), game({ game_pk: 2, challenges: 3 })],
    { season: 2026, generatedAt: 'now' },
  )
  const out = momentum(summaryFor(data, 'MLB'))
  assert.equal(typeof out.strict.errors, 'number')
  assert.ok(Number.isFinite(out.strict.errors))
})

// --------------------------------------------------------------------------
// inningSeries / roleInnings / roleSpan — the columns the inning chart draws.
// --------------------------------------------------------------------------
// The whole point of the chart is that the RAW COUNT misleads: the ninth
// barely beats the eighth on counts and nearly doubles it per chance, because
// fewer clubs reach the ninth still able to argue. These pin the two ways that
// correction can be thrown away — pooling the extras by averaging their rates,
// and dividing a role by its own half of the chances instead of the club's.

const inn = (over) => ({
  inning: 1, n: 100, success: 50, rate: 0.5, chances: 1000, perChance: 0.1, ...over,
})
const seriesOf = (rows) => inningSeries({ byInning: rows })

test('inningSeries: nine regulation columns and one for everything after', () => {
  const rows = []
  for (let i = 1; i <= 9; i += 1) rows.push(inn({ inning: i }))
  rows.push(inn({ inning: 10 }), inn({ inning: 11 }), inn({ inning: 12 }))
  const series = seriesOf(rows)
  assert.equal(series.length, 10)
  assert.deepEqual(series.map((r) => r.inning), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  assert.equal(series.filter((r) => r.extras).length, 1)
  assert.equal(series[9].n, 300)
  assert.equal(series[9].chances, 3000)
})

test('inningSeries: the pooled rates are RE-DIVIDED, never averaged', () => {
  // The tenth is a real inning; the thirteenth is eleven chances. A mean of the
  // two rates weights them equally and prints 30%; the pooled count over the
  // pooled chances is 10.9%, which is what the nine columns beside it are.
  const series = seriesOf([
    inn({ inning: 1 }),
    inn({ inning: 10, n: 100, success: 40, chances: 1000, perChance: 0.1, rate: 0.4 }),
    inn({ inning: 13, n: 10, success: 2, chances: 20, perChance: 0.5, rate: 0.2 }),
  ])
  const pooled = series.find((r) => r.extras)
  assert.equal(pooled.n, 110)
  assert.equal(pooled.chances, 1020)
  assert.ok(Math.abs(pooled.perChance - 110 / 1020) < 1e-12)
  // Not the mean of 0.1 and 0.5.
  assert.ok(pooled.perChance < 0.2)
  assert.ok(Math.abs(pooled.rate - 42 / 110) < 1e-12)
})

test('inningSeries: a season that never went to extras draws nine columns', () => {
  const series = seriesOf([inn({ inning: 1 }), inn({ inning: 9 })])
  assert.equal(series.length, 2)
  assert.equal(series.some((r) => r.extras), false)
  assert.deepEqual(inningSeries(null), [])
})

test('inningSeries: an extras column with no chances on file has no rate, not a zero', () => {
  const series = seriesOf([inn({ inning: 1 }), inn({ inning: 10, n: 0, success: 0, chances: 0 })])
  const pooled = series.find((r) => r.extras)
  assert.equal(pooled.perChance, null)
  assert.equal(pooled.rate, null)
})

test('roleInnings: regulation only, because the pooled column belongs to the club chart', () => {
  const summary = {
    byInningRole: [
      { inning: 9, role: 'catcher', n: 10, success: 5, chances: 100, perChance: 0.1 },
      { inning: 10, role: 'catcher', n: 1, success: 0, chances: 8, perChance: 0.125 },
      { inning: 9, role: 'batter', n: 8, success: 4, chances: 100, perChance: 0.08 },
    ],
  }
  assert.deepEqual(roleInnings(summary, 'catcher').map((r) => r.inning), [9])
  assert.equal(roleInnings(summary, 'pitcher').length, 0)
  assert.equal(roleInnings(null, 'catcher').length, 0)
})

test('roleInnings: the roles are divided by the CLUB’s chances, so they add back up to it', () => {
  // The invariant the panels are read on. Each role's row carries the club's
  // own chances, so the three per-chance figures sum to the club's — a panel
  // drawn on a role's own half of the chances would sum to twice it.
  const summary = {
    byInning: [{ inning: 1, n: 30, success: 15, rate: 0.5, chances: 300, perChance: 0.1 }],
    byInningRole: [
      { inning: 1, role: 'batter', n: 12, success: 6, chances: 300, perChance: 0.04 },
      { inning: 1, role: 'catcher', n: 17, success: 8, chances: 300, perChance: 17 / 300 },
      { inning: 1, role: 'pitcher', n: 1, success: 1, chances: 300, perChance: 1 / 300 },
    ],
  }
  const club = inningSeries(summary)[0].perChance
  const roles = ['batter', 'catcher', 'pitcher']
    .map((r) => roleInnings(summary, r)[0].perChance)
    .reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(roles - club) < 1e-12)
})

test('roleSpan: the two numbers that let a stat line replace a panel', () => {
  const summary = {
    byInningRole: [
      { inning: 1, role: 'pitcher', n: 2, success: 1, chances: 1000, perChance: 0.0018 },
      { inning: 5, role: 'pitcher', n: 3, success: 1, chances: 1000, perChance: 0.0031 },
      // An extra inning, which the span must not reach into.
      { inning: 11, role: 'pitcher', n: 1, success: 0, chances: 10, perChance: 0.1 },
    ],
  }
  assert.deepEqual(roleSpan(summary, 'pitcher'), { low: 0.0018, high: 0.0031 })
  // Nothing to measure means no sentence, rather than an empty one.
  assert.equal(roleSpan(summary, 'catcher'), null)
  assert.equal(roleSpan(null, 'pitcher'), null)
})
