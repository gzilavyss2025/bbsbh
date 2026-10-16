// A batter who strikes out but reaches first on a wild pitch or a passed ball
// (the dropped third strike) carries TWO runners[] entries on his own play,
// both with `movement.start` null: first the strikeout leg itself, with every
// movement field null (no end, no isOut), then the advance leg with
// `end: '1B'`, `isOut: false`. Verified against gamePk 823804's bottom 6th
// (Garrett Mitchell strikes out swinging, to 1st on Drew Millas's passed ball)
// and gamePk 849830's top 4th (Ethan Salas, to 1st on Jacob Misiorowski's wild
// pitch). computeHalfInningFeed took the FIRST start-null entry as the batter's
// own leg, so scorebookCode saw the empty strikeout leg, missed that he was
// safe, and wrote a plain "K" out centred on a diamond that showed him aboard.
// Every such play in the 2026 Brewers season (both clubs, 169 games) did this.
// Pure scorebook-denotation logic, not a spoiler-gated module.
import assert from 'node:assert/strict'
import test from 'node:test'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

function person(id, last, first) {
  return { id, fullName: `${first} ${last}`, lastName: last, firstName: first, useName: first, primaryNumber: String(id) }
}

function pitch(code, n) {
  return { isPitch: true, pitchNumber: n, details: { call: { code } } }
}

// One plate appearance in the shape of gamePk 823804's bottom 6th.
function buildFeed({ how, desc }) {
  return {
    gamePk: 823804,
    gameData: { players: { ID5: person(5, 'Mitchell', 'Garrett'), ID9: { ...person(9, 'Waldichuk', 'Ken'), pitchHand: { code: 'L' } } } },
    liveData: {
      linescore: { scheduledInnings: 9, innings: [] },
      boxscore: {
        teams: {
          away: { players: {} },
          home: {
            players: {
              ID5: { person: { id: 5 }, battingOrder: '100', position: { abbreviation: 'CF' }, allPositions: [{ abbreviation: 'CF' }] },
            },
          },
        },
      },
      plays: {
        allPlays: [
          {
            about: { inning: 6, halfInning: 'bottom', atBatIndex: 1, isComplete: true },
            matchup: { batter: { id: 5, fullName: 'Garrett Mitchell' }, pitcher: { id: 9 }, batSide: { code: 'L' } },
            result: { type: 'atBat', eventType: 'strikeout', description: desc, rbi: 0 },
            count: { balls: 2, strikes: 3, outs: 0 },
            playEvents: [pitch('B', 1), pitch('B', 2), pitch('C', 3), pitch('S', 4), pitch('S', 5)],
            runners: [
              {
                details: { runner: { id: 5, fullName: 'Garrett Mitchell' }, eventType: 'strikeout', movementReason: null },
                movement: { originBase: null, start: null, end: null, outBase: null, isOut: null, outNumber: null },
              },
              {
                details: { runner: { id: 5, fullName: 'Garrett Mitchell' }, eventType: how, movementReason: 'r_adv_play' },
                movement: { originBase: null, start: null, end: '1B', outBase: null, isOut: false, outNumber: null },
              },
            ],
          },
        ],
      },
    },
  }
}

function card(feed) {
  return computeHalfInningFeed(feed, 6, 'bottom', 'home').find((e) => e.kind === 'atbat')
}

test('a dropped third strike on a passed ball reads K PB, a reach, batter aboard', () => {
  const c = card(buildFeed({ how: 'passed_ball', desc: 'Garrett Mitchell strikes out swinging. Garrett Mitchell to 1st. Passed ball by catcher Drew Millas.' }))
  assert.equal(c.code, 'K PB')
  assert.equal(c.codeKind, 'reach')
  assert.equal(c.reached, 1)
  assert.equal(c.outNumber, null)
})

test('a dropped third strike on a wild pitch reads K WP', () => {
  const c = card(buildFeed({ how: 'wild_pitch', desc: 'Garrett Mitchell strikes out swinging. Garrett Mitchell to 1st. Wild pitch by pitcher Ken Waldichuk.' }))
  assert.equal(c.code, 'K WP')
  assert.equal(c.codeKind, 'reach')
})
