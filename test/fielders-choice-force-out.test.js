// A batter who reaches first safely while a preceding runner is forced out
// elsewhere carries MLB Stats API eventType `force_out` — NOT `fielders_choice`
// or `fielders_choice_out` (verified against gamePk 823035's "Grounds into a
// force out… to 1st"). Before the fix pinned here, `force_out` was absent from
// REACH_CODES, so scorebookCode() fell through to the generic out-fallback;
// since the batter himself carries no putout/assist credits there, it silently
// returned an empty code — a blank diamond with no "FC" label at all, even
// though the batter plainly reached base. See CLAUDE.md's spoiler-rule tiers:
// this is pure scorebook-denotation logic, not a spoiler-gated module.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

function person(id, last, first) {
  return { id, fullName: `${first} ${last}`, lastName: last, firstName: first, useName: first, primaryNumber: String(id) }
}

const PLAYERS = {
  ID1: person(1, 'Torres', 'Gleyber'),
  ID2: person(2, 'Keith', 'Colt'),
  ID9: { ...person(9, 'Dobnak', 'Randy'), pitchHand: { code: 'R' } },
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

function buildFeed() {
  return {
    gamePk: 999999,
    gameData: { players: PLAYERS },
    liveData: {
      linescore: { scheduledInnings: 9, innings: [] },
      boxscore: {
        teams: {
          away: {
            players: {
              ID1: { person: { id: 1 }, battingOrder: '200', position: { abbreviation: '2B' }, allPositions: [{ abbreviation: '2B' }] },
              ID2: { person: { id: 2 }, battingOrder: '300', position: { abbreviation: '3B' }, allPositions: [{ abbreviation: '3B' }] },
            },
          },
          home: { players: {} },
        },
      },
      plays: {
        allPlays: [
          {
            about: { inning: 1, halfInning: 'top', atBatIndex: 1 },
            matchup: { batter: { id: 1, fullName: 'Gleyber Torres' }, pitcher: { id: 9 }, batSide: { code: 'R' } },
            result: {
              type: 'atBat',
              eventType: 'single',
              description: 'Gleyber Torres singles on a line drive to right fielder Nick Loftin.',
              rbi: 0,
            },
            count: { balls: 0, strikes: 1, outs: 0 },
            playEvents: [pitch('X', 1)],
            runners: [
              {
                details: { runner: { id: 1, fullName: 'Gleyber Torres' }, eventType: 'single' },
                movement: { start: null, end: '1B', isOut: false },
              },
            ],
          },
          {
            about: { inning: 1, halfInning: 'top', atBatIndex: 2 },
            matchup: { batter: { id: 2, fullName: 'Colt Keith' }, pitcher: { id: 9 }, batSide: { code: 'L' } },
            result: {
              type: 'atBat',
              eventType: 'force_out',
              description:
                'Colt Keith grounds into a force out, first baseman Vinnie Pasquantino to shortstop Andrew Velazquez. Gleyber Torres out at 2nd. Colt Keith to 1st.',
              rbi: 0,
            },
            count: { balls: 1, strikes: 2, outs: 1 },
            playEvents: [pitch('B', 1), pitch('C', 2), pitch('X', 3)],
            runners: [
              {
                details: { runner: { id: 1, fullName: 'Gleyber Torres' }, eventType: 'force_out' },
                movement: { start: '1B', end: null, isOut: true, outBase: '2B', outNumber: 1 },
                credits: [
                  { position: { code: '3' }, credit: 'f_assist' },
                  { position: { code: '6' }, credit: 'f_putout' },
                ],
              },
              {
                details: { runner: { id: 2, fullName: 'Colt Keith' }, eventType: 'force_out' },
                movement: { start: null, end: '1B', isOut: false },
              },
            ],
          },
        ],
      },
    },
  }
}

test('a batter safe on a force out gets the FC scorebook mark, not a blank diamond', () => {
  const entries = computeHalfInningFeed(buildFeed(), 1, 'top', 'away')
  const keith = entries.find((e) => e.kind === 'atbat' && e.batter.last === 'Keith')
  assert.equal(keith.code, 'FC')
  assert.equal(keith.codeKind, 'reach')
  assert.equal(keith.reached, 1)
  assert.equal(keith.scored, false)
  assert.equal(keith.outNumber, null)
})

test("the forced runner's own card still shows his FC out, unaffected by the batter's fix", () => {
  const entries = computeHalfInningFeed(buildFeed(), 1, 'top', 'away')
  const torres = entries.find((e) => e.kind === 'atbat' && e.batter.last === 'Torres')
  assert.equal(torres.outNumber, 1)
  assert.equal(torres.outAt, 2)
  assert.equal(torres.outCode, 'FC 3-6')
})
