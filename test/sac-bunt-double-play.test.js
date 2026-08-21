// A sac_bunt_double_play plate appearance — a bunt attempt on which the lead
// runner is retired advancing, and the batter is retired too — must be
// charged an AT-BAT and scored as an ordinary double play, NOT as a
// sacrifice. Unlike sac_fly_double_play (Rule 9.08(d), still a sacrifice
// even when a second runner is doubled off), Rule 9.08(c) is explicit: "Do
// not score a sacrifice bunt when any runner is put out attempting to
// advance one base on a bunt" — the batter is charged a time at bat instead.
//
// Before this fix, boxscore.js's NOT_AN_AT_BAT excluded this eventType from
// the AB tally, and both scorecard/notation.js's classifyOut and
// playbyplay/scorebookCode.js's SAC_BUNT_EVENTS labeled the batter's own
// card "SAC" — three modules crediting a sacrifice the rulebook does not
// allow. Filed as issue #765; docs/unresolved-scoring-conventions.md has the
// full resolution.
//
// The description deliberately still reads "sacrifice bunt" and deliberately
// does NOT say "into a double play" — the fix must key off the eventType
// alone, not desc text, in either direction: it must not fall into 'SAC' via
// the sacrifice-desc fallback, and it must reach 'DP'/GIDP formatting without
// relying on double-play desc wording.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'
import { scorecardPlays } from '../src/api/scorecardGame.js'
import { classifyOut, NON_AB_EVENTS } from '../src/api/scorecard/notation.js'

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
  ID1: { person: { id: RUNNER }, battingOrder: '100', position: { abbreviation: '2B' }, allPositions: [{ abbreviation: '2B' }] },
  ID2: { person: { id: BATTER }, battingOrder: '200', position: { abbreviation: 'RF' }, allPositions: [{ abbreviation: 'RF' }] },
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

// Albies squares to bunt with Vu running from 1st; the third baseman charges,
// throws to short covering 2nd for the lead runner, and the relay to first
// retires the batter too — a 5-6-3 bunt double play.
const SAC_BUNT_DP_PLAY = {
  about: { inning: 3, halfInning: 'bottom', atBatIndex: 20 },
  matchup: { batter: { id: BATTER, fullName: 'Ozzie Albies' }, pitcher: { id: PITCHER }, batSide: { code: 'R' } },
  result: {
    type: 'atBat',
    eventType: 'sac_bunt_double_play',
    description:
      'Ozzie Albies sacrifice bunt, third baseman to shortstop to first baseman. Kien Vu out at 2nd. Ozzie Albies out at 1st.',
    rbi: 0,
    isOut: true,
  },
  count: { balls: 0, strikes: 0, outs: 0 },
  playEvents: [pitch('X', 1)],
  runners: [
    {
      details: { runner: { id: RUNNER, fullName: 'Kien Vu' }, eventType: 'sac_bunt_double_play' },
      movement: { start: '1B', end: null, outBase: '2B', isOut: true, outNumber: 1 },
      credits: [
        { position: { code: '5' }, credit: 'f_assist' },
        { position: { code: '6' }, credit: 'f_putout' },
      ],
    },
    {
      details: { runner: { id: BATTER, fullName: 'Ozzie Albies' }, eventType: 'sac_bunt_double_play' },
      movement: { start: null, end: null, outBase: '1B', isOut: true, outNumber: 2 },
      credits: [
        { position: { code: '6' }, credit: 'f_assist' },
        { position: { code: '3' }, credit: 'f_putout' },
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
      plays: { allPlays: [SAC_BUNT_DP_PLAY] },
    },
  }
}

test('classifyOut reads sac_bunt_double_play as a double play, not a sacrifice', () => {
  assert.equal(classifyOut('sac_bunt_double_play', SAC_BUNT_DP_PLAY.result.description), 'DP')
})

test('NON_AB_EVENTS does not exclude sac_bunt_double_play — an at-bat is charged (Rule 9.08(c))', () => {
  assert.ok(!NON_AB_EVENTS.has('sac_bunt_double_play'))
})

test("the batter's own scorebook card reads GIDP with the full relay chain, not SAC", () => {
  const entries = computeHalfInningFeed(buildFeed(), 3, 'bottom', 'home')
  const albies = entries.find((e) => e.kind === 'atbat' && e.batter.last === 'Albies')
  assert.equal(albies.code, 'GIDP\n5-6-3')
  assert.equal(albies.codeKind, 'out')
})

test('a sac bunt that also turns a double play IS charged an at-bat on the printable grid', () => {
  const grid = scorecardPlays(buildFeed(), 'bottom', { through: Infinity })
  const albiesSlot = grid.slots[1] // slot 2
  assert.equal(albiesSlot.ab, 1, 'no sacrifice credit under Rule 9.08(c) — the at-bat counts')
  const inning3Col = grid.columns.findIndex((c) => c.inning === 3)
  const cell = albiesSlot.cells[inning3Col]
  assert.ok(cell, 'the plate appearance still gets its own cell')
  assert.equal(cell.eventType, 'sac_bunt_double_play')
})
