import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateGameFouls } from '../scripts/gen-fouls.mjs'
import {
  batterFoulLine,
  pitcherFoulLine,
  foulLeaders,
  leagueFoulRates,
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

const play = ({ inning = 1, half = 'top', eventType = 'strikeout', batter, pitcher, events }) => ({
  about: { inning, halfInning: half },
  result: { eventType },
  matchup: { batter: { id: batter, fullName: `Batter ${batter}` }, pitcher: { id: pitcher, fullName: `Pitcher ${pitcher}` } },
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
  // Pitch-type tally (all 'FF' here).
  assert.equal(agg.pitchTypes.get('FF').pitches, 3)
  assert.equal(agg.pitchTypes.get('FF').fouls, 2)
})

// --- reader selectors --------------------------------------------------------
const readerData = {
  season: 2026,
  batters: {
    500: { name: 'Foul King', teamId: 1, g: 40, pa: 160, pitchesSeen: 700, fouls: 120, twoStrikeFouls: 50, maxGameFouls: 7, maxGamePk: 999 },
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
}

test('batterFoulLine derives per-game and per-PA rates', () => {
  const line = batterFoulLine(readerData, 500)
  assert.equal(line.foulsPerGame, 3) // 120 / 40
  assert.equal(line.foulsPerPA, 0.75) // 120 / 160
  assert.equal(line.twoStrikeFoulsPerGame, 1.25) // 50 / 40
  assert.equal(line.maxGameFouls, 7)
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
