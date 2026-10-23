// Scorebook notation option B (issue #2575, Gary's pick on 2026-10-21):
//  1. A pickoff that catches a runner stealing reads "PKCS 1-3" with the out
//     on the path to the base he was stealing; a plain pickoff stays "PK 1-3".
//  2. An error right after a steal, thrown during another batter's plate
//     appearance, credits no batter's slot; an error on a batted ball still does.
// Verified against gamePk 824951 top 1st (Neto: pickoff_caught_stealing_2b,
// feed outBase '1B'), 823166 bottom 4th (Whitcomb: pickoff_1b) and 823166
// bottom 1st (Cox: stolen_base_2b then an 'error' leg, both playIndex 1 — a
// non-pitch action event, mid-at-bat).
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

const pitch = (code = 'X') => ({ isPitch: true, pitchNumber: 1, details: { call: { code } } })

// Ashby (id 1) singles, then Bell (id 2) is in the box when `runnerEntry` happens.
function pickoffFeed(eventType, outBase) {
  const feed = buildFeed()
  feed.liveData.plays.allPlays.push(
    {
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 1 } },
      result: { type: 'atBat', eventType: 'single' },
      count: { outs: 0 },
      playEvents: [pitch()],
      runners: [{ details: { runner: { id: 1 }, eventType: 'single' }, movement: { start: null, end: '1B', isOut: false } }],
    },
    {
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 2 } },
      result: { type: 'atBat', eventType: 'strikeout', description: 'Ben Bell strikes out.' },
      count: { outs: 2 },
      playEvents: [{ isPitch: false, details: { eventType } }, pitch('S')],
      runners: [
        {
          details: { runner: { id: 1 }, eventType, playIndex: 0 },
          movement: { start: '1B', end: null, outBase, isOut: true, outNumber: 1 },
          credits: [
            { credit: 'f_assist', position: { code: '1' } },
            { credit: 'f_putout', position: { code: '3' } },
          ],
        },
      ],
    },
  )
  return computeHalfInningFeed(feed, 3, 'top', 'away').find((e) => e.kind === 'atbat' && e.batterId === 1)
}

test('a pickoff that catches a runner stealing 2nd reads PKCS 1-3 with the out on the path to 2nd', () => {
  const card = pickoffFeed('pickoff_caught_stealing_2b', '1B')
  assert.equal(card.outCode, 'PKCS 1-3')
  assert.equal(card.outAt, 2)
})

test('a pickoff that catches a runner stealing 3rd puts the out on the path to 3rd', () => {
  const card = pickoffFeed('pickoff_caught_stealing_3b', '2B')
  assert.equal(card.outCode, 'PKCS 1-3')
  assert.equal(card.outAt, 3)
})

test('a plain pickoff stays PK 1-3 with the out at 1st', () => {
  const card = pickoffFeed('pickoff_1b', '1B')
  assert.equal(card.outCode, 'PK 1-3')
  assert.equal(card.outAt, 1)
})

function errorFeed({ midAtBat }) {
  const feed = buildFeed()
  feed.liveData.plays.allPlays.push(
    {
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 1 } },
      result: { type: 'atBat', eventType: 'single' },
      count: { outs: 0 },
      playEvents: [pitch()],
      runners: [{ details: { runner: { id: 1 }, eventType: 'single' }, movement: { start: null, end: '1B', isOut: false } }],
    },
    {
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 2 } },
      result: { type: 'atBat', eventType: 'field_out', description: 'Ben Bell grounds out.' },
      count: { outs: 1 },
      // midAtBat: the steal and the throwing error are an action event (index 0)
      // before the pitch; otherwise the error rides the batted ball itself.
      playEvents: midAtBat
        ? [{ isPitch: false, details: { eventType: 'stolen_base_2b' } }, pitch()]
        : [pitch()],
      runners: [
        ...(midAtBat
          ? [{ details: { runner: { id: 1 }, eventType: 'stolen_base_2b', playIndex: 0 }, movement: { start: '1B', end: '2B', isOut: false } }]
          : []),
        {
          details: { runner: { id: 1 }, eventType: 'error', playIndex: midAtBat ? 0 : 0 },
          movement: { start: midAtBat ? '2B' : '1B', end: '3B', isOut: false },
          credits: [{ credit: 'f_throwing_error', position: { code: '2' } }],
        },
      ],
    },
  )
  return computeHalfInningFeed(feed, 3, 'top', 'away').find((e) => e.kind === 'atbat' && e.batterId === 1)
}

test('an error right after a steal credits no batter slot', () => {
  const card = errorFeed({ midAtBat: true })
  assert.equal(card.legNotations[2].code, 'SB')
  assert.equal(card.legNotations[3].code, 'E2')
  assert.equal(card.legNotations[3].slot, null)
})

test('an error on a batted ball still credits the batter\'s slot', () => {
  const card = errorFeed({ midAtBat: false })
  assert.equal(card.legNotations[3].code, 'E2')
  assert.notEqual(card.legNotations[3].slot, null)
})
