// Unit coverage for src/api/logbookRetrospective.js — the Logbook
// retrospective's ported First Scorebook sections (ADR-0035).
//
// The one genuinely tricky case this suite exists to pin: a pitcher who
// STARTS one stamped game and RELIEVES in another must appear in both the
// rotation and the bullpen tables, each with only that role's own numbers —
// nothing here may blend a start's line into his relief totals or vice versa.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeLogbookRetrospective } from '../src/api/logbookRetrospective.js'

function stamp(gamePk, date) {
  return { gamePk, mode: 'watched', stampedAt: 1_700_000_000_000, updatedAt: 1_700_000_000_000, note: '', date }
}

function pitchingLine({
  gamesStarted = false,
  ip,
  h = 0,
  r = 0,
  er = 0,
  bb = 0,
  k = 0,
  pitches = 0,
  decision = '',
  saves = 0,
  holds = 0,
}) {
  const [whole, part] = ip.split('.')
  const outs = Number(whole) * 3 + Number(part)
  return {
    inningsPitched: ip,
    outs,
    numberOfPitches: pitches,
    battersFaced: 0,
    hits: h,
    runs: r,
    earnedRuns: er,
    baseOnBalls: bb,
    strikeOuts: k,
    gamesStarted,
    decision,
    saves,
    holds,
  }
}

function battingLine({ atBats, hits, doubles = 0, triples = 0, homeRuns = 0, rbi = 0, runs = 0, stolenBases = 0 }) {
  return {
    atBats,
    hits,
    doubles,
    triples,
    homeRuns,
    rbi,
    runs,
    stolenBases,
    caughtStealing: 0,
    baseOnBalls: 0,
    hitByPitch: 0,
    sacFlies: 0,
  }
}

function player({ id, name, teamId, teamAbbr, order = 0, batting = null, pitching = null }) {
  return {
    id,
    name,
    teamId,
    teamAbbr,
    order,
    battingAppeared: !!batting,
    pitchingAppeared: !!pitching,
    batting,
    pitching,
  }
}

function side(teamId, teamAbbr, players) {
  return { team: { id: teamId, abbreviation: teamAbbr, name: teamAbbr }, players }
}

// Game 101: STL @ MIL, 2026-04-01, MIL wins 6-2.
//   Peralta (MIL) STARTS: 6.0 IP, 5 H, 2 R, 2 ER, 1 BB, 8 K, 95 pitches, W.
//   Megill (MIL) RELIEVES: 1.0 IP, 1 H, 0 R, 0 ER, 0 BB, 1 K, 15 pitches, S.
//   Yelich (MIL) bats: 3-for-4, 2B, HR, 3 RBI, 2 R.
const GAME_101 = {
  away: side(138, 'STL', []),
  home: side(158, 'MIL', [
    player({
      id: 501,
      name: 'Freddy Peralta',
      teamId: 158,
      teamAbbr: 'MIL',
      pitching: pitchingLine({ gamesStarted: true, ip: '6.0', h: 5, r: 2, er: 2, bb: 1, k: 8, pitches: 95, decision: 'W' }),
    }),
    player({
      id: 502,
      name: 'Trevor Megill',
      teamId: 158,
      teamAbbr: 'MIL',
      order: 1,
      pitching: pitchingLine({ gamesStarted: false, ip: '1.0', h: 1, k: 1, pitches: 15, decision: 'S', saves: 1 }),
    }),
    player({
      id: 601,
      name: 'Christian Yelich',
      teamId: 158,
      teamAbbr: 'MIL',
      batting: battingLine({ atBats: 4, hits: 3, doubles: 1, homeRuns: 1, rbi: 3, runs: 2 }),
    }),
  ]),
}

// Game 102: MIL @ CHC, 2026-04-05, CHC wins — MIL's starter this time is
// Priester; Peralta pitches in RELIEF for MIL and picks up a hold.
//   Peralta (MIL) RELIEVES: 1.0 IP, 2 H, 1 R, 1 ER, 1 BB, 1 K, 20 pitches, hold.
//   Yelich (MIL) bats: 1-for-4.
const GAME_102 = {
  away: side(158, 'MIL', [
    player({
      id: 501,
      name: 'Freddy Peralta',
      teamId: 158,
      teamAbbr: 'MIL',
      pitching: pitchingLine({ gamesStarted: false, ip: '1.0', h: 2, r: 1, er: 1, bb: 1, k: 1, pitches: 20, holds: 1 }),
    }),
    player({
      id: 601,
      name: 'Christian Yelich',
      teamId: 158,
      teamAbbr: 'MIL',
      order: 1,
      batting: battingLine({ atBats: 4, hits: 1 }),
    }),
  ]),
  home: side(112, 'CHC', []),
}

const STAMPS = [stamp(101, '2026-04-01'), stamp(102, '2026-04-05')]
const FACTS = {
  101: { date: '2026-04-01', winnerId: 158 },
  102: { date: '2026-04-05', winnerId: 112 },
}
const BOXSCORES = { 101: GAME_101, 102: GAME_102 }

test('best individual performances rank a big batting line above a middling start', () => {
  const { performances } = computeLogbookRetrospective(STAMPS, FACTS, BOXSCORES, {})
  const top = performances[0]
  assert.equal(top.type, 'batting')
  assert.equal(top.playerId, 601)
  assert.equal(top.gamePk, 101)
  assert.equal(top.line, '3-for-4, 1 HR, 1 2B, 3 RBI, 2 R')

  const peraltaStart = performances.find((p) => p.playerId === 501 && p.gamePk === 101)
  const megillSave = performances.find((p) => p.playerId === 502)
  assert.ok(top.score > peraltaStart.score)
  assert.ok(peraltaStart.score > megillSave.score)
  assert.equal(peraltaStart.line, '6.0 IP, 5 H, 2 R, 1 BB, 8 K')
})

test('a pitcher who starts one game and relieves in another lands in both tables with only that role\'s numbers', () => {
  const { rotation, bullpen } = computeLogbookRetrospective(STAMPS, FACTS, BOXSCORES, {})

  const peraltaStart = rotation.find((p) => p.id === 501)
  assert.ok(peraltaStart, 'Peralta should appear in the rotation for his start')
  assert.equal(peraltaStart.gamesStarted, 1)
  assert.equal(peraltaStart.wins, 1)
  assert.equal(peraltaStart.losses, 0)
  assert.equal(peraltaStart.teamWins, 1)
  assert.equal(peraltaStart.teamLosses, 0)
  assert.equal(peraltaStart.inningsPitched, '6.0')
  assert.equal(peraltaStart.era, 3) // 2 ER over 6 IP
  assert.equal(peraltaStart.avgPitches, 95)

  const peraltaRelief = bullpen.find((p) => p.id === 501)
  assert.ok(peraltaRelief, 'Peralta should also appear in the bullpen for his relief outing')
  assert.equal(peraltaRelief.appearances, 1)
  assert.equal(peraltaRelief.holds, 1)
  assert.equal(peraltaRelief.saves, 0)
  assert.equal(peraltaRelief.inningsPitched, '1.0')
  assert.equal(peraltaRelief.era, 9) // 1 ER over 1 IP

  // Megill never started, so he's bullpen-only.
  assert.ok(!rotation.find((p) => p.id === 502))
  const megill = bullpen.find((p) => p.id === 502)
  assert.equal(megill.saves, 1)
  assert.equal(megill.appearances, 1)
})

test('combined leaders sum a player\'s line across every stamped game', () => {
  const { battingLeaders, pitchingLeaders } = computeLogbookRetrospective(STAMPS, FACTS, BOXSCORES, {})

  const yelich = battingLeaders.find((p) => p.id === 601)
  assert.equal(yelich.games, 2)
  assert.equal(yelich.batting.hits, 4)
  assert.equal(yelich.batting.atBats, 8)
  assert.equal(yelich.average, 0.5)

  const peralta = pitchingLeaders.find((p) => p.id === 501)
  assert.equal(peralta.games, 2)
  assert.equal(peralta.pitching.hits, 7) // 5 (start) + 2 (relief)
  assert.equal(peralta.pitching.earnedRuns, 3) // 2 + 1
  assert.equal(peralta.pitching.inningsPitched, '7.0') // 18 + 3 outs
})

test('moments are ranked by swing, capped, and drop entries with no description', () => {
  const momentsByGame = {
    101: [
      { inning: 9, half: 'Bottom', description: 'Christian Yelich hits a walk-off grand slam.', swing: 35, playId: 'play-1' },
      { inning: 3, half: 'Top', description: '', swing: 40, playId: null }, // no description -> dropped
    ],
    102: Array.from({ length: 13 }, (_, i) => ({
      inning: 5,
      half: 'Top',
      description: `Play number ${i}`,
      swing: 20 + i,
      playId: null,
    })),
  }

  const { moments } = computeLogbookRetrospective(STAMPS, FACTS, BOXSCORES, momentsByGame)

  assert.ok(moments.length <= 12, 'moments should be capped')
  assert.ok(moments.every((m) => m.description), 'no moment should render with an empty description')
  for (let i = 1; i < moments.length; i += 1) {
    assert.ok(moments[i - 1].swing >= moments[i].swing, 'moments should sort by swing descending')
  }
  const walkoff = moments.find((m) => m.playId === 'play-1')
  assert.ok(walkoff)
  assert.equal(walkoff.gamePk, 101)
  assert.equal(walkoff.date, '2026-04-01')
})

test('a stamp with no resolved boxscore contributes nothing rather than throwing', () => {
  const stamps = [...STAMPS, stamp(999, '2026-04-20')]
  const result = computeLogbookRetrospective(stamps, FACTS, BOXSCORES, {})
  assert.ok(result.performances.length > 0)
  assert.ok(!result.performances.some((p) => p.gamePk === 999))
})
