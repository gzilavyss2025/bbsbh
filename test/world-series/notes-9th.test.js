// wsWtaTrailing9: entering the top of the 9th of a winner-take-all game, for the club that trails.
// It reads tonight's score, so it waits for the 8th to be revealed (like buildAfterInningNote).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPreHalfCallouts } from '../../src/api/prehalf-callouts.js'
import { halfIndex } from '../../src/api/select.js'
import { EVENTS_JSON, BUNDLE } from './ws-fixture.js'

// The game through eight innings: all the runs score in the 1st, away then home.
const feedThrough8 = (away, home) => ({
  gameData: { game: { type: 'W' }, datetime: { officialDate: '2026-10-30' }, status: { abstractGameState: 'Live' } },
  liveData: {
    plays: { allPlays: [] },
    linescore: { innings: Array.from({ length: 8 }, (_, i) => ({ num: i + 1, away: { runs: i === 0 ? away : 0 }, home: { runs: i === 0 ? home : 0 } })) },
  },
})
const bundle = (wta = true) => ({ ...BUNDLE, wsEvents: { events: [], wta } })
const strip = (feed, { b = bundle(), revealedThrough = halfIndex(8, 'bottom'), inning = 9, half = 'top', history = EVENTS_JSON } = {}) =>
  buildPreHalfCallouts({ feed, bundle: b, inning, half, revealedThrough, gameDate: '2026-10-30', eventHistory: history })
    .filter((n) => n.kind === 'wsWtaTrailing9')

test('the trailing club gets the record, 3-33 from the file (a 1 counts as a win)', () => {
  const out = strip(feedThrough8(2, 1))
  assert.equal(out.length, 1)
  assert.equal(out[0].text, 'Teams trailing entering the 9th of a winner-take-all game are 3-33.')
  assert.equal(out[0].side, 'home')
})

test('the trailing club is the one behind: the home club when it trails', () => {
  assert.equal(strip(feedThrough8(1, 2))[0].side, 'away')
  assert.equal(strip(feedThrough8(2, 1))[0].side, 'home')
})

test('a level game gives no note', () => {
  assert.deepEqual(strip(feedThrough8(1, 1)), [])
})

test('the gate: nothing until the 8th is revealed', () => {
  assert.deepEqual(strip(feedThrough8(2, 1), { revealedThrough: halfIndex(8, 'top') }), [])
  assert.equal(strip(feedThrough8(2, 1), { revealedThrough: halfIndex(8, 'bottom') }).length, 1)
})

test('only a winner-take-all game, only the top of the 9th', () => {
  assert.deepEqual(strip(feedThrough8(2, 1), { b: bundle(false) }), [])
  assert.deepEqual(strip(feedThrough8(2, 1), { half: 'bottom' }), [])
  assert.deepEqual(strip(feedThrough8(2, 1), { inning: 8 }), [])
})

test('an older shard without wsEvents, no history, or another game type: nothing', () => {
  assert.deepEqual(strip(feedThrough8(2, 1), { b: BUNDLE }), [])
  assert.deepEqual(strip(feedThrough8(2, 1), { history: null }), [])
  const f = feedThrough8(2, 1)
  f.gameData.game.type = 'R'
  assert.deepEqual(strip(f), [])
})

test('a history with no earlier winner-take-all row gives no "0-0" note', () => {
  const noRows = { ...EVENTS_JSON, events: EVENTS_JSON.events.filter((r) => r.tag !== 'wtaTrailing9') }
  assert.deepEqual(strip(feedThrough8(2, 1), { history: noRows }), [])
})
