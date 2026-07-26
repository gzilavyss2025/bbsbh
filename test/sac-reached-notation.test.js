// A SACRIFICE on which the batter was NOT retired. The rule credits a sacrifice
// when a runner advances on a bunt/fly the batter would have been put out on but
// for a misplay — so the feed comes back `sac_bunt`/`sac_fly` with the batter
// standing safely on first (`result.isOut: false`, no `outNumber`).
//
// Before the fix pinned here, scorebookCode built its fielding chain from EVERY
// credit on the batter's leg, including the ones that record no out at all
// (`f_fielding_error` on a boot, `f_fielded_ball` on a bunt the defense never
// made a play on), and always inked the sacrifice as an out. A third baseman's
// error on a sacrifice bunt therefore came out "SAC 5U" — an unassisted putout
// by the third baseman, penciled in the middle of a diamond that already showed
// the batter safe at first — and the error itself was notated nowhere on the
// card.
//
// Both shapes are taken from real feeds:
//   • gamePk 818035 (Shuckers @ Lookouts, 2026-07-25), bottom 8th — "Carlos
//     Sanchez hits a sacrifice bunt. Fielding error by third baseman Andrew
//     Fischer. Kien Vu to 2nd. Carlos Sanchez to 1st." One credit on the
//     batter's leg: f_fielding_error, position 5.
//   • gamePk 824087, bottom 9th — "Tyler Tolbert hits a sacrifice bunt. Josh
//     Rojas to 2nd. Tyler Tolbert to 1st." Nobody retired, no error charged:
//     one f_fielded_ball credit, position 2. The batter reached because the
//     defense never made a play on him.
//
// Pure scorebook-denotation logic, not a spoiler-gated module (see CLAUDE.md).
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

function person(id, last, first) {
  return {
    id,
    fullName: `${first} ${last}`,
    lastName: last,
    firstName: first,
    useName: first,
    primaryNumber: String(id),
  }
}

const PLAYERS = {
  ID1: person(1, 'Vu', 'Kien'),
  ID2: person(2, 'Sanchez', 'Carlos'),
  ID3: person(3, 'Tolbert', 'Tyler'),
  ID4: person(4, 'Lopez', 'Nicky'),
  ID5: person(5, 'Albies', 'Ozzie'),
  ID9: { ...person(9, 'Flores', 'Anthony'), pitchHand: { code: 'L' } },
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

function homePlayer(id, slot, pos) {
  return {
    person: { id },
    battingOrder: String(slot * 100),
    position: { abbreviation: pos },
    allPositions: [{ abbreviation: pos }],
  }
}

// Bottom of the 8th, five plate appearances: the leadoff man reaches, then four
// sacrifices — the booted bunt, a bunt nobody played on, a routine bunt, and a
// routine sac fly. The last two are the regression guards: narrowing the chain
// to real putouts/assists must leave an ordinary sacrifice untouched.
function buildFeed() {
  return {
    gamePk: 818035,
    gameData: { players: PLAYERS },
    liveData: {
      linescore: { scheduledInnings: 9, innings: [] },
      boxscore: {
        teams: {
          away: { players: {} },
          home: {
            players: {
              ID1: homePlayer(1, 1, 'CF'),
              ID2: homePlayer(2, 2, 'SS'),
              ID3: homePlayer(3, 3, '2B'),
              ID4: homePlayer(4, 4, '3B'),
              ID5: homePlayer(5, 5, 'LF'),
            },
          },
        },
      },
      plays: {
        allPlays: [
          {
            about: { inning: 8, halfInning: 'bottom', atBatIndex: 69 },
            matchup: { batter: { id: 1, fullName: 'Kien Vu' }, pitcher: { id: 9 }, batSide: { code: 'L' } },
            result: {
              type: 'atBat',
              eventType: 'hit_by_pitch',
              description: 'Kien Vu hit by pitch.',
              rbi: 0,
              isOut: false,
            },
            count: { balls: 1, strikes: 0, outs: 0 },
            playEvents: [pitch('H', 1)],
            runners: [
              {
                details: { runner: { id: 1, fullName: 'Kien Vu' }, eventType: 'hit_by_pitch' },
                movement: { start: null, end: '1B', isOut: false },
                credits: [],
              },
            ],
          },
          {
            about: { inning: 8, halfInning: 'bottom', atBatIndex: 70 },
            matchup: { batter: { id: 2, fullName: 'Carlos Sanchez' }, pitcher: { id: 9 }, batSide: { code: 'R' } },
            result: {
              type: 'atBat',
              eventType: 'sac_bunt',
              description:
                'Carlos Sanchez hits a sacrifice bunt. Fielding error by third baseman Andrew Fischer. Kien Vu to 2nd. Carlos Sanchez to 1st.',
              rbi: 0,
              isOut: false,
            },
            count: { balls: 0, strikes: 1, outs: 0 },
            playEvents: [pitch('X', 1)],
            runners: [
              {
                details: { runner: { id: 2, fullName: 'Carlos Sanchez' }, eventType: 'sac_bunt' },
                movement: { start: null, end: '1B', isOut: false, outNumber: null },
                credits: [{ position: { code: '5' }, credit: 'f_fielding_error' }],
              },
              {
                details: { runner: { id: 1, fullName: 'Kien Vu' }, eventType: 'sac_bunt' },
                movement: { start: '1B', end: '2B', isOut: false },
                credits: [],
              },
            ],
          },
          {
            about: { inning: 8, halfInning: 'bottom', atBatIndex: 71 },
            matchup: { batter: { id: 3, fullName: 'Tyler Tolbert' }, pitcher: { id: 9 }, batSide: { code: 'R' } },
            result: {
              type: 'atBat',
              eventType: 'sac_bunt',
              description: 'Tyler Tolbert hits a sacrifice bunt. Kien Vu to 3rd. Tyler Tolbert to 1st.',
              rbi: 0,
              isOut: false,
            },
            count: { balls: 0, strikes: 0, outs: 0 },
            playEvents: [pitch('X', 1)],
            runners: [
              {
                details: { runner: { id: 3, fullName: 'Tyler Tolbert' }, eventType: 'sac_bunt' },
                movement: { start: null, end: '1B', isOut: false, outNumber: null },
                credits: [{ position: { code: '2' }, credit: 'f_fielded_ball' }],
              },
              {
                details: { runner: { id: 1, fullName: 'Kien Vu' }, eventType: 'sac_bunt' },
                movement: { start: '2B', end: '3B', isOut: false },
                credits: [],
              },
            ],
          },
          {
            about: { inning: 8, halfInning: 'bottom', atBatIndex: 72 },
            matchup: { batter: { id: 4, fullName: 'Nicky Lopez' }, pitcher: { id: 9 }, batSide: { code: 'L' } },
            result: {
              type: 'atBat',
              eventType: 'sac_bunt',
              description:
                'Nicky Lopez out on a sacrifice bunt, pitcher Danny Young to second baseman Ozzie Albies. Tyler Tolbert to 2nd.',
              rbi: 0,
              isOut: true,
            },
            count: { balls: 0, strikes: 0, outs: 1 },
            playEvents: [pitch('X', 1)],
            runners: [
              {
                details: { runner: { id: 4, fullName: 'Nicky Lopez' }, eventType: 'sac_bunt' },
                movement: { start: null, end: null, outBase: '1B', isOut: true, outNumber: 1 },
                credits: [
                  { position: { code: '1' }, credit: 'f_assist' },
                  { position: { code: '4' }, credit: 'f_putout' },
                ],
              },
              {
                details: { runner: { id: 3, fullName: 'Tyler Tolbert' }, eventType: 'sac_bunt' },
                movement: { start: '1B', end: '2B', isOut: false },
                credits: [],
              },
            ],
          },
          {
            about: { inning: 8, halfInning: 'bottom', atBatIndex: 73 },
            matchup: { batter: { id: 5, fullName: 'Ozzie Albies' }, pitcher: { id: 9 }, batSide: { code: 'R' } },
            result: {
              type: 'atBat',
              eventType: 'sac_fly',
              description: 'Ozzie Albies out on a sacrifice fly to center fielder Evan Carter. Kien Vu scores.',
              rbi: 1,
              isOut: true,
            },
            count: { balls: 0, strikes: 0, outs: 2 },
            playEvents: [pitch('X', 1)],
            runners: [
              {
                details: { runner: { id: 5, fullName: 'Ozzie Albies' }, eventType: 'sac_fly' },
                movement: { start: null, end: null, outBase: '1B', isOut: true, outNumber: 2 },
                credits: [{ position: { code: '8' }, credit: 'f_putout' }],
              },
              {
                details: {
                  runner: { id: 1, fullName: 'Kien Vu' },
                  eventType: 'sac_fly',
                  isScoringEvent: true,
                  rbi: true,
                },
                movement: { start: '3B', end: 'score', isOut: false },
                credits: [],
              },
            ],
          },
        ],
      },
    },
  }
}

function cardFor(last) {
  return computeHalfInningFeed(buildFeed(), 8, 'bottom', 'home').find(
    (e) => e.kind === 'atbat' && e.batter.last === last,
  )
}

test('a sacrifice bunt booted by the fielder notates the ERROR, not a putout nobody made', () => {
  const sanchez = cardFor('Sanchez')
  // "SAC 5U" claimed an unassisted putout by the third baseman on a play where
  // nobody was retired, and never said an error had been charged at all.
  assert.equal(sanchez.code, 'SAC E5')
  assert.equal(sanchez.codeKind, 'error')
  // A reach code prints ABOVE the diamond; only an 'out' kind is centered in it.
  assert.notEqual(sanchez.codeKind, 'out')
  assert.equal(sanchez.reached, 1)
  assert.equal(sanchez.outNumber, null)
})

test('a sacrifice bunt the defense never played on reads as a reach on the fielder’s choice', () => {
  const tolbert = cardFor('Tolbert')
  // f_fielded_ball is not a putout — the old chain turned it into "SAC 2U".
  assert.equal(tolbert.code, 'SAC FC')
  assert.equal(tolbert.codeKind, 'reach')
  // 2, not 1: `reached` is the furthest base of his whole trip, and the next
  // batter's bunt pushed him to 2nd. What matters here is that he's aboard.
  assert.equal(tolbert.reached, 2)
  assert.equal(tolbert.outNumber, null)
})

test('an ordinary sacrifice bunt and sac fly keep their out notation', () => {
  const lopez = cardFor('Lopez')
  assert.equal(lopez.code, 'SAC 1-4')
  assert.equal(lopez.codeKind, 'out')
  assert.equal(lopez.outNumber, 1)

  const albies = cardFor('Albies')
  assert.equal(albies.code, 'SF8')
  assert.equal(albies.codeKind, 'out')
  assert.equal(albies.outNumber, 2)
})
