import assert from 'node:assert/strict'
import test from 'node:test'
import { nuggetsForGame, CARD_WINDOW_DAYS } from '../src/api/nuggets/nuggets.js'
import { buildNuggetNotes, nuggetText } from '../src/api/callout-notes/nugget.js'
import { buildBetweenInnings } from '../src/api/callout-notes/surfaces/betweenInnings.js'
import { ONCE_PER_GAME_KINDS } from '../src/api/callout-notes/shared.js'
import { buildFeed } from './fixtures/mini-game.js'

// A small store in the generator's shape (scripts/gen-nuggets.mjs).
const store = {
  season: 2026,
  nuggets: {
    sho1: [
      { player: 300, date: '2026-06-30', count: 4, anchor: 'rushmore', relation: 'equal' },
      { player: 300, date: '2026-07-07', count: 5, anchor: 'great-lakes', relation: 'equal' }, // the game's own date
    ],
    k200: [
      { player: 200, date: '2026-07-06', count: 11, anchor: 'moon-walked', relation: 'fewer' },
      { player: 999, date: '2026-07-06', count: 11, anchor: 'moon-walked', relation: 'fewer' }, // not in this game
    ],
    cg1: [{ player: 200, date: '2026-06-01', count: 3, anchor: null, relation: null }], // more than 7 days old
  },
}
const GAME_DATE = '2026-07-07'

test('the reader returns only nuggets dated BEFORE the game\'s date, for its players, within the window', () => {
  const got = nuggetsForGame(store, { gameDate: GAME_DATE, players: [300, 200] })
  assert.deepEqual(got.map((n) => `${n.threshold}:${n.player}:${n.date}`).sort(), ['k200:200:2026-07-06', 'sho1:300:2026-06-30'])
  assert.ok(got.every((n) => n.date < GAME_DATE))
})

test(`the window is ${CARD_WINDOW_DAYS} days`, () => {
  assert.equal(CARD_WINDOW_DAYS, 7)
  assert.equal(nuggetsForGame(store, { gameDate: '2026-07-08', players: [300] }).find((n) => n.date === '2026-06-30'), undefined)
  assert.ok(nuggetsForGame(store, { gameDate: '2026-07-07', players: [300] }).find((n) => n.date === '2026-06-30'))
})

test('the reader answers [] without a store, a date or players', () => {
  assert.deepEqual(nuggetsForGame(null, { gameDate: GAME_DATE, players: [300] }), [])
  assert.deepEqual(nuggetsForGame(store, { gameDate: null, players: [300] }), [])
  assert.deepEqual(nuggetsForGame(store, { gameDate: GAME_DATE, players: [] }), [])
})

test('the note text: count, group, label, and the anchor comparison', () => {
  const n = { threshold: 'sho1', player: 1, date: '2026-09-25', count: 11, anchor: 'moon-walked', relation: 'fewer' }
  assert.equal(nuggetText(n, { anchored: true }), 'One of 11 pitchers with a shutout, fewer than the 12 people who have walked on the moon')
  assert.equal(nuggetText(n, { anchored: false }), 'One of 11 pitchers with a shutout')
  assert.equal(nuggetText({ ...n, threshold: 'rbi100', count: 9, anchor: 'scotus', relation: 'equal' }, { anchored: true }),
    'One of 9 hitters with 100 RBI, as many as the 9 Supreme Court justices')
  assert.equal(nuggetText({ ...n, count: 6, anchor: 'great-lakes', relation: 'more' }, { anchored: true }),
    'One of 6 pitchers with a shutout, more than the 5 Great Lakes')
  assert.equal(nuggetText({ ...n, count: 1, anchor: null, relation: null }, { anchored: false }), 'The only pitcher with a shutout')
})

test('only the top-ranked nugget gets the anchor; the rest are plain, and a plain count past plainMax is cut', () => {
  const list = [
    { threshold: 'k200', player: 200, date: '2026-07-06', count: 11, anchor: 'moon-walked', relation: 'fewer' },
    { threshold: 'sho1', player: 300, date: '2026-06-30', count: 4, anchor: 'rushmore', relation: 'equal' },
    { threshold: 'cg1', player: 300, date: '2026-06-30', count: 12, anchor: 'moon-walked', relation: 'equal' }, // plainMax 10
  ]
  const notes = buildNuggetNotes(list, { sideOf: (id) => (id === 300 ? 'away' : 'home') })
  assert.deepEqual(notes.map((n) => n.text), [
    'One of 4 pitchers with a shutout, as many as the 4 presidents on Mount Rushmore',
    'One of 11 pitchers with 200 strikeouts',
  ])
  assert.ok(notes.every((n) => n.kind === 'nugget' && n.personId != null && n.dedupeKey))
  assert.equal(notes[0].side, 'away')
  assert.ok(notes[0].score > notes[1].score, 'a smaller count scores higher')
})

// Parent review (#2949) 1: the comparison is worked out from the anchor as it reads today, so a
// published note never contradicts itself, and an anchor no longer verified or past its
// re-check window is not shown.
test('the relation is recomputed from the live anchor, and a stale or unverified anchor is dropped', () => {
  const stale = { threshold: 'sho1', player: 1, date: '2026-09-25', count: 13, anchor: 'triple-crown-horses', relation: 'fewer' }
  assert.equal(nuggetText(stale, { anchored: true, date: '2026-09-26' }), 'One of 13 pitchers with a shutout, as many as the 13 horses that have won the Triple Crown')
  assert.equal(nuggetText(stale, { anchored: true, date: '2027-06-01' }), 'One of 13 pitchers with a shutout', 'volatile, past 180 days')
  const unverified = { ...stale, count: 27, anchor: 'amendments', relation: 'equal' }
  assert.equal(nuggetText(unverified, { anchored: true, date: '2026-09-26' }), 'One of 27 pitchers with a shutout')
})

// Parent review (#2949) 3 and 4: a nugget is a once-a-game fact, and the anchor goes to the
// nugget that leads among those still to show.
test('a nugget shows once a game, and the next one up takes the anchor', () => {
  assert.ok(ONCE_PER_GAME_KINDS.has('nugget'))
  const list = [
    { threshold: 'sho1', player: 300, date: '2026-06-30', count: 4, anchor: 'rushmore', relation: 'equal' },
    { threshold: 'k200', player: 200, date: '2026-07-06', count: 11, anchor: 'moon-walked', relation: 'fewer' },
  ]
  const shownCounts = new Map([['nugget-sho1-300', 1]])
  assert.deepEqual(buildNuggetNotes(list, { shownCounts, date: GAME_DATE }).map((n) => n.text),
    ['One of 11 pitchers with 200 strikeouts, fewer than the 12 people who have walked on the moon'])
  const feed = buildFeed()
  feed.gameData.probablePitchers = { away: { id: 300 }, home: { id: 200 } }
  const bundle = { away: { teamId: 158, name: 'Away Club' }, home: { teamId: 138, name: 'Home Club' } }
  const cards = buildBetweenInnings({ feed, bundle, inning: 1, half: 'top', revealedThrough: 0, gameDate: GAME_DATE, nuggets: store, shownCounts })
  const nuggets = cards.filter((n) => n.kind === 'nugget')
  assert.equal(nuggets.length, 1)
  assert.match(nuggets[0].text, /fewer than the 12 people/)
})

// Review (#2949): the anchor belongs to the top nugget on the card, or to none.
test('a lower nugget never takes the anchor the top one lacks', () => {
  const list = [
    { threshold: 'sho1', player: 300, date: '2026-06-30', count: 3, anchor: null, relation: null },
    { threshold: 'k200', player: 200, date: '2026-07-06', count: 12, anchor: 'moon-walked', relation: 'equal' },
  ]
  assert.deepEqual(buildNuggetNotes(list).map((n) => n.text), ['One of 3 pitchers with a shutout', 'One of 12 pitchers with 200 strikeouts'])
  // A top nugget with no anchor and a count past plainMax makes no note, so the next one is the top.
  const cut = [{ threshold: 'cg1', player: 300, date: '2026-06-30', count: 11, anchor: null, relation: null }, list[1]]
  assert.deepEqual(buildNuggetNotes(cut).map((n) => n.text), ['One of 12 pitchers with 200 strikeouts, as many as the 12 people who have walked on the moon'])
})

// Review (#2949): a crossing made in this game before a suspension must not pass the cut. A
// real resumed feed (824912, 2026-06-16, resumed 06-17) keeps officialDate on the original day;
// this pins the cut to the earlier date if a feed ever moves officialDate to the resume day.
test('a resumed game cuts at its ORIGINAL date', () => {
  const feed = buildFeed()
  feed.gameData.probablePitchers = { away: { id: 300 }, home: { id: 200 } }
  feed.gameData.datetime = { ...(feed.gameData.datetime ?? {}), officialDate: '2026-07-08', originalDate: '2026-07-07', resumeDate: '2026-07-08' }
  const bundle = { away: { teamId: 158, name: 'Away Club' }, home: { teamId: 138, name: 'Home Club' } }
  const crossedInThisGame = { season: 2026, nuggets: { sho1: [{ player: 300, date: '2026-07-07', count: 5, anchor: 'great-lakes', relation: 'equal' }] } }
  const cards = buildBetweenInnings({ feed, bundle, inning: 1, half: 'top', revealedThrough: 0, gameDate: '2026-07-08', nuggets: crossedInThisGame })
  assert.equal(cards.filter((n) => n.kind === 'nugget').length, 0)
})

// Done means (#2809): a nugget dated on a game's own date never reaches a scoring surface.
test('Between Innings never shows a nugget dated on the game\'s own date', () => {
  const feed = buildFeed()
  feed.gameData.probablePitchers = { away: { id: 300 }, home: { id: 200 } }
  feed.gameData.datetime = { ...(feed.gameData.datetime ?? {}), officialDate: GAME_DATE }
  const bundle = { away: { teamId: 158, name: 'Away Club' }, home: { teamId: 138, name: 'Home Club' } }
  const onlyToday = { season: 2026, nuggets: { sho1: [store.nuggets.sho1[1]] } }
  for (const [inning, half] of [[1, 'top'], [1, 'bottom'], [2, 'top']]) {
    const cards = buildBetweenInnings({ feed, bundle, inning, half, revealedThrough: 2, gameDate: GAME_DATE, nuggets: onlyToday })
    assert.equal(cards.filter((n) => n.kind === 'nugget').length, 0)
    assert.ok(!cards.some((n) => /Great Lakes/.test(n.text)))
  }
  const cards = buildBetweenInnings({ feed, bundle, inning: 1, half: 'top', revealedThrough: 0, gameDate: GAME_DATE, nuggets: store })
  const nugget = cards.find((n) => n.kind === 'nugget')
  assert.ok(nugget, 'an older nugget for a starter does show')
  assert.ok(!cards.some((n) => /Great Lakes/.test(n.text)))
})
