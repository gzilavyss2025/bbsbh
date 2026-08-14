// The Scorecard Lab printable grid used to skip the extra-innings automatic
// runner entirely — scorecardPlays (src/api/scorecardGame.js) only kept
// computeHalfInningFeed entries with kind === 'atbat', so the placed
// runner's `kind: 'placed'` card never reached the grid. His run still
// showed in perInning/the bottom scoreboard (both read the real linescore),
// so the sheet's own R column disagreed with itself. He has a real
// battingOrder — by rule the previous half's last batter — so he gets a
// cell in his own slot row, same as any hitter, per the fix filed at
// .scratch/pbp-scoring-review/issues/02-scorecard-lab-drops-the-automatic-runner.md.
//
// The fixture mirrors gamePk 777747 (2025-05-27 BOS@MIL), bottom 10: Joey
// Ortiz (slot 6) placed at 2nd, Brice Turang singles (Ortiz to 3rd), Jackson
// Chourio walks, William Contreras flies out, Christian Yelich hits a
// walk-off grand slam — four runs, one of them the placed runner's own.
import assert from 'node:assert/strict'
import test from 'node:test'
import { scorecardPlays } from '../src/api/scorecardGame.js'

function person(id, last, first) {
  return { id, fullName: `${first} ${last}`, lastName: last, firstName: first, useName: first, primaryNumber: String(id) }
}

const ORTIZ = 1
const TURANG = 2
const CHOURIO = 3
const CONTRERAS = 4
const YELICH = 5
const PITCHER = 9

const PLAYERS = {
  ID1: person(ORTIZ, 'Ortiz', 'Joey'),
  ID2: person(TURANG, 'Turang', 'Brice'),
  ID3: person(CHOURIO, 'Chourio', 'Jackson'),
  ID4: person(CONTRERAS, 'Contreras', 'William'),
  ID5: person(YELICH, 'Yelich', 'Christian'),
  ID9: { ...person(PITCHER, 'Chapman', 'Aroldis'), pitchHand: { code: 'L' } },
}

const BOX_HOME = {
  ID1: { person: { id: ORTIZ }, battingOrder: '600', position: { abbreviation: 'SS' }, allPositions: [{ abbreviation: 'SS' }] },
  ID2: { person: { id: TURANG }, battingOrder: '700', position: { abbreviation: '2B' }, allPositions: [{ abbreviation: '2B' }] },
  ID3: { person: { id: CHOURIO }, battingOrder: '800', position: { abbreviation: 'RF' }, allPositions: [{ abbreviation: 'RF' }] },
  ID4: { person: { id: CONTRERAS }, battingOrder: '100', position: { abbreviation: 'C' }, allPositions: [{ abbreviation: 'C' }] },
  ID5: { person: { id: YELICH }, battingOrder: '200', position: { abbreviation: 'DH' }, allPositions: [{ abbreviation: 'DH' }] },
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

function placementEvent() {
  return {
    details: {
      description: 'Joey Ortiz starts inning at 2nd base.',
      event: 'Runner Placed On Base',
      eventType: 'runner_placed',
      isOut: false,
    },
    index: 1,
    isPitch: false,
    type: 'action',
    player: { id: ORTIZ },
    base: 2,
  }
}

const SINGLE_PLAY = {
  about: { inning: 10, halfInning: 'bottom', atBatIndex: 80 },
  matchup: { batter: { id: TURANG, fullName: 'Brice Turang' }, pitcher: { id: PITCHER }, batSide: { code: 'L' } },
  result: {
    type: 'atBat',
    eventType: 'single',
    description: 'Brice Turang singles on a sharp line drive to center fielder Ceddanne Rafaela. Joey Ortiz to 3rd.',
    rbi: 0,
  },
  count: { balls: 0, strikes: 0, outs: 0 },
  playEvents: [placementEvent(), pitch('D', 1)],
  runners: [
    {
      details: { runner: { id: TURANG, fullName: 'Brice Turang' }, eventType: 'single' },
      movement: { start: null, end: '1B', isOut: false },
    },
    {
      details: { runner: { id: ORTIZ, fullName: 'Joey Ortiz' }, eventType: 'single' },
      movement: { start: '2B', end: '3B', isOut: false },
    },
  ],
}

const WALK_PLAY = {
  about: { inning: 10, halfInning: 'bottom', atBatIndex: 81 },
  matchup: { batter: { id: CHOURIO, fullName: 'Jackson Chourio' }, pitcher: { id: PITCHER }, batSide: { code: 'R' } },
  result: { type: 'atBat', eventType: 'walk', description: 'Jackson Chourio walks.', rbi: 0 },
  count: { balls: 4, strikes: 1, outs: 0 },
  playEvents: [pitch('B', 1), pitch('B', 2), pitch('C', 3), pitch('B', 4), pitch('B', 5)],
  runners: [
    {
      details: { runner: { id: TURANG, fullName: 'Brice Turang' }, eventType: 'defensive_indiff' },
      movement: { start: '1B', end: '2B', isOut: false },
    },
    {
      details: { runner: { id: CHOURIO, fullName: 'Jackson Chourio' }, eventType: 'walk' },
      movement: { start: null, end: '1B', isOut: false },
    },
  ],
}

const FLYOUT_PLAY = {
  about: { inning: 10, halfInning: 'bottom', atBatIndex: 82 },
  matchup: { batter: { id: CONTRERAS, fullName: 'William Contreras' }, pitcher: { id: PITCHER }, batSide: { code: 'R' } },
  result: {
    type: 'atBat',
    eventType: 'field_out',
    description: 'William Contreras flies out to left fielder Jarren Duran.',
    rbi: 0,
  },
  count: { balls: 1, strikes: 1, outs: 1 },
  playEvents: [pitch('C', 1), pitch('B', 2), pitch('X', 3)],
  runners: [
    {
      details: { runner: { id: CONTRERAS, fullName: 'William Contreras' }, eventType: 'field_out' },
      movement: { start: null, end: null, isOut: true, outNumber: 1 },
      credits: [{ position: { code: '7' }, credit: 'f_putout' }],
    },
  ],
}

const SLAM_PLAY = {
  about: { inning: 10, halfInning: 'bottom', atBatIndex: 83 },
  matchup: { batter: { id: YELICH, fullName: 'Christian Yelich' }, pitcher: { id: PITCHER }, batSide: { code: 'L' } },
  result: {
    type: 'atBat',
    eventType: 'home_run',
    description:
      'Christian Yelich hits a grand slam (10) to right center field. Joey Ortiz scores. Brice Turang scores. Jackson Chourio scores.',
    rbi: 4,
  },
  count: { balls: 1, strikes: 0, outs: 1 },
  playEvents: [pitch('B', 1), pitch('X', 2)],
  runners: [
    {
      details: { runner: { id: YELICH, fullName: 'Christian Yelich' }, eventType: 'home_run', earned: true, rbi: true },
      movement: { start: null, end: 'score', isOut: false },
    },
    {
      details: { runner: { id: ORTIZ, fullName: 'Joey Ortiz' }, eventType: 'home_run', earned: false, rbi: true },
      movement: { start: '3B', end: 'score', isOut: false },
    },
    {
      details: { runner: { id: TURANG, fullName: 'Brice Turang' }, eventType: 'home_run', earned: true, rbi: true },
      movement: { start: '2B', end: 'score', isOut: false },
    },
    {
      details: { runner: { id: CHOURIO, fullName: 'Jackson Chourio' }, eventType: 'home_run', earned: true, rbi: true },
      movement: { start: '1B', end: 'score', isOut: false },
    },
  ],
}

function buildFeed() {
  return {
    gamePk: 777747,
    gameData: { players: PLAYERS },
    liveData: {
      linescore: { scheduledInnings: 10, innings: [] },
      boxscore: { teams: { home: { players: BOX_HOME }, away: { players: {} } } },
      plays: { allPlays: [SINGLE_PLAY, WALK_PLAY, FLYOUT_PLAY, SLAM_PLAY] },
    },
  }
}

test('the placed runner gets a cell in his own slot row on the printable grid', () => {
  const grid = scorecardPlays(buildFeed(), 'bottom')
  const ortizSlot = grid.slots[5] // slot 6
  const inning10Col = grid.columns.findIndex((c) => c.inning === 10)
  const cell = ortizSlot.cells[inning10Col]
  assert.ok(cell, 'the placed runner has a cell in the 10th')
  assert.equal(cell.kind, 'placed')
  assert.equal(cell.code, 'AR')
  assert.equal(cell.base, 2)
  assert.equal(cell.scored, true)
})

test('his run reaches the slot tally, agreeing with the scoreboard instead of undercounting it', () => {
  const grid = scorecardPlays(buildFeed(), 'bottom')
  const ortizSlot = grid.slots[5]
  assert.equal(ortizSlot.r, 1, "the placed runner's own run counts toward his slot")
  const totalR = grid.slots.reduce((sum, s) => sum + s.r, 0)
  assert.equal(totalR, 4, 'all four runs of the walk-off slam are on the grid, including the placed runner\'s')
})

test('the placed runner is not charged a plate appearance', () => {
  const grid = scorecardPlays(buildFeed(), 'bottom')
  const ortizSlot = grid.slots[5]
  assert.equal(ortizSlot.ab, 0, 'he never batted this half — no AB for the placement')
})
