// Regression coverage for two related bugs in computeHalfInningFeed's
// per-play advancement bookkeeping (src/api/playbyplay.js): the feed can
// pack MULTIPLE runners[] entries for the same runner into a single `play`
// object, and the code used to only ever look at one of them.
//
//  1. A runner who advances through a chain of events during a LATER
//     batter's plate appearance (a wild pitch, then a steal) has every one
//     of those legs recorded as separate runners[] entries on that LATER
//     batter's own play. The old code kept only the FURTHEST leg per play,
//     silently dropping the intermediate ones — a runner who took a wild
//     pitch to 2nd then stole 3rd showed only "scored", with no trace of
//     either the WP or the SB. Verified live against gamePk 818039's
//     bottom 5th (Alfredo Duno: 1B->2B on a wild pitch, 2B->3B stealing,
//     3B->home on Yerlin Confidan's single — all three legs live on
//     Confidan's own play object).
//  2. A batter who reaches safely and is then thrown out stretching for a
//     further base carries a SECOND runners[] entry for himself on his own
//     play (the first for his own hit, the second for the caught-advancing
//     out) — the old code's `.find()` only ever saw the first one, so the
//     out vanished: no out mark, no out code, no out-of-the-inning number.
//     Verified live against gamePk 817477's bottom 2nd (Cameron Sisneros
//     singles, out at 2nd on the throw). The same fixture's fielding
//     credits also cover a duplicate `f_assist`/`f_assist_of` pair the feed
//     issues to the SAME outfielder for the SAME throw, which used to
//     double him up in the fielding chain ("9-9-6" instead of "9-6").
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { computeHalfInningFeed } from '../src/api/playbyplay.js'

test('a runner who takes a wild pitch then steals a base during a LATER batter\'s plate appearance gets a notation for each leg, not just the final one', () => {
  const feed = buildFeed()
  feed.liveData.plays.allPlays.push(
    {
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 5 } },
      result: { type: 'atBat', eventType: 'single', description: 'Ed Ellis singles.' },
      count: { outs: 0 },
      playEvents: [{ isPitch: true, pitchNumber: 1, details: { call: { code: 'X' } } }],
      runners: [
        {
          details: { runner: { id: 5 }, eventType: 'single' },
          movement: { start: null, end: '1B', isOut: false },
        },
      ],
    },
    {
      // Finn Frye's own plate appearance — but its runners[] also carries the
      // whole rest of Ellis's trip: a wild pitch to 2nd, then a steal of 3rd,
      // both mid-count before Frye ever puts a ball in play, then Ellis
      // scoring on Frye's eventual single.
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 6 } },
      result: { type: 'atBat', eventType: 'single', description: 'Finn Frye singles. Ed Ellis scores.' },
      count: { outs: 0 },
      playEvents: [{ isPitch: true, pitchNumber: 1, details: { call: { code: 'X' } } }],
      runners: [
        {
          details: { runner: { id: 5 }, eventType: 'wild_pitch' },
          movement: { start: '1B', end: '2B', isOut: false },
        },
        {
          details: { runner: { id: 5 }, eventType: 'stolen_base_3b' },
          movement: { start: '2B', end: '3B', isOut: false },
        },
        {
          details: { runner: { id: 6 }, eventType: 'single' },
          movement: { start: null, end: '1B', isOut: false },
        },
        {
          details: { runner: { id: 5 }, eventType: 'single', isScoringEvent: true, earned: true },
          movement: { start: '3B', end: 'score', isOut: false },
        },
      ],
    },
  )

  const entries = computeHalfInningFeed(feed, 3, 'top', 'away')
  const ellisCard = entries.find((e) => e.kind === 'atbat' && e.batterId === 5)
  assert.ok(ellisCard, 'Ellis\'s own at-bat card should exist')
  assert.equal(ellisCard.legNotations[2]?.code, 'WP', 'the wild-pitch leg to 2nd must show')
  assert.equal(ellisCard.legNotations[3]?.code, 'SB', 'the steal leg to 3rd must show')
  assert.equal(ellisCard.legNotations[4]?.code, '1B', 'the scoring leg on the later single must still show too')
  assert.equal(ellisCard.scored, true)
})

test('one continuous advance split into consecutive same-play legs collapses to a single notation at the furthest base, not one per base passed', () => {
  const feed = buildFeed()
  feed.liveData.plays.allPlays.push(
    {
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 5 } },
      result: { type: 'atBat', eventType: 'single', description: 'Ed Ellis singles.' },
      count: { outs: 0 },
      playEvents: [{ isPitch: true, pitchNumber: 1, details: { call: { code: 'X' } } }],
      runners: [
        {
          details: { runner: { id: 5 }, eventType: 'single' },
          movement: { start: null, end: '1B', isOut: false },
        },
      ],
    },
    {
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 6 } },
      result: { type: 'atBat', eventType: 'single', description: 'Finn Frye singles. Ed Ellis to 2nd.' },
      count: { outs: 0 },
      playEvents: [{ isPitch: true, pitchNumber: 1, details: { call: { code: 'X' } } }],
      runners: [
        {
          details: { runner: { id: 5 }, eventType: 'single' },
          movement: { start: '1B', end: '2B', isOut: false },
        },
        {
          details: { runner: { id: 6 }, eventType: 'single' },
          movement: { start: null, end: '1B', isOut: false },
        },
      ],
    },
    {
      // One single batted-ball advance, but the feed reports it as two
      // consecutive runners[] entries for the same runner (2nd->3rd, then
      // 3rd->home) — both driven by this same play's single, same code,
      // same crediting slot. That's one hit, not two, and should pencil one
      // mark at the base the advance actually ended (home), not a second
      // identical mark at 3rd along the way.
      about: { inning: 3, halfInning: 'top' },
      matchup: { pitcher: { id: 200 }, batter: { id: 7 } },
      result: { type: 'atBat', eventType: 'single', description: 'Gil Gore singles. Ed Ellis scores.' },
      count: { outs: 0 },
      playEvents: [{ isPitch: true, pitchNumber: 1, details: { call: { code: 'X' } } }],
      runners: [
        {
          details: { runner: { id: 5 }, eventType: 'single' },
          movement: { start: '2B', end: '3B', isOut: false },
        },
        {
          details: { runner: { id: 5 }, eventType: 'single', isScoringEvent: true, earned: true },
          movement: { start: '3B', end: 'score', isOut: false },
        },
        {
          details: { runner: { id: 7 }, eventType: 'single' },
          movement: { start: null, end: '1B', isOut: false },
        },
      ],
    },
  )

  const entries = computeHalfInningFeed(feed, 3, 'top', 'away')
  const ellisCard = entries.find((e) => e.kind === 'atbat' && e.batterId === 5)
  assert.ok(ellisCard, 'Ellis\'s own at-bat card should exist')
  assert.equal(ellisCard.legNotations[3], undefined, 'the intermediate 3rd-base leg is collapsed, not penciled twice')
  assert.equal(ellisCard.legNotations[4]?.code, '1B', 'the advance is marked once, at the base it actually ended')
  assert.equal(ellisCard.scored, true)
})

test('a batter thrown out stretching for an extra base on his own hit gets an out mark on his own diamond, with the duplicate outfield-assist credit collapsed', () => {
  const feed = buildFeed()
  feed.liveData.plays.allPlays.push({
    about: { inning: 3, halfInning: 'top' },
    matchup: { pitcher: { id: 200 }, batter: { id: 7 } },
    result: {
      type: 'atBat',
      eventType: 'single',
      description: 'Gil Gore singles. Gil Gore out at 2nd on the throw.',
    },
    count: { outs: 0 },
    playEvents: [{ isPitch: true, pitchNumber: 1, details: { call: { code: 'X' } } }],
    runners: [
      {
        details: { runner: { id: 7 }, eventType: 'single' },
        movement: { start: null, end: '1B', isOut: false },
        credits: [{ position: { code: '9' }, credit: 'f_fielded_ball' }],
      },
      {
        details: { runner: { id: 7 }, eventType: 'other_out' },
        movement: { start: '1B', end: null, outBase: '2B', isOut: true, outNumber: 1 },
        credits: [
          { position: { code: '9' }, credit: 'f_assist' },
          { position: { code: '9' }, credit: 'f_assist_of' },
          { position: { code: '6' }, credit: 'f_putout' },
        ],
      },
    ],
  })

  const entries = computeHalfInningFeed(feed, 3, 'top', 'away')
  const goreCard = entries.find((e) => e.kind === 'atbat' && e.batterId === 7)
  assert.ok(goreCard, 'Gore\'s own at-bat card should exist')
  assert.equal(goreCard.code, '1B', 'his own hit still reads as a single up top')
  assert.equal(goreCard.reached, 1, 'he is only credited with reaching 1st, not the base he was thrown out stretching for')
  assert.equal(goreCard.outAt, 2, 'the out is marked at 2nd, where he was thrown out')
  assert.equal(goreCard.outCode, '9-6', 'the fielding chain drops the duplicate outfield-assist credit')
  assert.equal(goreCard.outNumber, 1)
})
