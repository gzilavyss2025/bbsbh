// A sac_fly_double_play plate appearance — a sacrifice fly on which a SECOND
// runner is also retired (doubled off) — must stay excluded from at-bats on
// the Scorecard Lab printable grid, same as an ordinary sac_fly. Rule
// 9.02(a)(1) excludes a sacrifice fly from at-bats, and 9.08(d) still credits
// one even when another runner is doubled off on the same play.
//
// scorecardPlays' NON_AB_EVENTS (src/api/scorecardGame.js) used to list
// 'sac_fly' but not 'sac_fly_double_play', even though playbyplay.js's own
// SAC_FLY_EVENTS/classifyOut already mark the batter's own trip as the
// sacrifice — so the grid charged him BOTH a sacrifice notation and an
// at-bat for the one plate appearance. Filed at
// .scratch/pbp-scoring-review/issues/04-sacrifice-double-play-charges-an-at-bat.md.
import assert from 'node:assert/strict'
import test from 'node:test'
import { scorecardPlays } from '../src/api/scorecardGame.js'

function person(id, last, first) {
  return { id, fullName: `${first} ${last}`, lastName: last, firstName: first, useName: first, primaryNumber: String(id) }
}

const RUNNER = 1
const BATTER = 2
const PITCHER = 9

const PLAYERS = {
  ID1: person(RUNNER, 'Vu', 'Kien'),
  ID2: person(BATTER, 'Albies', 'Ozzie'),
  ID9: { ...person(PITCHER, 'Flores', 'Anthony'), pitchHand: { code: 'L' } },
}

const BOX_HOME = {
  ID1: { person: { id: RUNNER }, battingOrder: '100', position: { abbreviation: 'CF' }, allPositions: [{ abbreviation: 'CF' }] },
  ID2: { person: { id: BATTER }, battingOrder: '200', position: { abbreviation: 'RF' }, allPositions: [{ abbreviation: 'RF' }] },
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

// Albies flies out to center on a sac fly; Vu, tagging from 3rd, is doubled
// off trying to score after the catch — one plate appearance, two outs, no
// at-bat charged to either the sacrifice OR the double play.
const SAC_FLY_DP_PLAY = {
  about: { inning: 3, halfInning: 'bottom', atBatIndex: 20 },
  matchup: { batter: { id: BATTER, fullName: 'Ozzie Albies' }, pitcher: { id: PITCHER }, batSide: { code: 'R' } },
  result: {
    type: 'atBat',
    eventType: 'sac_fly_double_play',
    description: 'Ozzie Albies out on a sacrifice fly to center fielder Evan Carter. Kien Vu doubled off 3rd.',
    rbi: 0,
    isOut: true,
  },
  count: { balls: 0, strikes: 0, outs: 0 },
  playEvents: [pitch('X', 1)],
  runners: [
    {
      details: { runner: { id: BATTER, fullName: 'Ozzie Albies' }, eventType: 'sac_fly_double_play' },
      movement: { start: null, end: null, outBase: '1B', isOut: true, outNumber: 1 },
      credits: [{ position: { code: '8' }, credit: 'f_putout' }],
    },
    {
      details: { runner: { id: RUNNER, fullName: 'Kien Vu' }, eventType: 'sac_fly_double_play' },
      movement: { start: '3B', end: null, outBase: 'score', isOut: true, outNumber: 2 },
      credits: [
        { position: { code: '8' }, credit: 'f_assist' },
        { position: { code: '2' }, credit: 'f_putout' },
      ],
    },
  ],
}

function buildFeed() {
  return {
    gamePk: 818035,
    gameData: { players: PLAYERS },
    liveData: {
      linescore: { scheduledInnings: 9, innings: [] },
      boxscore: { teams: { home: { players: BOX_HOME }, away: { players: {} } } },
      plays: { allPlays: [SAC_FLY_DP_PLAY] },
    },
  }
}

test('a sac fly that also turns a double play is not charged an at-bat on the printable grid', () => {
  const grid = scorecardPlays(buildFeed(), 'bottom', { through: Infinity })
  const albiesSlot = grid.slots[1] // slot 2
  assert.equal(albiesSlot.ab, 0, 'the sacrifice fly stays out of the AB tally even with a second runner retired')
  const inning3Col = grid.columns.findIndex((c) => c.inning === 3)
  const cell = albiesSlot.cells[inning3Col]
  assert.ok(cell, 'the plate appearance still gets its own cell')
  assert.equal(cell.eventType, 'sac_fly_double_play')
})
