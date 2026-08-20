// A batter safe on his own plate appearance while the defense turns a double
// play elsewhere on the bases carries MLB Stats API eventType `double_play` —
// the SAME eventType a batter-out grounded-into-DP carries, but with the
// batter's own runners[] entry showing `end: '1B'`, no `isOut` (verified
// against gamePk 819449's top 8th: Victor Izturis hits into a 6-4-5 double
// play — shortstop to second baseman to third baseman — that puts Garrett
// Howe out at 2nd and Juan Benjamin out at 3rd while Tyler Howard scores and
// Izturis reaches 1st). Before the fix pinned here, scorebookCode() had no
// entry for a batter-safe `double_play`, so it fell through to the generic
// fielding-chain-out branch; since the batter carries no putout/assist
// credits on a play he wasn't retired on, that branch silently returned an
// empty code — a blank diamond with no "FC" label, even though PlayDiamond
// drew him safe at first. The same eventType also broke the SCORING runner's
// own leg notation: every runner's own `details.eventType` on this play reads
// `double_play` regardless of that runner's fate, so Howard's safe advance to
// home fell to advanceCode's ground-out fallback ("GO") instead of "FC". See
// CLAUDE.md's spoiler-rule tiers: this is pure scorebook-denotation logic,
// not a spoiler-gated module.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

function person(id, last, first) {
  return { id, fullName: `${first} ${last}`, lastName: last, firstName: first, useName: first, primaryNumber: String(id) }
}

const PLAYERS = {
  ID10: person(10, 'Howard', 'Tyler'),
  ID11: person(11, 'Benjamin', 'Juan'),
  ID12: person(12, 'Howe', 'Garrett'),
  ID13: person(13, 'Izturis', 'Victor'),
  ID9: { ...person(9, 'Johnson', 'Bjorn'), pitchHand: { code: 'L' } },
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

function buildFeed() {
  return {
    gamePk: 819449,
    gameData: { players: PLAYERS },
    liveData: {
      linescore: { scheduledInnings: 9, innings: [] },
      boxscore: {
        teams: {
          away: {
            players: {
              ID10: { person: { id: 10 }, battingOrder: '100', position: { abbreviation: 'CF' }, allPositions: [{ abbreviation: 'CF' }] },
              ID11: { person: { id: 11 }, battingOrder: '200', position: { abbreviation: 'C' }, allPositions: [{ abbreviation: 'C' }] },
              ID12: { person: { id: 12 }, battingOrder: '300', position: { abbreviation: 'LF' }, allPositions: [{ abbreviation: 'LF' }] },
              ID13: { person: { id: 13 }, battingOrder: '400', position: { abbreviation: 'DH' }, allPositions: [{ abbreviation: 'DH' }] },
            },
          },
          home: { players: {} },
        },
      },
      plays: {
        allPlays: [
          {
            about: { inning: 8, halfInning: 'top', atBatIndex: 1 },
            matchup: { batter: { id: 10, fullName: 'Tyler Howard' }, pitcher: { id: 9 }, batSide: { code: 'R' } },
            result: {
              type: 'atBat',
              eventType: 'double',
              description: 'Tyler Howard doubles on a sharp line drive to center fielder Sawyer Strosnider.',
              rbi: 0,
            },
            count: { balls: 0, strikes: 1, outs: 0 },
            playEvents: [pitch('X', 1)],
            runners: [
              {
                details: { runner: { id: 10, fullName: 'Tyler Howard' }, eventType: 'double' },
                movement: { start: null, end: '2B', isOut: false },
              },
            ],
          },
          {
            about: { inning: 8, halfInning: 'top', atBatIndex: 2 },
            matchup: { batter: { id: 11, fullName: 'Juan Benjamin' }, pitcher: { id: 9 }, batSide: { code: 'R' } },
            result: { type: 'atBat', eventType: 'walk', description: 'Juan Benjamin walks.', rbi: 0 },
            count: { balls: 4, strikes: 1, outs: 0 },
            playEvents: [pitch('B', 1), pitch('B', 2), pitch('C', 3), pitch('B', 4), pitch('B', 5)],
            runners: [
              {
                details: { runner: { id: 11, fullName: 'Juan Benjamin' }, eventType: 'walk' },
                movement: { start: null, end: '1B', isOut: false },
              },
            ],
          },
          {
            about: { inning: 8, halfInning: 'top', atBatIndex: 3 },
            matchup: { batter: { id: 12, fullName: 'Garrett Howe' }, pitcher: { id: 9 }, batSide: { code: 'L' } },
            result: {
              type: 'atBat',
              eventType: 'walk',
              description: 'Garrett Howe walks. Tyler Howard to 3rd. Juan Benjamin to 2nd.',
              rbi: 0,
            },
            count: { balls: 4, strikes: 0, outs: 0 },
            playEvents: [pitch('B', 1), pitch('B', 2), pitch('B', 3), pitch('B', 4)],
            runners: [
              {
                details: { runner: { id: 10, fullName: 'Tyler Howard' }, eventType: 'walk' },
                movement: { start: '2B', end: '3B', isOut: false },
              },
              {
                details: { runner: { id: 11, fullName: 'Juan Benjamin' }, eventType: 'walk' },
                movement: { start: '1B', end: '2B', isOut: false },
              },
              {
                details: { runner: { id: 12, fullName: 'Garrett Howe' }, eventType: 'walk' },
                movement: { start: null, end: '1B', isOut: false },
              },
            ],
          },
          {
            about: { inning: 8, halfInning: 'top', atBatIndex: 4 },
            matchup: { batter: { id: 13, fullName: 'Victor Izturis' }, pitcher: { id: 9 }, batSide: { code: 'R' } },
            result: {
              type: 'atBat',
              eventType: 'double_play',
              description:
                'Victor Izturis hit into a fielder\'s choice double play, shortstop Brady Ebel to second baseman Daniel Dickinson to third baseman Juan Baez. Tyler Howard scores. Juan Benjamin out at 3rd. Garrett Howe out at 2nd. Victor Izturis to 1st.',
              rbi: 0,
            },
            count: { balls: 1, strikes: 1, outs: 0 },
            playEvents: [pitch('B', 1), pitch('C', 2), pitch('X', 3)],
            runners: [
              {
                details: { runner: { id: 12, fullName: 'Garrett Howe' }, eventType: 'double_play' },
                movement: { start: '1B', end: null, isOut: true, outBase: '2B', outNumber: 1 },
                credits: [
                  { position: { code: '6' }, credit: 'f_assist' },
                  { position: { code: '4' }, credit: 'f_putout' },
                ],
              },
              {
                details: { runner: { id: 11, fullName: 'Juan Benjamin' }, eventType: 'double_play' },
                movement: { start: '2B', end: null, isOut: true, outBase: '3B', outNumber: 2 },
                credits: [
                  { position: { code: '4' }, credit: 'f_assist' },
                  { position: { code: '5' }, credit: 'f_putout' },
                ],
              },
              {
                details: { runner: { id: 10, fullName: 'Tyler Howard' }, eventType: 'double_play', earned: true },
                movement: { start: '3B', end: 'score', isOut: false },
              },
              {
                details: { runner: { id: 13, fullName: 'Victor Izturis' }, eventType: 'double_play' },
                movement: { start: null, end: '1B', isOut: false },
              },
            ],
          },
        ],
      },
    },
  }
}

test('a batter safe on a fielder\'s-choice double play gets the FC scorebook mark, not a blank diamond', () => {
  const entries = computeHalfInningFeed(buildFeed(), 8, 'top', 'away')
  const izturis = entries.find((e) => e.kind === 'atbat' && e.batter.last === 'Izturis')
  assert.equal(izturis.code, 'FC')
  assert.equal(izturis.codeKind, 'reach')
  assert.equal(izturis.reached, 1)
  assert.equal(izturis.scored, false)
  assert.equal(izturis.outNumber, null)
})

test('the two forced runners still show their own DP out notation, unaffected by the fix', () => {
  const entries = computeHalfInningFeed(buildFeed(), 8, 'top', 'away')
  const howe = entries.find((e) => e.kind === 'atbat' && e.batter.last === 'Howe')
  const benjamin = entries.find((e) => e.kind === 'atbat' && e.batter.last === 'Benjamin')
  assert.equal(howe.outNumber, 1)
  assert.equal(howe.outAt, 2)
  assert.equal(howe.outCode, 'DP 6-4')
  assert.equal(benjamin.outNumber, 2)
  assert.equal(benjamin.outAt, 3)
  assert.equal(benjamin.outCode, 'DP 4-5')
})

test("the runner who scores on the fielder's choice gets an FC leg notation at home, not a bogus GO", () => {
  const entries = computeHalfInningFeed(buildFeed(), 8, 'top', 'away')
  const howard = entries.find((e) => e.kind === 'atbat' && e.batter.last === 'Howard')
  assert.equal(howard.scored, true)
  assert.equal(howard.earned, true)
  assert.equal(howard.legNotations['4']?.code, 'FC')
})
