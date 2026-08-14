// A batter's own GIDP scorebook mark must show the FULL relay chain (every
// fielder who touched the ball across the whole double play), not just his
// own assist+putout pair. Before this fix, scorebookCode built that chain
// from ONLY the batter's own runners[] credits — for a live 6-4-3 (verified
// against gamePk 824248: Matt Vierling grounds into a double play, shortstop
// Tyler Tolbert to second baseman Michael Massey to first baseman Vinnie
// Pasquantino), the batter's own credits are just assist-4/putout-3, so the
// card silently dropped the shortstop who started it and showed "DP 4-3"
// instead of the true "6-4-3" (the front runner's own entry carries the
// missing assist-6/putout-4 leg). The fix also reads "GIDP" over the chain
// on its own line rather than "DP" run together with the numbers.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'
import { scorecardPlays, scorecardCenterCode } from '../src/api/scorecardGame.js'

function person(id, last, first) {
  return { id, fullName: `${first} ${last}`, lastName: last, firstName: first, useName: first, primaryNumber: String(id) }
}

const PLAYERS = {
  ID1: person(1, 'McKinstry', 'Zach'),
  ID2: person(2, 'Vierling', 'Matt'),
  ID9: { ...person(9, 'Skubal', 'Tarik'), pitchHand: { code: 'L' } },
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

function buildFeed() {
  return {
    gamePk: 824248,
    gameData: { players: PLAYERS },
    liveData: {
      linescore: { scheduledInnings: 9, innings: [] },
      boxscore: {
        teams: {
          away: {
            players: {
              ID1: { person: { id: 1 }, battingOrder: '200', position: { abbreviation: 'CF' }, allPositions: [{ abbreviation: 'CF' }] },
              ID2: { person: { id: 2 }, battingOrder: '300', position: { abbreviation: 'RF' }, allPositions: [{ abbreviation: 'RF' }] },
            },
          },
          home: { players: {} },
        },
      },
      plays: {
        allPlays: [
          {
            about: { inning: 1, halfInning: 'top', atBatIndex: 1 },
            matchup: { batter: { id: 1, fullName: 'Zach McKinstry' }, pitcher: { id: 9 }, batSide: { code: 'L' } },
            result: {
              type: 'atBat',
              eventType: 'single',
              description: 'Zach McKinstry singles on a ground ball to center fielder.',
              rbi: 0,
            },
            count: { balls: 0, strikes: 1, outs: 0 },
            playEvents: [pitch('X', 1)],
            runners: [
              {
                details: { runner: { id: 1, fullName: 'Zach McKinstry' }, eventType: 'single' },
                movement: { start: null, end: '1B', isOut: false },
              },
            ],
          },
          {
            about: { inning: 1, halfInning: 'top', atBatIndex: 2 },
            matchup: { batter: { id: 2, fullName: 'Matt Vierling' }, pitcher: { id: 9 }, batSide: { code: 'R' } },
            result: {
              type: 'atBat',
              eventType: 'grounded_into_double_play',
              description:
                'Matt Vierling grounds into a double play, shortstop Tyler Tolbert to second baseman Michael Massey to first baseman Vinnie Pasquantino. Zach McKinstry out at 2nd. Matt Vierling out at 1st.',
              rbi: 0,
            },
            count: { balls: 1, strikes: 2, outs: 1 },
            playEvents: [pitch('B', 1), pitch('C', 2), pitch('X', 3)],
            runners: [
              {
                details: { runner: { id: 1, fullName: 'Zach McKinstry' }, eventType: 'grounded_into_double_play' },
                movement: { start: '1B', end: null, isOut: true, outBase: '2B', outNumber: 1 },
                credits: [
                  { position: { code: '6' }, credit: 'f_assist' },
                  { position: { code: '4' }, credit: 'f_putout' },
                ],
              },
              {
                details: { runner: { id: 2, fullName: 'Matt Vierling' }, eventType: 'grounded_into_double_play' },
                movement: { start: null, end: null, isOut: true, outBase: '1B', outNumber: 2 },
                credits: [
                  { position: { code: '4' }, credit: 'f_assist' },
                  { position: { code: '3' }, credit: 'f_putout' },
                ],
              },
            ],
          },
        ],
      },
    },
  }
}

test("the batter's own GIDP card shows the FULL 6-4-3 relay chain under a 'GIDP' line, not just his own 4-3 leg", () => {
  const entries = computeHalfInningFeed(buildFeed(), 1, 'top', 'away')
  const vierling = entries.find((e) => e.kind === 'atbat' && e.batter.last === 'Vierling')
  assert.equal(vierling.code, 'GIDP\n6-4-3')
  assert.equal(vierling.codeKind, 'out')
})

test("the forced lead runner's own out notation is unaffected — still his own 6-4 leg, not the full chain", () => {
  const entries = computeHalfInningFeed(buildFeed(), 1, 'top', 'away')
  const mckinstry = entries.find((e) => e.kind === 'atbat' && e.batter.last === 'McKinstry')
  assert.equal(mckinstry.outNumber, 1)
  assert.equal(mckinstry.outAt, 2)
  assert.equal(mckinstry.outCode, 'DP 6-4')
})

// The SCORECARD SHEET is a second consumer of the very same card, and its
// diamond center is a single-line chip (.sc-ab__center, `white-space: nowrap`)
// in a 90px box — so the two-line play-by-play mark must not reach it intact,
// or it renders as one unwrapped "GIDP 6-4-3" run overhanging the box. The
// sheet gets the chain alone; the "DP" it drops is already in the outcome box
// beside it (classifyOut).
test("the scorecard sheet's diamond center takes the GIDP chain alone, not the two-line play-by-play mark", () => {
  const grid = scorecardPlays(buildFeed(), 'top')
  const vierling = grid.slots
    .flatMap((s) => Object.values(s.cells))
    .find((c) => c.batter.last === 'Vierling')
  assert.equal(vierling.code, 'GIDP\n6-4-3') // untouched for the play-by-play
  assert.equal(vierling.centerCode, '6-4-3')
  assert.ok(!vierling.centerCode.includes('\n'))
  assert.equal(vierling.outType, 'DP')
})

test('a single-line out code passes through to the scorecard center unchanged', () => {
  assert.equal(scorecardCenterCode('6-3'), '6-3')
  assert.equal(scorecardCenterCode('F8'), 'F8')
  assert.equal(scorecardCenterCode(''), '')
  assert.equal(scorecardCenterCode(null), '')
})
