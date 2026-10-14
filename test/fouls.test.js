import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '../scripts/lib/db.js'
import { aggregateGameFouls, exportFouls, exportFoulStore, foldGame, foulStatements, scopeOfGameType, wipeTeamPitchTypes } from '../scripts/gen-fouls.mjs'
import { exportGameFouls } from '../scripts/lib/fouls/byCount.mjs'
import { rebuildCommand, rebuildCounts } from '../scripts/lib/fouls/rebuild.mjs'
import { pendingGames, sweepFouls } from '../scripts/lib/fouls/sweep.mjs'
import { withGameFouls } from '../src/api/person/gameLog.js'
import {
  fetchBatterGameFouls,
  foulCountCells,
  foulsInScope,
  compareFoulsInScope,
  foulCardView,
  hasPostseason,
  batterFoulLine,
  pitcherFoulLine,
  foulLeaders,
  leagueFoulRates,
  topFoulGames,
  teamPitchTypeRates,
  FOUL_PRIORS,
  MIN_BATTER_GAMES,
} from '../src/api/fouls.js'

// --- helpers to build a tiny synthetic feed ----------------------------------
// A pitch event: `count` is the count AFTER the pitch (the API's off-by-one),
// so callers pass the post-pitch strike total.
const pitch = (code, postStrikes, typeCode = 'FF') => ({
  isPitch: true,
  details: { call: { code }, type: { code: typeCode, description: typeCode } },
  count: { strikes: postStrikes },
})

// `outs`/`on1`/`on2`/`on3`/`awayScore`/`homeScore` are this PLAY's own
// (POST-play) state — matches the real feed's off-by-one convention, so a
// later play's "entering" snapshot is whatever the PRIOR play sets here.
const play = ({
  inning = 1, half = 'top', eventType = 'strikeout', event = '', description = '', batter, pitcher, events,
  outs = 0, on1 = false, on2 = false, on3 = false, awayScore = 0, homeScore = 0,
}) => ({
  about: { inning, halfInning: half },
  result: { eventType, event, description, awayScore, homeScore },
  count: { outs },
  matchup: {
    batter: { id: batter, fullName: `Batter ${batter}` },
    pitcher: { id: pitcher, fullName: `Pitcher ${pitcher}` },
    postOnFirst: on1 ? { id: 901 } : undefined,
    postOnSecond: on2 ? { id: 902 } : undefined,
    postOnThird: on3 ? { id: 903 } : undefined,
  },
  playEvents: events,
})

const feedWith = (plays) => ({
  gameData: { teams: { away: { id: 1 }, home: { id: 2 } } },
  liveData: {
    boxscore: { teams: { away: { pitchers: [100] }, home: { pitchers: [200] } } },
    plays: { allPlays: plays },
  },
})

test('a foul at one strike counts as a foul but NOT a two-strike foul', () => {
  // Pitch 1: called strike (post 1). Pitch 2: FOUL at pre-strikes 1 (post 2).
  // Pitch 3: FOUL at pre-strikes 2 (post 2). Only pitch 3 is a two-strike foul.
  const agg = aggregateGameFouls(
    feedWith([
      play({
        batter: 10,
        pitcher: 200,
        eventType: 'strikeout',
        events: [pitch('C', 1), pitch('F', 2), pitch('F', 2)],
      }),
    ]),
  )
  const b = agg.batters.get(10)
  assert.equal(b.fouls, 2)
  assert.equal(b.twoStrikeFouls, 1)
  assert.equal(b.pa, 1)
  assert.equal(b.pitchesSeen, 3)
  assert.equal(b.gameFouls, 2)
  assert.equal(b.opponentId, 2, 'the away batter\'s opponent is the home team')
})

test('the pre-pitch strike count carries across a mid-AB non-PA (stolen base) play', () => {
  // Batter 11 works to two strikes, a stolen base (a NON_PA play) interrupts —
  // its pitches carry the count — then his at-bat resumes and he fouls the very
  // first pitch of the resumed play, which must register as a two-strike foul.
  const agg = aggregateGameFouls(
    feedWith([
      play({
        batter: 11,
        pitcher: 200,
        eventType: 'stolen_base_2b', // NON_PA — count carries, no PA counted
        events: [pitch('C', 1), pitch('C', 2)],
      }),
      play({
        batter: 11,
        pitcher: 200,
        eventType: 'walk', // resumed at-bat
        events: [pitch('F', 2)], // foul on the first pitch here, but pre-strikes = 2 via carry
      }),
    ]),
  )
  const b = agg.batters.get(11)
  assert.equal(b.fouls, 1)
  assert.equal(b.twoStrikeFouls, 1, 'carry across the non-PA play makes this a two-strike foul')
  assert.equal(b.pa, 1, 'the non-PA stolen-base play is not a plate appearance')
  assert.equal(b.pitchesSeen, 3)
})

test('team, pitcher, inning, and 10+ fold aggregates roll up correctly', () => {
  const agg = aggregateGameFouls(
    feedWith([
      play({ inning: 1, batter: 10, pitcher: 200, events: [pitch('F', 1), pitch('S', 1)] }),
      play({ inning: 12, batter: 12, pitcher: 200, eventType: 'single', events: [pitch('F', 0)] }),
    ]),
  )
  // Team 1 (away) fouls: batter 10 one + batter 12 one = 2.
  assert.equal(agg.teams.get(1).fouls, 2)
  // Pitcher 200 is the home starter (faces the top half), 3 pitches, 1 whiff.
  const p = agg.pitchers.get(200)
  assert.equal(p.isStarter, true)
  assert.equal(p.pitches, 3)
  assert.equal(p.whiffs, 1)
  assert.equal(p.fouls, 2)
  // Inning 12 folds into bucket 10; there is no bucket > 10.
  assert.ok(agg.innings.has(10))
  assert.ok(!agg.innings.has(12))
  assert.equal(agg.innings.get(10).fouls, 1)
  // All pitches were vs the starter.
  assert.equal(agg.innings.get(1).pitchesVsStarter, 2)
  assert.equal(agg.innings.get(1).pitchesVsReliever, 0)
  // Pitch-type tally (all 'FF' here): 3 pitches, 2 fouls ('F'), 1 whiff ('S').
  assert.equal(agg.pitchTypes.get('FF').pitches, 3)
  assert.equal(agg.pitchTypes.get('FF').fouls, 2)
  assert.equal(agg.pitchTypes.get('FF').whiffs, 1)
  // Both games' fouls are away team 1's total (2, batters 10 + 12); home team
  // 2 never batted in this fixture. Neither play set a score, so it's still 0-0.
  assert.deepEqual(agg.game, {
    awayId: 1, homeId: 2, awayFouls: 2, homeFouls: 0, totalFouls: 2, awayScore: 0, homeScore: 0,
  })
})

test('aggregateGameFouls splits the combined game total by home/away side and carries the final score', () => {
  const agg = aggregateGameFouls(
    feedWith([
      // Away batter fouls twice.
      play({ batter: 10, pitcher: 200, eventType: 'strikeout', events: [pitch('F', 1), pitch('F', 2)], awayScore: 2, homeScore: 0 }),
      // Home batter (bottom half) fouls once, off the away pitcher; this play's
      // score is the game's FINAL score (the running tracker's last update).
      play({ half: 'bottom', batter: 40, pitcher: 100, eventType: 'flyout', events: [pitch('F', 0)], awayScore: 2, homeScore: 3 }),
    ]),
  )
  assert.deepEqual(agg.game, {
    awayId: 1, homeId: 2, awayFouls: 2, homeFouls: 1, totalFouls: 3, awayScore: 2, homeScore: 3,
  })
})

test('the most-fouled plate appearance captures the situational context ENTERING it, from the prior play', () => {
  const agg = aggregateGameFouls(
    feedWith([
      // Sets the scene: 1 out recorded, nobody on, still scoreless. The NEXT
      // play's "entering" snapshot should read exactly this.
      play({ batter: 20, pitcher: 200, eventType: 'flyout', event: 'Flyout', outs: 1 }),
      // Our batter fouls twice then strikes out — outs=2/awayScore=1 here are
      // this PLAY's own post-state and must NOT leak into the entering snapshot.
      play({
        batter: 10, pitcher: 200, eventType: 'strikeout', event: 'Strikeout',
        description: 'Batter 10 strikes out swinging.',
        events: [pitch('F', 1), pitch('F', 2), pitch('S', 3)],
        outs: 2, awayScore: 1,
      }),
    ]),
  )
  const b = agg.batters.get(10)
  assert.equal(b.bestPaFouls, 2)
  assert.deepEqual(b.bestPa, {
    pitcherId: 200,
    pitcherName: 'Pitcher 200',
    resultEvent: 'Strikeout',
    resultType: 'strikeout',
    resultDescription: 'Batter 10 strikes out swinging.',
    paPitches: 3,
    inning: 1,
    half: 'top',
    battingTeamId: 1,
    opponentId: 2,
    outs: 1, // entering outs (the flyout before him), not the K's own post-outs
    onFirst: false,
    onSecond: false,
    onThird: false,
    awayScore: 0, // entering score, not this play's post-strikeout score
    homeScore: 0,
  })
})

test('a mid-AB interruption keeps the PA-foul tally AND the true entering snapshot, not the resumed segment\'s', () => {
  const agg = aggregateGameFouls(
    feedWith([
      // Runner on 1st, 0 out, 2-1 game — the TRUE state this PA starts in.
      play({ batter: 30, pitcher: 200, eventType: 'single', event: 'Single', outs: 0, on1: true, awayScore: 2, homeScore: 1 }),
      // Batter 11 fouls once, then a stolen base interrupts (NON_PA) — by the
      // time it resolves, outs/runners have changed (would be WRONG to use).
      play({
        batter: 11, pitcher: 200, eventType: 'stolen_base_2b',
        events: [pitch('F', 1)], outs: 0, on1: false, on2: true, awayScore: 2, homeScore: 1,
      }),
      // At-bat resumes and ends in a walk; this play's own outs/runners must
      // NOT overwrite the snapshot fixed on the first segment above.
      play({
        batter: 11, pitcher: 200, eventType: 'walk', event: 'Walk',
        events: [pitch('F', 1)], outs: 1, on1: true, on2: true, awayScore: 2, homeScore: 1,
      }),
    ]),
  )
  const b = agg.batters.get(11)
  assert.equal(b.bestPaFouls, 2, 'both fouls (across the interruption) belong to the one PA')
  assert.equal(b.bestPa.resultEvent, 'Walk')
  assert.equal(b.bestPa.paPitches, 2, 'pitch count carries across the interruption same as the foul tally')
  assert.equal(b.bestPa.outs, 0, 'entering outs from BEFORE the PA started, not after the steal')
  assert.equal(b.bestPa.onFirst, true, 'runner was on 1st when this PA STARTED, before the steal moved him to 2nd')
  assert.equal(b.bestPa.onSecond, false, 'nobody was on 2nd until the mid-PA steal — must not leak into the entering snapshot')
})

test('a batter\'s max-game score is oriented his/opp, not home/away', () => {
  const agg = aggregateGameFouls(
    feedWith([
      // Away batter 10 bats in the top half; final is away 5, home 3.
      play({ batter: 10, pitcher: 200, eventType: 'single', event: 'Single', events: [pitch('F', 0)], awayScore: 2, homeScore: 1 }),
      play({
        half: 'bottom', batter: 40, pitcher: 100, eventType: 'flyout', event: 'Flyout',
        events: [pitch('S', 0)], awayScore: 5, homeScore: 3,
      }),
    ]),
  )
  const away = agg.batters.get(10)
  assert.equal(away.gameHisScore, 5, 'away batter\'s own score is the final away score')
  assert.equal(away.gameOppScore, 3)
  const home = agg.batters.get(40)
  assert.equal(home.gameHisScore, 3, 'home batter\'s own score is the final home score')
  assert.equal(home.gameOppScore, 5)
})

test('aggregateGameFouls splits pitch-type tallies (fouls AND whiffs) by batting team and by pitching team', () => {
  const agg = aggregateGameFouls(
    feedWith([
      // Away batter 10 (team 1) faces home pitcher 200 (team 2): one FF, fouled (not a whiff).
      play({ batter: 10, pitcher: 200, eventType: 'strikeout', events: [pitch('F', 1, 'FF')] }),
      // Home batter 40 (team 2) faces away pitcher 100 (team 1): one SL, a SWINGING STRIKE
      // ('S' is a WHIFF_CODES entry, not a FOUL_CODES one) — whiffed, not fouled.
      play({ half: 'bottom', batter: 40, pitcher: 100, eventType: 'flyout', events: [pitch('S', 0, 'SL')] }),
    ]),
  )
  // Team 1's own batters saw the FF (fouled, not whiffed); team 2's own pitchers threw it.
  assert.deepEqual(agg.battingPitchTypes.get(1).get('FF'), { description: 'FF', pitches: 1, fouls: 1, whiffs: 0 })
  assert.deepEqual(agg.pitchingPitchTypes.get(2).get('FF'), { description: 'FF', pitches: 1, fouls: 1, whiffs: 0 })
  // Team 2's own batters saw the SL (whiffed, not fouled); team 1's own pitchers threw it.
  assert.deepEqual(agg.battingPitchTypes.get(2).get('SL'), { description: 'SL', pitches: 1, fouls: 0, whiffs: 1 })
  assert.deepEqual(agg.pitchingPitchTypes.get(1).get('SL'), { description: 'SL', pitches: 1, fouls: 0, whiffs: 1 })
  // No cross-contamination: a team's batting tally never picks up a pitch it
  // only PITCHED, and vice versa.
  assert.ok(!agg.battingPitchTypes.get(1).has('SL'))
  assert.ok(!agg.pitchingPitchTypes.get(1).has('FF'))
  assert.ok(!agg.battingPitchTypes.get(2).has('FF'))
  assert.ok(!agg.pitchingPitchTypes.get(2).has('SL'))
})

// --- reader selectors --------------------------------------------------------
const readerData = {
  season: 2026,
  batters: {
    500: { name: 'Foul King', teamId: 1, g: 40, pa: 160, pitchesSeen: 700, fouls: 120, twoStrikeFouls: 50, maxGameFouls: 7, maxGamePk: 999, maxGamePa: 5, maxGamePitches: 34, maxGameOpponentId: 2, maxGameHisScore: 6, maxGameOppScore: 4, maxGameDate: '2026-06-07' },
    501: { name: 'Rare Fouler', teamId: 2, g: 5, pa: 20, pitchesSeen: 80, fouls: 6, twoStrikeFouls: 2, maxGameFouls: 2, maxGamePk: 998 },
    502: { name: 'Team2 Bat', teamId: 2, g: 30, pa: 120, pitchesSeen: 500, fouls: 60, twoStrikeFouls: 20, maxGameFouls: 4, maxGamePk: 997 },
  },
  pitchers: {
    600: { name: 'Barrel Misser', teamId: 1, g: 20, pitches: 1500, fouls: 300, whiffs: 100, isStarter: true },
    601: { name: 'Low Volume', teamId: 1, g: 3, pitches: 120, fouls: 20, whiffs: 5, isStarter: false },
    602: { name: 'Whiffless', teamId: 2, g: 15, pitches: 400, fouls: 80, whiffs: 0, isStarter: false },
  },
  teams: { 1: { g: 41, fouls: 700, twoStrikeFouls: 260 }, 2: { g: 40, fouls: 650, twoStrikeFouls: 240 } },
  league: {
    byInning: [
      { inning: 1, pitches: 1000, fouls: 190, vsStarter: { pitches: 900, fouls: 180 }, vsReliever: { pitches: 100, fouls: 10 } },
      { inning: 9, pitches: 800, fouls: 120, vsStarter: { pitches: 100, fouls: 12 }, vsReliever: { pitches: 700, fouls: 108 } },
    ],
    byPitchType: [
      { code: 'FF', description: 'Four-Seam Fastball', pitches: 1000, fouls: 200 },
      { code: 'SL', description: 'Slider', pitches: 500, fouls: 60 },
    ],
    totals: { pitches: 1800, fouls: 310, twoStrikeFouls: 120 },
  },
  topFoulGames: [
    { gamePk: 111, date: '2026-05-01', homeTeamId: 2, homeFouls: 14, homeScore: 4, awayTeamId: 1, awayFouls: 10, awayScore: 3, totalFouls: 24 },
    { gamePk: 112, date: '2026-05-02', homeTeamId: 3, homeFouls: 9, homeScore: 2, awayTeamId: 2, awayFouls: 8, awayScore: 5, totalFouls: 17 },
    { gamePk: 113, date: '2026-05-03', homeTeamId: 3, homeFouls: 6, homeScore: 1, awayTeamId: 4, awayFouls: 5, awayScore: 6, totalFouls: 11 },
  ],
  teamPitchTypes: {
    batting: {
      1: [
        { code: 'FF', description: 'Four-Seam Fastball', pitches: 200, fouls: 36, whiffs: 22 },
        { code: 'SL', description: 'Slider', pitches: 40, fouls: 4, whiffs: 9 },
      ],
    },
    pitching: {
      1: [
        { code: 'FF', description: 'Four-Seam Fastball', pitches: 150, fouls: 45, whiffs: 18 },
      ],
    },
  },
}

test('batterFoulLine derives per-game and per-PA rates', () => {
  const line = batterFoulLine(readerData, 500)
  assert.equal(line.foulsPerGame, 3) // 120 / 40
  assert.equal(line.foulsPerPA, 0.75) // 120 / 160
  assert.equal(line.twoStrikeFoulsPerGame, 1.25) // 50 / 40
  assert.equal(line.maxGameFouls, 7)
  assert.equal(line.maxGamePa, 5)
  assert.equal(line.maxGamePitches, 34)
  assert.equal(line.maxGameOpponentId, 2)
  assert.equal(line.maxGameHisScore, 6)
  assert.equal(line.maxGameOppScore, 4)
  assert.equal(line.maxGameDate, '2026-06-07')
  assert.equal(batterFoulLine(readerData, 999999), null)
})

test('pitcherFoulLine derives foul% and fouls-to-whiffs, null-safe on zero whiffs', () => {
  const line = pitcherFoulLine(readerData, 600)
  assert.equal(line.foulPct, 0.2) // 300 / 1500
  assert.equal(line.foulsToWhiffs, 3) // 300 / 100
  assert.equal(pitcherFoulLine(readerData, 602).foulsToWhiffs, null, 'no whiffs -> null ratio')
})

test('foulLeaders applies floors and scopes to a team', () => {
  const league = foulLeaders(readerData, { scope: 'league' })
  // Batter 501 (5 games) is below MIN_BATTER_GAMES and excluded.
  const batterIds = league.batters.byFouls.map((r) => r.personId)
  assert.ok(batterIds.includes(500))
  assert.ok(batterIds.includes(502))
  assert.ok(!batterIds.includes(501))
  assert.equal(league.batters.byFouls[0].personId, 500) // most fouls leads

  // Pitcher 601 (120 pitches) is below MIN_PITCHER_PITCHES and excluded.
  const pitcherIds = league.pitchers.byFoulPct.map((r) => r.personId)
  assert.ok(!pitcherIds.includes(601))
  // byFoulsToWhiffs drops the whiffless pitcher (602).
  assert.ok(!league.pitchers.byFoulsToWhiffs.some((r) => r.personId === 602))

  const team1 = foulLeaders(readerData, { scope: 1 })
  assert.deepEqual(team1.batters.byFouls.map((r) => r.personId), [500])
  assert.equal(MIN_BATTER_GAMES, 20)
})

test('leagueFoulRates computes overall + by-inning + by-pitch-type rates, sorted', () => {
  const rates = leagueFoulRates(readerData)
  assert.equal(rates.foulRate, Number((310 / 1800).toFixed(4)))
  const inn1 = rates.byInning.find((r) => r.inning === 1)
  assert.equal(inn1.vsStarter.foulRate, 0.2) // 180 / 900
  assert.equal(inn1.vsReliever.foulRate, 0.1) // 10 / 100
  // Pitch types sorted by foul rate desc: FF (0.20) before SL (0.12).
  assert.deepEqual(rates.byPitchType.map((r) => r.code), ['FF', 'SL'])
})

test('topFoulGames ranks by combined total, caps to n, and scopes to one team', () => {
  const league = topFoulGames(readerData)
  assert.deepEqual(league.map((g) => g.gamePk), [111, 112, 113], 'already ranked by the generator, highest total first')

  const capped = topFoulGames(readerData, { n: 2 })
  assert.equal(capped.length, 2)

  // Team 2 is the away side of game 111 and the home side of game 112 — both
  // should surface; game 113 (teams 3/4) should not.
  const team2 = topFoulGames(readerData, { scope: 2 })
  assert.deepEqual(team2.map((g) => g.gamePk), [111, 112])

  assert.deepEqual(topFoulGames(null), [])
})

test('teamPitchTypeRates computes both sides for one team, sorted, null for no teamId', () => {
  const rates = teamPitchTypeRates(readerData, 1)
  assert.equal(rates.batting[0].code, 'FF', 'higher foul rate (18%) sorts first')
  assert.equal(rates.batting[0].foulRate, 0.18) // 36 / 200
  assert.equal(rates.batting[1].code, 'SL')
  assert.equal(rates.batting[1].foulRate, 0.1) // 4 / 40
  assert.equal(rates.pitching[0].code, 'FF')
  assert.equal(rates.pitching[0].foulRate, 0.3) // 45 / 150 — team 1's PITCHERS get fouled off more than its batters

  // Raw whiff counts ride straight through from the precompute, unaltered.
  assert.equal(rates.batting[0].whiffs, 22)
  assert.equal(rates.pitching[0].whiffs, 18)

  // A team with no rows at all degrades to empty arrays, not a crash.
  const noData = teamPitchTypeRates(readerData, 999)
  assert.deepEqual(noData.batting, [])
  assert.deepEqual(noData.pitching, [])

  assert.equal(teamPitchTypeRates(readerData, null), null)
})

test('reader selectors are null-safe on missing data', () => {
  assert.equal(batterFoulLine(null, 500), null)
  assert.equal(pitcherFoulLine(null, 600), null)
  assert.equal(leagueFoulRates(null), null)
  assert.equal(leagueFoulRates({}), null)
  const empty = foulLeaders(null, {})
  assert.deepEqual(empty.batters.byFouls, [])
  assert.deepEqual(empty.pitchers.byFoulsToWhiffs, [])
})

test('FOUL_PRIORS carries the literature constants for UI copy', () => {
  assert.equal(FOUL_PRIORS.hitProbFoulRoute2K, 0.291)
  assert.equal(FOUL_PRIORS.hitProbOtherRoute2K, 0.102)
  assert.equal(FOUL_PRIORS.hitProbFoulRoute2K3Fouls, 0.335)
  assert.match(FOUL_PRIORS.source, /SABR/)
})

// --- the season store (ADR-0086, #1200) ----------------------------------------
// Before, every foul table was keyed on the player (or club, inning, pitch
// type) alone, and the upsert added the counts: the first 2027 game added onto
// the 2026 totals and relabeled them 2027 (#1168).

// One game: batter 10 (away) fouls `fouls` pitches off starter 200 (home).
const gameFeed = (fouls) =>
  feedWith([
    play({ batter: 10, pitcher: 200, events: [...Array(fouls)].map(() => pitch('F', 1)).concat(pitch('S', 2)) }),
  ])
const foldInto = (db, gamePk, date, season, fouls) =>
  foldGame(db, foulStatements(db), gamePk, date, season, aggregateGameFouls(gameFeed(fouls)))
const withoutStamp = ({ asOf: _asOf, ...rest }) => rest
const emptyDb = () => openDb(mkdtempSync(join(tmpdir(), 'fouls-')))
const foldScoped = (db, gamePk, date, season, fouls, scope) =>
  foldGame(db, foulStatements(db), gamePk, date, season, aggregateGameFouls(gameFeed(fouls)), scope)

test('a 2027 game leaves the 2026 foul totals alone, and 2027 holds only that game', async () => {
  const db = await emptyDb()
  foldInto(db, 1, '2026-09-01', 2026, 3)
  foldInto(db, 2, '2026-09-02', 2026, 5)
  const before = withoutStamp(exportFouls(db, 2026))

  foldInto(db, 3, '2027-03-25', 2027, 2)

  assert.deepEqual(withoutStamp(exportFouls(db, 2026)), before)
  assert.equal(before.batters[10].g, 2)
  assert.equal(before.batters[10].fouls, 8)
  const s27 = exportFouls(db, 2027)
  assert.equal(s27.season, 2027)
  assert.equal(s27.gamesIngested, 1)
  assert.equal(s27.coverageSince, '2027-03-25')
  assert.equal(s27.batters[10].g, 1)
  assert.equal(s27.batters[10].fouls, 2)
  assert.equal(s27.pitchers[200].g, 1)
  // Starts ride the row, so a client sum of seasons can rebuild isStarter
  // exactly as the all/ file does (#1201).
  assert.equal(s27.pitchers[200].gs, 1)
  assert.equal(exportFouls(db, null).pitchers[200].gs, 3)
  assert.equal(s27.teams[1].fouls, 2)
  assert.equal(s27.league.totals.pitches, 3)
  assert.deepEqual(s27.topFoulGames.map((g) => g.gamePk), [3])
  assert.equal(s27.batters[10].bestPa.gamePk, 3)
})

test('the team pitch-type rebuild wipes only its own season', async () => {
  const db = await emptyDb()
  foldInto(db, 1, '2026-09-01', 2026, 3)
  foldInto(db, 3, '2027-03-25', 2027, 2)
  const targets = wipeTeamPitchTypes(db, 2027)
  assert.deepEqual(targets.map((g) => g.game_pk), [3])
  assert.deepEqual(exportFouls(db, 2027).teamPitchTypes, { batting: {}, pitching: {} })
  assert.equal(exportFouls(db, 2026).teamPitchTypes.batting[1][0].fouls, 3)
})

test('all seasons add counts, keep the higher single-game high, and rebuild a share from counts', async () => {
  const db = await emptyDb()
  foldInto(db, 1, '2026-09-01', 2026, 6)
  foldInto(db, 3, '2027-03-25', 2027, 2)
  foldInto(db, 4, '2027-03-26', 2027, 1)
  const all = exportFouls(db, null)
  assert.deepEqual(all.seasons, [2026, 2027])
  assert.equal(all.gamesIngested, 3)
  assert.equal(all.coverageSince, '2026-09-01')
  const b = all.batters[10]
  assert.equal(b.g, 3)
  assert.equal(b.fouls, 9)
  assert.equal(b.maxGameFouls, 6)
  assert.equal(b.maxGamePk, 1)
  assert.equal(b.bestPa.gamePk, 1)
  // isStarter is a share of appearances (starts * 2 > games), so it is rebuilt
  // from the summed counts, never carried from one season's flag.
  assert.equal(all.pitchers[200].g, 3)
  assert.equal(all.pitchers[200].isStarter, true)
  assert.equal(all.league.byPitchType[0].pitches, 12)
  assert.equal(all.league.totals.fouls, 9)
  assert.equal(all.topFoulGames.length, 3)
})

// --- the postseason beside the regular season (ADR-0102, #1511) ----------------

test('a postseason game never moves the regular-season export, and sits beside it as post', async () => {
  const db = await emptyDb()
  foldScoped(db, 1, '2026-09-01', 2026, 3, 'R')
  const before = withoutStamp(exportFouls(db, 2026))
  const allBefore = withoutStamp(exportFouls(db, null))
  assert.equal(exportFoulStore(db, 2026).post, undefined, 'no post key until a postseason game is on file')

  foldScoped(db, 2, '2026-10-05', 2026, 9, 'P')

  assert.deepEqual(withoutStamp(exportFouls(db, 2026)), before)
  assert.deepEqual(withoutStamp(exportFouls(db, null)), allBefore)
  const store = exportFoulStore(db, 2026)
  assert.equal(store.batters[10].fouls, 3, 'the same batter keeps his regular-season row')
  assert.equal(store.post.batters[10].fouls, 9, 'and the postseason row is his own')
  assert.equal(store.post.pitchers[200].g, 1)
  assert.equal(store.post.gamesIngested, 1)
  assert.equal(store.post.coverageSince, '2026-10-05')
  assert.deepEqual(store.topFoulGames.map((g) => g.gamePk), [1])
  assert.deepEqual(store.post.topFoulGames.map((g) => g.gamePk), [2])
  assert.equal(store.post.batters[10].maxGameDate, '2026-10-05')
  assert.equal(store.post.season, undefined)
  assert.equal(store.post.asOf, undefined)
  assert.equal(store.league.byPitchType[0].pitches, 4, 'league rows carry no postseason pitch')
  assert.equal(store.post.league.byPitchType[0].pitches, 10)
  assert.equal(store.post.teamPitchTypes.batting[1][0].fouls, 9)
  assert.equal(store.teamPitchTypes.batting[1][0].fouls, 3)
})

test('an old dump line that names no scope loads as the regular season', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fouls-old-'))
  const { writeFileSync } = await import('node:fs')
  writeFileSync(
    join(dir, 'fouls.sql'),
    'INSERT INTO foul_ingested_games (game_pk, date, season) VALUES (7, \'2026-09-01\', 2026);\n' +
      'INSERT INTO foul_team_totals (team_id, season, games, fouls, two_strike_fouls) VALUES (1, 2026, 4, 40, 10);\n',
  )
  const db = await openDb(dir)
  assert.equal(db.prepare('SELECT scope FROM foul_ingested_games').get().scope, 'R')
  assert.equal(exportFouls(db, 2026).teams[1].fouls, 40)
  assert.equal(exportFouls(db, 2026, 'P').gamesIngested, 0)
})

test('the scope of a postseason game is stored on its ledger row and its game totals', async () => {
  const db = await emptyDb()
  foldScoped(db, 2, '2026-10-05', 2026, 9, 'P')
  assert.deepEqual(db.prepare('SELECT game_pk, scope FROM foul_ingested_games').all().map((r) => ({ ...r })), [
    { game_pk: 2, scope: 'P' },
  ])
  assert.equal(db.prepare('SELECT scope FROM foul_game_totals WHERE game_pk = 2').get().scope, 'P')
  assert.deepEqual(wipeTeamPitchTypes(db, 2026).map((g) => g.scope), ['P'], 'the rebuild hands back each game with its scope')
})

test('a gameType maps to a scope: the postseason rounds are P, everything else R', () => {
  for (const t of ['F', 'D', 'L', 'W']) assert.equal(scopeOfGameType(t), 'P')
  for (const t of ['R', 'S', undefined]) assert.equal(scopeOfGameType(t), 'R')
})

test('foulsInScope lifts the postseason to the top and keeps the season labels; R is the file untouched', () => {
  const data = {
    season: 2026,
    asOf: 'x',
    gamesIngested: 100,
    batters: { 1: { fouls: 50 } },
    post: { gamesIngested: 3, batters: { 1: { fouls: 4 } }, coverageSince: '2026-09-29' },
  }
  assert.equal(foulsInScope(data, 'R'), data)
  const p = foulsInScope(data, 'P')
  assert.equal(p.season, 2026)
  assert.equal(p.gamesIngested, 3)
  assert.equal(p.batters[1].fouls, 4)
  assert.equal(p.post, undefined)
  assert.equal(data.batters[1].fouls, 50, 'the file itself is not touched')
})

test('without a postseason, every scope is the regular season and the toggle stays hidden', () => {
  const data = { season: 2026, gamesIngested: 100, batters: {} }
  assert.equal(hasPostseason(data), false)
  assert.equal(hasPostseason({ ...data, post: { gamesIngested: 0 } }), false)
  assert.equal(foulsInScope(data, 'P'), data)
  assert.equal(foulsInScope(null, 'P'), null)
})

// --- the postseason beside the regular season: review fixes (stack review) -----

test('a postseason-only player still gets the card, with no regular line to draw', () => {
  // FoulCard.jsx cannot be imported by the suite, so what it decides lives here.
  // A reliever used only in October has a `post` line and no regular one: the card
  // must show (the toggle is the way in) and must not hand a null line to its tiles.
  const data = { pitchers: {}, post: { gamesIngested: 3, pitchers: { 7: { pitches: 30, fouls: 5, whiffs: 2, g: 2 } } } }
  const v = foulCardView({ data, before: null, group: 'pitching', playerId: 7, vs: null, wantPost: false })
  assert.equal(v.show, true)
  assert.equal(v.hasPost, true)
  assert.equal(v.line, null, 'the regular view has nothing to draw: the card prints an empty note, not tiles')
  const post = foulCardView({ data, before: null, group: 'pitching', playerId: 7, vs: null, wantPost: true })
  assert.equal(post.line.fouls, 5)
})

test('a player with no line in either scope gets no card', () => {
  const data = { batters: {}, post: { gamesIngested: 3, batters: {} } }
  assert.equal(foulCardView({ data, before: null, group: 'hitting', playerId: 1, vs: null, wantPost: true }).show, false)
})

test('the card reads the compare season in the same scope as the main one', () => {
  const data = { batters: { 1: { fouls: 50, g: 100 } }, post: { gamesIngested: 3, batters: { 1: { fouls: 4, g: 3 } } } }
  const before = { batters: { 1: { fouls: 60, g: 120 } } }
  const reg = foulCardView({ data, before, group: 'hitting', playerId: 1, vs: 2025, wantPost: false })
  assert.equal(reg.prev.fouls, 60)
  const post = foulCardView({ data, before, group: 'hitting', playerId: 1, vs: 2025, wantPost: true })
  assert.equal(post.line.fouls, 4)
  assert.equal(post.prev, null, 'a season with no postseason has no October line to compare against')
})

test('compareFoulsInScope: a compare season with no postseason compares against nothing under Postseason', () => {
  const old = { season: 2024, gamesIngested: 100, batters: { 1: { fouls: 60 } } }
  assert.equal(compareFoulsInScope(old, 'P'), null, 'never its regular season under another name')
  assert.equal(compareFoulsInScope(old, 'R'), old)
  const withPost = { ...old, post: { gamesIngested: 2, batters: { 1: { fouls: 3 } } } }
  assert.equal(compareFoulsInScope(withPost, 'P').batters[1].fouls, 3)
  assert.equal(compareFoulsInScope(null, 'P'), null)
})

// --- fouls by count (#1881) and per game (#1914) -------------------------------
// A pitch with its post-pitch BALL count too: the 12 cells are keyed on the count BEFORE it.
const pitchAt = (code, balls, strikes) => ({ ...pitch(code, strikes), count: { balls, strikes } })
const cellsOf = (agg, id) => agg.batters.get(id).cells
const at = (balls, strikes) => balls * 3 + strikes

test('foul and swing cells sit on the PRE-pitch count; a PA reaches each count it was in', () => {
  // B (0-0 -> 1-0), C (1-0 -> 1-1), F (1-1 -> 1-2), F (1-2 -> 1-2), S (1-2 -> 1-3, strike three).
  const agg = aggregateGameFouls(
    feedWith([
      play({ batter: 10, pitcher: 200, events: [pitchAt('B', 1, 0), pitchAt('C', 1, 1), pitchAt('F', 1, 2), pitchAt('F', 1, 2), pitchAt('S', 1, 3)] }),
    ]),
  )
  const c = cellsOf(agg, 10)
  assert.equal(c.fouls[at(1, 1)], 1)
  assert.equal(c.fouls[at(1, 2)], 1)
  assert.equal(c.fouls.reduce((n, x) => n + x, 0), 2)
  // Swings are whiff + foul + in play: the 1-2 count saw a foul and the swinging strike three.
  assert.equal(c.swings[at(1, 2)], 2)
  assert.equal(c.swings[at(1, 1)], 1)
  assert.equal(c.swings[at(0, 0)], 0, 'a ball is no swing')
  assert.deepEqual([at(0, 0), at(1, 0), at(1, 1), at(1, 2)].map((i) => c.reach[i]), [1, 1, 1, 1])
  assert.equal(c.reach.reduce((n, x) => n + x, 0), 4)
})

test('the PA end is credited to every count the PA reached: hit, walk, strikeout, out', () => {
  const agg = aggregateGameFouls(
    feedWith([
      play({ batter: 10, pitcher: 200, eventType: 'single', events: [pitchAt('C', 0, 1), pitchAt('X', 0, 1)] }),
      play({ batter: 11, pitcher: 200, eventType: 'walk', events: [pitchAt('B', 1, 0), pitchAt('B', 2, 0), pitchAt('B', 3, 0), pitchAt('B', 4, 0)] }),
      play({ batter: 12, pitcher: 200, eventType: 'strikeout', events: [pitchAt('S', 0, 1), pitchAt('S', 0, 2), pitchAt('S', 0, 3)] }),
      play({ batter: 13, pitcher: 200, eventType: 'field_out', events: [pitchAt('X', 0, 0)] }),
      play({ batter: 14, pitcher: 200, eventType: 'hit_by_pitch', events: [pitchAt('H', 1, 0)] }),
    ]),
  )
  const one = (id, key) => cellsOf(agg, id)[key].reduce((n, x) => n + x, 0)
  assert.deepEqual([cellsOf(agg, 10).hit[at(0, 0)], cellsOf(agg, 10).hit[at(0, 1)]], [1, 1])
  assert.equal(one(10, 'hit'), 2, 'the single reached 0-0 and 0-1')
  assert.equal(one(11, 'walk'), 4, 'the walk reached 0-0, 1-0, 2-0, 3-0')
  assert.equal(cellsOf(agg, 11).walk[at(3, 0)], 1)
  assert.equal(one(12, 'so'), 3)
  assert.equal(one(13, 'out'), 1)
  assert.equal(one(14, 'walk'), 1, 'a hit by pitch is on base, with the walks')
  assert.equal(one(11, 'reach'), one(11, 'hit') + one(11, 'walk') + one(11, 'so') + one(11, 'out'))
})

test('the ball count carries across a non-PA play into the resumed at-bat', () => {
  const agg = aggregateGameFouls(
    feedWith([
      play({ batter: 11, pitcher: 200, eventType: 'stolen_base_2b', events: [pitchAt('B', 1, 0), pitchAt('C', 1, 1)] }),
      play({ batter: 11, pitcher: 200, eventType: 'walk', events: [pitchAt('F', 1, 2)] }),
    ]),
  )
  const c = cellsOf(agg, 11)
  assert.equal(c.fouls[at(1, 1)], 1, 'the foul is thrown from 1-1, carried over the stolen base')
  assert.equal(c.reach[at(0, 0)], 1, 'one PA, so one 0-0')
  assert.equal(c.reach.reduce((n, x) => n + x, 0), 3)
})

test('a pitch-clock violation (an event with a count and no pitch) moves the pre-pitch count', () => {
  // Feed shape from gamePk 823035: a "VP" event reads 1-0, then the first pitch is a strike at 1-1.
  const violation = { isPitch: false, details: { event: 'Pitch Clock Violation' }, count: { balls: 1, strikes: 0 } }
  const agg = aggregateGameFouls(
    feedWith([play({ batter: 10, pitcher: 200, events: [violation, pitchAt('F', 1, 1)] })]),
  )
  const c = cellsOf(agg, 10)
  assert.equal(c.fouls[at(1, 0)], 1)
  assert.equal(c.fouls[at(0, 0)], 0)
  assert.deepEqual([c.reach[at(0, 0)], c.reach[at(1, 0)]], [1, 1], 'it began in 0-0, so 0-0 is reached with no pitch from it')
})

test('per game: the batter row carries pitches, fouls and whiffs', () => {
  const agg = aggregateGameFouls(
    feedWith([play({ batter: 10, pitcher: 200, events: [pitchAt('C', 0, 1), pitchAt('F', 0, 2), pitchAt('S', 0, 3)] })]),
  )
  const b = agg.batters.get(10)
  assert.deepEqual([b.pitchesSeen, b.fouls, b.whiffs], [3, 1, 1])
})

// One game, batter 10 sees: C (0-0), F (0-1), S (0-2): fouls and swings on 0-1 and 0-2, whiff at 0-2.
const countGame = () =>
  feedWith([play({ batter: 10, pitcher: 200, eventType: 'strikeout', events: [pitchAt('C', 0, 1), pitchAt('F', 0, 2), pitchAt('S', 0, 3)] })])
const foldCounts = (db, gamePk, date, season, scope = 'R') =>
  foldGame(db, foulStatements(db), gamePk, date, season, aggregateGameFouls(countGame()), scope)

test('exportFouls: a batter row and the league carry the by-count cells, summed over games', async () => {
  const db = await emptyDb()
  foldCounts(db, 1, '2026-09-01', 2026)
  foldCounts(db, 2, '2026-09-02', 2026)
  const out = exportFouls(db, 2026)
  const bc = out.batters[10].byCount
  assert.equal(bc.reach[at(0, 0)], 2)
  assert.equal(bc.fouls[at(0, 1)], 2)
  assert.equal(bc.swings[at(0, 2)], 2)
  assert.equal(bc.so[at(0, 2)], 2)
  assert.deepEqual(out.league.byCount, bc, 'one batter, so the league is his cells')
})

test('the league median of the best at-bat counts hitters with 300+ PA only', async () => {
  const db = await emptyDb()
  const total = db.prepare("INSERT INTO foul_batter_totals (person_id, season, scope, name, pa) VALUES (?, 2026, 'R', 'x', ?)")
  const high = db.prepare("INSERT INTO foul_batter_pa_high (person_id, season, scope, fouls, game_pk) VALUES (?, 2026, 'R', ?, 1)")
  for (const [id, pa, fouls] of [[1, 300, 4], [2, 650, 9], [3, 420, 6], [4, 299, 20], [5, 100, 12]]) {
    total.run(id, pa)
    high.run(id, fouls)
  }
  assert.equal(exportFouls(db, 2026).league.medianBestPaFouls, 6)
  assert.equal(exportFouls(await emptyDb(), 2026).league.medianBestPaFouls, null, 'nobody qualifies')
})

test('exportGameFouls: [pitches, fouls, whiffs] per batter and gamePk, both scopes, rewritten not added', async () => {
  const db = await emptyDb()
  foldCounts(db, 1, '2026-09-01', 2026)
  foldCounts(db, 7, '2026-10-05', 2026, 'P')
  assert.deepEqual(exportGameFouls(db, 2026), { 10: { 1: [3, 1, 1], 7: [3, 1, 1] } })
  foldGame(db, foulStatements(db), 1, '2026-09-01', 2026, aggregateGameFouls(countGame()))
  assert.deepEqual(exportGameFouls(db, 2026)[10][1], [3, 1, 1], 'the same game folded again overwrites its row')
  assert.deepEqual(exportGameFouls(db, 2027), {})
})

test('the committed dump loads and exports the by-count cells and the per-game rows (after the 2026 re-read)', async () => {
  const db = await openDb()
  const out = exportFouls(db, 2026)
  assert.ok(Object.keys(out.batters).length > 100)
  assert.equal(Object.values(out.batters).some((b) => 'byCount' in b), true)
  assert.notEqual(out.league.byCount, null)
  assert.ok(Object.keys(exportGameFouls(db, 2026)).length > 100)
  // Turang 668930: 573 regular-season fouls, and his cells cover all 677 PA.
  assert.equal(out.batters['668930'].fouls, 574)
  assert.equal(out.batters['668930'].byCount.reach[0], 677)
})

test('rebuildCounts wipes ONE season of both tables and refills it from the ingested games', async () => {
  const db = await emptyDb()
  foldCounts(db, 1, '2026-09-01', 2026)
  foldCounts(db, 7, '2026-10-05', 2026, 'P')
  foldCounts(db, 3, '2027-03-25', 2027)
  const before = withoutStamp(exportFouls(db, 2026))
  const beforeGames = exportGameFouls(db, 2026)
  db.exec("UPDATE foul_batter_counts SET reach = 99 WHERE season = 2026; UPDATE foul_batter_games SET fouls = 99 WHERE season = 2026") // stale rows
  const asked = []
  const { done, failed } = await rebuildCounts(db, foulStatements(db), {
    season: 2026,
    aggregate: aggregateGameFouls,
    getFeed: async (pk) => (asked.push(pk), countGame()),
  })
  assert.deepEqual([done, failed], [2, []])
  assert.deepEqual(asked.sort(), [1, 7], 'both scopes of 2026, and not the 2027 game')
  assert.deepEqual(withoutStamp(exportFouls(db, 2026)), before)
  assert.deepEqual(exportGameFouls(db, 2026), beforeGames)
  assert.equal(exportFouls(db, 2027).batters[10].byCount.reach[0], 1, '2027 is untouched')
})

test('rebuildCounts names a game whose feed failed, and the wipe is not undone for it', async () => {
  const db = await emptyDb()
  foldCounts(db, 1, '2026-09-01', 2026)
  foldCounts(db, 2, '2026-09-02', 2026)
  const { done, failed } = await rebuildCounts(db, foulStatements(db), {
    season: 2026,
    aggregate: aggregateGameFouls,
    getFeed: async (pk) => {
      if (pk === 2) throw new Error('boom')
      return countGame()
    },
  })
  assert.equal(done, 2)
  assert.deepEqual(failed.map((g) => g.game_pk), [2])
  assert.deepEqual(Object.keys(exportGameFouls(db, 2026)[10]), ['1'], 'only game 1 is back')
  assert.equal('byCount' in exportFouls(db, 2026).batters[10], false, 'and the cells no longer cover his PA, so none show')
})

test('foulCountCells reads fouls per swing and how the PAs ended, and is null-safe', () => {
  const zero = () => new Array(12).fill(0)
  const byCount = { reach: zero(), fouls: zero(), swings: zero(), hit: zero(), walk: zero(), so: zero(), out: zero() }
  byCount.reach[at(0, 2)] = 10
  byCount.fouls[at(0, 2)] = 3
  byCount.swings[at(0, 2)] = 6
  byCount.so[at(0, 2)] = 4
  byCount.out[at(0, 2)] = 6
  const cells = foulCountCells(byCount)
  assert.equal(cells.length, 12)
  assert.equal(cells[at(0, 2)].count, '0-2')
  assert.equal(cells[at(0, 2)].foulsPerSwing, 0.5)
  assert.deepEqual(cells[at(0, 2)].ends, { hit: 0, walk: 0, so: 4, out: 6 })
  assert.equal(cells[at(3, 2)].count, '3-2')
  assert.equal(cells[at(0, 0)].foulsPerSwing, null, 'no swings, no rate')
  assert.equal(foulCountCells(null), null)
  assert.equal(batterFoulLine({ batters: { 5: { g: 1, byCount } } }, 5).byCount, byCount)
  assert.equal(batterFoulLine({ batters: { 5: { g: 1 } } }, 5).byCount, null)
})

test('withGameFouls adds a game\'s pitches, fouls and whiffs to its log row; no entry reads null', () => {
  const view = { rows: [{ gamePk: 1 }, { gamePk: 2 }] }
  const joined = withGameFouls(view, { 1: [90, 7, 5] })
  assert.deepEqual(joined.rows.map((r) => [r.pitchesSeen, r.fouls, r.whiffs]), [[90, 7, 5], [null, null, null]])
  assert.equal(joined.rows[0].gamePk, 1)
  assert.deepEqual(withGameFouls(view, null).rows[0].fouls, null)
  assert.equal(withGameFouls(null, {}), null)
})

test('fetchBatterGameFouls reads his games shard from the season store; a missing shard or id reads null', async (t) => {
  const files = {
    '/data/fouls/seasons.json': { seasons: [2026], current: 2026 },
    '/data/fouls/2026/71.games.json': { season: 2026, games: { 660271: { 824386: [20, 3, 1] } } },
  }
  t.mock.method(globalThis, 'fetch', async (url) => ({ ok: url in files, status: url in files ? 200 : 404, json: async () => files[url] }))
  assert.deepEqual(await fetchBatterGameFouls(660271), { 824386: [20, 3, 1] })
  assert.equal(await fetchBatterGameFouls(660272), null, 'no shard in his bucket')
  assert.equal(await fetchBatterGameFouls(171), null, 'a shard that does not hold him')
  assert.equal(await fetchBatterGameFouls(null), null)
})

test('byCount is exported only where the cells cover every PA, so a part-read season shows none', async () => {
  const db = await emptyDb()
  foldCounts(db, 1, '2026-09-01', 2026)
  assert.ok(exportFouls(db, 2026).batters[10].byCount)
  // Older games the cells never read: his PA total is ahead of the cells' 0-0 count.
  db.exec('UPDATE foul_batter_totals SET pa = pa + 5')
  const out = exportFouls(db, 2026)
  assert.equal('byCount' in out.batters[10], false)
  assert.equal(out.league.byCount, null, 'nobody complete, no league cells')
})

test('rebuildCommand refuses a bare flag or a non-year', async () => {
  const db = await emptyDb()
  const deps = { aggregate: aggregateGameFouls, getFeed: async () => countGame(), touched: new Set(), writeOut: async () => {} }
  for (const bad of [true, undefined, 'x', '1']) await assert.rejects(rebuildCommand(db, foulStatements(db), bad, deps), /needs a season/)
})

test('fouls in a PA that a caught stealing ends still reach the count cells, so the cells sum to his fouls', async () => {
  // PA 1 ends in play at 0-0. PA 2 is cut off in the 2nd inning: C (0-0), F (0-1), F (0-2), then the runner is
  // caught stealing for the third out. He never finishes it, so no plate appearance ends to credit `reach`.
  // The 0-1 and 0-2 fouls are real; the cells dropped them (2026: 18 batters were short by 1 or 2).
  const feed = feedWith([
    play({ batter: 10, pitcher: 200, eventType: 'field_out', events: [pitchAt('X', 0, 0)] }),
    play({
      batter: 10, pitcher: 200, inning: 2, eventType: 'caught_stealing_2b', outs: 3,
      events: [pitchAt('C', 0, 1), pitchAt('F', 0, 2), pitchAt('F', 0, 2)],
    }),
  ])
  const agg = aggregateGameFouls(feed)
  const b = agg.batters.get(10)
  assert.equal(b.fouls, 2)
  const db = await emptyDb()
  foldGame(db, foulStatements(db), 1, '2026-09-01', 2026, agg)
  const out = exportFouls(db, 2026).batters[10]
  const sum = (a) => a.reduce((n, x) => n + x, 0)
  assert.equal(out.fouls, 2)
  assert.equal(sum(out.byCount.fouls), 2, 'cells agree with the total')
  assert.equal(out.byCount.fouls[at(0, 1)], 1)
  assert.equal(out.byCount.fouls[at(0, 2)], 1)
  assert.equal(out.byCount.reach[at(0, 0)], 1, 'the cut-off PA is not a plate appearance')
})

test('rebuildCounts also rebuilds the season TOTALS, so a total folded under an old rule agrees with the cells', async () => {
  // Game 1 was folded before FOUL_CODES took 'O' (a bunt foul tip): the stored total holds 1 foul.
  // The feed now has F then O, so the re-read must give 2 in the total AND in the cells.
  const feed = () =>
    feedWith([play({ batter: 10, pitcher: 200, eventType: 'strikeout', events: [pitchAt('C', 0, 1), pitchAt('F', 0, 2), pitchAt('O', 0, 2), pitchAt('S', 0, 3)] })])
  const db = await emptyDb()
  foldGame(db, foulStatements(db), 1, '2026-09-01', 2026, aggregateGameFouls(countGame()))
  foldGame(db, foulStatements(db), 3, '2027-03-25', 2027, aggregateGameFouls(countGame()))
  assert.equal(exportFouls(db, 2026).batters[10].fouls, 1, 'the stale total')
  const teamRows = () => JSON.stringify(db.prepare('SELECT * FROM foul_team_totals ORDER BY season').all())
  const teamBefore = teamRows()
  const { failed } = await rebuildCounts(db, foulStatements(db), { season: 2026, aggregate: aggregateGameFouls, getFeed: async () => feed() })
  assert.deepEqual(failed, [])
  const b = exportFouls(db, 2026).batters[10]
  const sum = (a) => a.reduce((n, x) => n + x, 0)
  assert.equal(b.fouls, 2)
  assert.equal(b.g, 1, 'one game, not folded on top of the stale row')
  assert.equal(sum(b.byCount.fouls), b.fouls, 'total and cells come from the same feed')
  assert.equal(db.prepare('SELECT fouls FROM foul_pitcher_totals WHERE season = 2026 AND person_id = 200').get().fouls, 2)
  assert.equal(teamRows(), teamBefore, 'other tables are not touched')
  assert.equal(exportFouls(db, 2027).batters[10].fouls, 1, 'another season is not touched')
})

test('a failed re-read puts the stale season totals back: batter, best PA and pitcher rows', async () => {
  const db = await emptyDb()
  foldCounts(db, 1, '2026-09-01', 2026)
  foldCounts(db, 2, '2026-09-02', 2026)
  // Stale values the re-read would change: a successful game 1 would refold them to 1, 1 and 1.
  db.exec(`UPDATE foul_batter_totals SET fouls = 99 WHERE season = 2026;
           UPDATE foul_pitcher_totals SET fouls = 98 WHERE season = 2026;
           UPDATE foul_batter_pa_high SET fouls = 97 WHERE season = 2026`)
  const read = () => ({
    batter: db.prepare('SELECT fouls FROM foul_batter_totals WHERE season = 2026 AND person_id = 10').get().fouls,
    pitcher: db.prepare('SELECT fouls FROM foul_pitcher_totals WHERE season = 2026 AND person_id = 200').get().fouls,
    high: db.prepare('SELECT fouls FROM foul_batter_pa_high WHERE season = 2026 AND person_id = 10').get().fouls,
  })
  assert.deepEqual(read(), { batter: 99, pitcher: 98, high: 97 })
  const { failed } = await rebuildCounts(db, foulStatements(db), {
    season: 2026,
    aggregate: aggregateGameFouls,
    getFeed: async (pk) => {
      if (pk === 2) throw new Error('boom')
      return countGame()
    },
  })
  assert.deepEqual(failed.map((g) => g.game_pk), [2])
  assert.deepEqual(read(), { batter: 99, pitcher: 98, high: 97 })
})

// --- pitcher cells (#1993) -----------------------------------------------------
// The pitcher's side of the same cells: the pitches HE threw from each count, and the plate
// appearances he finished, credited to every count they reached.
const sumOf = (a) => a.reduce((n, x) => n + x, 0)

test('pitcher cells: the pitches he threw by count, and the PAs he ended, by how they ended', () => {
  const agg = aggregateGameFouls(countGame())
  const c = agg.pitchers.get(200).cells
  const { pitches, ...rest } = c
  assert.deepEqual(rest, agg.batters.get(10).cells, 'one batter and one pitcher, so the same cells')
  assert.equal(pitches[at(0, 0)], 1)
  assert.equal(c.fouls[at(0, 1)], 1)
  assert.equal(c.so[at(0, 2)], 1)
  assert.equal(c.reach[at(0, 0)], 1, 'one PA finished')
})

test('pitcher cells: a PA that a caught stealing cuts off keeps its fouls but not its reach', async () => {
  const agg = aggregateGameFouls(
    feedWith([
      play({ batter: 10, pitcher: 200, eventType: 'field_out', events: [pitchAt('X', 0, 0)] }),
      play({
        batter: 11, pitcher: 200, inning: 2, eventType: 'caught_stealing_2b', outs: 3,
        events: [pitchAt('C', 0, 1), pitchAt('F', 0, 2), pitchAt('F', 0, 2)],
      }),
    ]),
  )
  const c = agg.pitchers.get(200).cells
  assert.equal(sumOf(c.fouls), agg.pitchers.get(200).fouls, 'the cells agree with his total')
  assert.equal(c.reach[at(0, 0)], 1, 'only the finished PA is a batter faced')
  const db = await emptyDb()
  foldGame(db, foulStatements(db), 1, '2026-09-01', 2026, agg)
  assert.equal(sumOf(exportFouls(db, 2026).pitchers[200].byCount.fouls), 2)
})

test('exportFouls: a pitcher row carries his cells per scope, summed over games', async () => {
  const db = await emptyDb()
  foldCounts(db, 1, '2026-09-01', 2026)
  foldCounts(db, 2, '2026-09-02', 2026)
  foldCounts(db, 7, '2026-10-05', 2026, 'P')
  const out = exportFoulStore(db, 2026)
  assert.equal(out.pitchers[200].byCount.reach[at(0, 0)], 2)
  assert.equal(out.pitchers[200].byCount.fouls[at(0, 1)], 2)
  assert.equal(out.post.pitchers[200].byCount.reach[at(0, 0)], 1, 'the postseason beside it, not summed in')
  assert.equal(exportFouls(db, 2027).pitchers[200], undefined)
})

test('a pitcher shows cells only where they cover his pitches, so a part-read season shows none', async () => {
  const db = await emptyDb()
  foldCounts(db, 1, '2026-09-01', 2026)
  assert.ok(exportFouls(db, 2026).pitchers[200].byCount)
  db.exec('UPDATE foul_pitcher_totals SET pitches = pitches + 5') // games the cells never read
  assert.equal('byCount' in exportFouls(db, 2026).pitchers[200], false)
})

test('rebuildCounts refills the pitcher cells; a failed feed puts them back with the totals', async () => {
  const db = await emptyDb()
  foldCounts(db, 1, '2026-09-01', 2026)
  foldCounts(db, 2, '2026-09-02', 2026)
  db.exec('UPDATE foul_pitcher_counts SET reach = 99 WHERE season = 2026') // stale rows
  const run = (fail) =>
    rebuildCounts(db, foulStatements(db), {
      season: 2026,
      aggregate: aggregateGameFouls,
      getFeed: async (pk) => {
        if (pk === fail) throw new Error('boom')
        return countGame()
      },
    })
  await run(null)
  assert.equal(exportFouls(db, 2026).pitchers[200].byCount.reach[at(0, 0)], 2)
  db.exec('UPDATE foul_pitcher_counts SET reach = 98 WHERE season = 2026 AND count_idx = 0')
  await run(2)
  assert.equal(db.prepare('SELECT reach FROM foul_pitcher_counts WHERE season = 2026 AND count_idx = 0').get().reach, 98, 'cells and totals both back as they were')
})

test('a 0-foul game cannot hide a part-read store: coverage is the pitch count, not the fouls', async () => {
  // Game 9: pitcher 200 allows one groundout and no foul. The cells for it are then lost (the store
  // before the cells were added); the next fold adds game 1's cells only, so they hold 3 of 4 pitches.
  const db = await emptyDb()
  const groundout = feedWith([play({ batter: 10, pitcher: 200, eventType: 'field_out', events: [pitchAt('X', 0, 0)] })])
  foldGame(db, foulStatements(db), 9, '2026-08-30', 2026, aggregateGameFouls(groundout))
  db.exec('DELETE FROM foul_pitcher_counts')
  foldCounts(db, 1, '2026-09-01', 2026)
  const row = exportFouls(db, 2026).pitchers[200]
  assert.equal(row.pitches, 4)
  assert.equal('byCount' in row, false, 'the cells hold 3 of his 4 pitches, so none show')
})

test('pitcher cells: the pitches in the cells add up to his pitches', () => {
  const agg = aggregateGameFouls(countGame())
  assert.equal(sumOf(agg.pitchers.get(200).cells.pitches), agg.pitchers.get(200).pitches)
})

test('a play with no batter id still lands in the pitcher cells, as it does in his totals', () => {
  const agg = aggregateGameFouls(feedWith([play({ batter: undefined, pitcher: 200, events: [pitchAt('F', 0, 1), pitchAt('S', 0, 2)] })]))
  const p = agg.pitchers.get(200)
  assert.deepEqual([p.pitches, p.fouls], [2, 1])
  assert.equal(sumOf(p.cells.pitches), 2)
  assert.equal(sumOf(p.cells.fouls), 1)
})

test('a pitching change mid-PA: the play belongs to its matchup pitcher, in the cells as in the totals', () => {
  const change = { isPitch: false, details: { eventType: 'pitching_substitution' }, count: { balls: 0, strikes: 1 } }
  const agg = aggregateGameFouls(
    feedWith([play({ batter: 10, pitcher: 201, eventType: 'strikeout', events: [pitchAt('F', 0, 1), change, pitchAt('F', 0, 2), pitchAt('S', 0, 3)] })]),
  )
  assert.equal(agg.pitchers.has(200), false)
  const p = agg.pitchers.get(201)
  assert.deepEqual([p.pitches, p.fouls, sumOf(p.cells.pitches), sumOf(p.cells.fouls)], [3, 2, 3, 2])
  assert.equal(p.cells.reach[at(0, 0)], 1)
})

test('a PA that resumes after a caught stealing under a new pitcher: pitches stay with the pitcher of each play', () => {
  const agg = aggregateGameFouls(
    feedWith([
      play({ batter: 10, pitcher: 200, eventType: 'caught_stealing_2b', events: [pitchAt('F', 0, 1)] }),
      play({ batter: 10, pitcher: 201, eventType: 'strikeout', events: [pitchAt('F', 0, 2), pitchAt('S', 0, 3)] }),
    ]),
  )
  const [a, b] = [agg.pitchers.get(200), agg.pitchers.get(201)]
  assert.deepEqual([a.pitches, sumOf(a.cells.pitches), sumOf(a.cells.fouls), sumOf(a.cells.reach)], [1, 1, 1, 0])
  assert.deepEqual([b.pitches, sumOf(b.cells.pitches), sumOf(b.cells.fouls)], [2, 2, 1])
  assert.equal(b.cells.reach[at(0, 0)], 1, 'he finished the PA')
})

test('pitcherFoulLine and the league cells: byCount rides the line, null when the file has none', () => {
  const zero = () => new Array(12).fill(0)
  const byCount = { reach: zero(), fouls: zero(), swings: zero(), hit: zero(), walk: zero(), so: zero(), out: zero() }
  assert.equal(pitcherFoulLine({ pitchers: { 5: { g: 1, byCount } } }, 5).byCount, byCount)
  assert.equal(pitcherFoulLine({ pitchers: { 5: { g: 1 } } }, 5).byCount, null)
})

// #2024: a game whose feed fetch failed came back on no later run, because the
// nightly window moved past it. The sweep now also takes the season's older
// Final games that are not in the ledger.
test('sweepFouls takes back a Final game whose fetch failed on the run before', async () => {
  const db = await emptyDb()
  foldInto(db, 1, '2026-07-17', 2026, 1)
  const final = (gamePk, date) => ({ gamePk, officialDate: date, season: '2026', gameType: 'R', status: { abstractGameState: 'Final' } })
  const schedule = { dates: [
    { date: '2026-07-17', games: [final(1, '2026-07-17')] },
    { date: '2026-07-18', games: [final(2, '2026-07-18')] },
    { date: '2026-07-19', games: [final(4, '2026-07-19')] },
    { date: '2026-10-01', games: [{ ...final(3, '2026-10-01'), status: { abstractGameState: 'Live' } }] },
  ] }
  // Game 2's fetch fails on the first run only; game 4's fails every time.
  let up = false
  let touched
  const run = () =>
    sweepFouls(db, {
      schedule,
      startDate: '2026-09-30', // games 2 and 4 are older than the trailing window
      touched: (touched = new Set()),
      ingest: async (g) => {
        if (g.gamePk === 4 || !up) throw new Error('boom')
        foldInto(db, g.gamePk, g.date, g.season, 2)
      },
    })
  const inLedger = () => db.prepare('SELECT game_pk FROM foul_ingested_games ORDER BY game_pk').all().map((r) => r.game_pk)

  const first = await run()
  assert.deepEqual(first.failed.map((g) => g.gamePk).sort(), [2, 4])
  assert.deepEqual(first.again, [], 'one failure does not fail the run')
  assert.equal(touched.size, 0, 'a failed game writes no season (ADR-0086)')
  assert.deepEqual(inLedger(), [1])

  up = true
  const second = await run()
  assert.deepEqual(second.done, 2)
  assert.deepEqual(inLedger(), [1, 2])
  assert.equal(exportFouls(db, 2026).gamesIngested, 2)
  assert.deepEqual(second.again.map((g) => g.gamePk), [4], 'game 4 failed twice in a row')
  assert.deepEqual((await run()).pending.map((g) => g.gamePk), [4], 'only the failing game is left to sweep')
})

test('the older-than-window games are capped per run, and the window comes first', () => {
  const final = (gamePk, date) => ({ gamePk, officialDate: date, season: '2026', gameType: 'R', status: { abstractGameState: 'Final' } })
  const schedule = { dates: [
    { date: '2026-07-18', games: [final(2, '2026-07-18'), final(3, '2026-07-18'), final(4, '2026-07-18')] },
    { date: '2026-10-01', games: [final(5, '2026-10-01')] },
  ] }
  assert.deepEqual(pendingGames(schedule, new Set([3]), '2026-09-30', 1).map((g) => g.gamePk), [5, 2])
})
