import test from 'node:test'
import assert from 'node:assert/strict'
import { liveAtThirdOut, sameLiveState } from '../src/lib/scorebug/liveState.js'
import { glyphD } from '../src/lib/pitch/pitchGlyph.js'

const batter = { order: 4, last: 'Adell', line: '0-1' }
const pitcher = { last: 'Peralta', pitches: 7 }

test('the 3rd-out snapshot clears bases and outs but keeps the last batter and pitcher, marked over', () => {
  const s = liveAtThirdOut({ batter, pitcher, inning: 1, half: 'top' })
  assert.equal(s.over, true)
  assert.equal(s.outs, 0)
  assert.deepEqual(s.bases, { first: false, second: false, third: false })
  assert.equal(s.batter, batter)
  assert.equal(s.pitcher, pitcher)
})

test('the 3rd-out snapshot points the indicator at the next half', () => {
  const top = liveAtThirdOut({ batter, pitcher, inning: 3, half: 'top' })
  assert.deepEqual([top.inning, top.half], [3, 'bottom'])
  const bottom = liveAtThirdOut({ batter, pitcher, inning: 3, half: 'bottom' })
  assert.deepEqual([bottom.inning, bottom.half], [4, 'top'])
})

test('sameLiveState sees `over`, so the dimmed half-end state is never swallowed as unchanged', () => {
  const open = { bases: {}, outs: 0, batter, pitcher, inning: 2, half: 'top' }
  assert.equal(sameLiveState(open, { ...open }), true)
  assert.equal(sameLiveState(open, { ...open, over: true }), false)
})

test('sameLiveState compares the leaves, not the identity', () => {
  const a = { bases: { first: true }, outs: 1, batter: { ...batter }, pitcher: { ...pitcher }, inning: 5, half: 'bottom' }
  const b = { bases: { first: true }, outs: 1, batter: { ...batter }, pitcher: { ...pitcher }, inning: 5, half: 'bottom' }
  assert.equal(sameLiveState(a, b), true)
  assert.equal(sameLiveState(a, { ...b, pitcher: { ...pitcher, pitches: 8 } }), false)
  assert.equal(sameLiveState(a, null), false)
})

test('glyphD draws a path per family shape and falls back to the hexagon for an unknown one', () => {
  for (const shape of ['circle', 'diamond', 'square', 'triangle', 'hexagon']) {
    assert.match(glyphD(shape, 7), /^M.*Z$/, shape)
  }
  assert.equal(glyphD('blob', 7), glyphD('hexagon', 7))
})

// Gameday's Pitcher rail and stage read the revealed mid-half change by id (2026-10-28: Kevin Kelly
// for Griffin Jax, 849803 top 5th, never reached the rail). A snapshot that moves only that id must
// replace the stored one.
test('sameLiveState sees the mid-half pitcher, so a revealed change is never swallowed', () => {
  const before = { inning: 5, half: 'top', outs: 0, bases: {}, midHalfPitcherId: null }
  assert.equal(sameLiveState(before, { ...before }), true)
  assert.equal(sameLiveState(before, { ...before, midHalfPitcherId: 687330 }), false)
})
