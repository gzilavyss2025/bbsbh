// Regression coverage for selectIsFreshPitcher (src/api/select.js) — the
// "Now pitching" vs. "Pitching for..." decision HalfInning.jsx's persistent
// header label depends on. Previously inlined as `livePitcher != null ||
// inning === 1 || previousEnteringPitcher?.id !== enteringPitcher?.id`, which
// mislabeled every pitcher continuing from his own previous start as "Now
// pitching" — PlayByPlay's onCurrentPitcher reports a value unconditionally
// the moment any of a half is revealed, not just on a genuine substitution
// (verified live: Chris Sale continuing from top 5th into top 6th with no
// pitching change showed "Now pitching" every time). Fixed by comparing
// `nowPitching` (whoever's ACTUALLY on the mound) against the previous half
// of the same parity's own starter.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { selectIsFreshPitcher } from '../src/api/select.js'

// mini-game.js's pitchers: home #200 starts (top 1), home reliever #201 takes
// over top 2 (a genuine sub, announced pre-pitch); away #300 starts and stays
// in for both of his own halves, bottom 1 AND bottom 2 (a team only pitches
// every OTHER half, so bottom 2's "previous half of the same parity" is
// bottom 1, not top 2).

test('the game\'s first half is always fresh, regardless of who is pitching', () => {
  const feed = buildFeed()
  assert.equal(selectIsFreshPitcher(feed, 1, 'top', Infinity, 200), true)
  assert.equal(selectIsFreshPitcher(feed, 1, 'bottom', Infinity, 300), true)
})

test('a reliever replacing the previous half\'s starter reads fresh', () => {
  const feed = buildFeed()
  // Top 2: reliever #201 replaced top 1's starter #200.
  assert.equal(selectIsFreshPitcher(feed, 2, 'top', Infinity, 201), true)
})

test('the same pitcher carrying over from his own previous half reads NOT fresh', () => {
  const feed = buildFeed()
  // Bottom 2: away #300 stayed in from bottom 1 — the regression this fix
  // targets. The old `livePitcher != null` check read this as fresh on every
  // revealed half; comparing against the previous same-parity half's starter
  // correctly reads it as a carryover.
  assert.equal(selectIsFreshPitcher(feed, 2, 'bottom', Infinity, 300), false)
})

test('without enough revealed to know the previous half\'s starter, reads fresh by default', () => {
  const feed = buildFeed()
  // revealedThrough = -1 clamps selectHalfStartingPitcher(feed, 1, 'bottom',
  // -1) to null (bottom 1's own half-index of 1 is past -1 + 1 = 0), so
  // there's no previous identity to compare against — same footing as a
  // genuine change.
  assert.equal(selectIsFreshPitcher(feed, 2, 'bottom', -1, 300), true)
})
