// deriveLiveState (src/api/playbyplay.js) — the scorebug HUD's cap-respecting
// base/outs/pitches/batter snapshot. The two properties that matter most for
// the spoiler rule: it must never reflect anything beyond the given cap, and
// base occupancy must track who's CURRENTLY on base, not merely who reached
// one at some point in the half.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFeed } from './fixtures/mini-game.js'
import { computeHalfInningFeed, deriveLiveState } from '../src/api/playbyplay.js'

// Hand-built entries — deriveLiveState's contract is defined purely in terms
// of the `entries` shape (kind/batterId/runnerId/batter/runner/reached/
// scored/outNumber/pitches/eventType), so exercising it directly against
// small synthetic arrays is both faster and more precise than threading a
// whole feed through computeHalfInningFeed for these edge cases.
function atbat(batterId, last, { reached = 0, scored = false, outNumber = null, pitches = [], interrupted = false } = {}) {
  return { kind: 'atbat', batterId, batter: { last, first: '' }, reached, scored, outNumber, pitches, interrupted }
}
function placed(runnerId, last, { reached, outNumber = null } = {}) {
  return { kind: 'placed', runnerId, runner: { last, first: '' }, reached, scored: false, outNumber, pitches: [] }
}
function subEvent(playerId) {
  return { kind: 'event', eventType: 'pitching_substitution', playerId }
}

test('deriveLiveState never reflects anything beyond the given cap', () => {
  const entries = [
    atbat(1, 'Alpha', { reached: 1, pitches: ['B', 'C'] }), // safe at 1st
    atbat(2, 'Bravo', { scored: true, pitches: ['X'] }), // scores — not on base
    atbat(3, 'Charlie', { outNumber: 3, pitches: ['S'] }), // 3rd out, game/half ends
  ]
  // Capped BEFORE Charlie's card exists at all.
  const capped = deriveLiveState(entries, 2)
  assert.equal(capped.outs, 0, 'the 3rd out beyond the cap must not count')
  assert.equal(capped.batter.last, 'Bravo', 'must not name a batter beyond the cap')
  assert.equal(capped.pitchesSoFar, 3, 'only pitches from the two visible cards')

  const full = deriveLiveState(entries, 3)
  assert.equal(full.outs, 3)
  assert.equal(full.batter.last, 'Charlie')
})

test('base occupancy reflects who is CURRENTLY on base, not everyone who ever reached', () => {
  const entries = [
    atbat(1, 'Alpha', { reached: 1 }), // on 1st
    atbat(2, 'Bravo', { reached: 2 }), // on 2nd
    atbat(3, 'Charlie', { scored: true }), // came around to score — off the bases
  ]
  const state = deriveLiveState(entries, 3)
  assert.deepEqual(state.bases, { first: true, second: true, third: false })
})

test('an out or a run clears that runner off the bases', () => {
  const entries = [
    atbat(1, 'Alpha', { reached: 1, outNumber: 1 }), // picked off / caught stealing — not on base
    atbat(2, 'Bravo', { reached: 3, scored: false }), // safe at 3rd
  ]
  const state = deriveLiveState(entries, 2)
  assert.deepEqual(state.bases, { first: false, second: false, third: true })
  assert.equal(state.outs, 1)
})

test('a placed (extra-innings automatic) runner counts toward base occupancy', () => {
  const entries = [placed(50, 'Runner', { reached: 2 })]
  const state = deriveLiveState(entries, 1)
  assert.deepEqual(state.bases, { first: false, second: true, third: false })
  assert.equal(state.batter.last, 'Runner')
})

test('a mid-half pitching change resets the pitch count and reports the incoming pitcher', () => {
  const entries = [
    atbat(1, 'Alpha', { pitches: ['B', 'B', 'X'] }),
    subEvent(999),
    atbat(2, 'Bravo', { pitches: ['S', 'S'] }),
  ]
  const before = deriveLiveState(entries, 1)
  assert.equal(before.midHalfPitcherId, null)
  assert.equal(before.pitchesSoFar, 3)

  const after = deriveLiveState(entries, 3)
  assert.equal(after.midHalfPitcherId, 999)
  // Only the two pitches thrown SINCE the change — not the outgoing
  // pitcher's 3 from before it.
  assert.equal(after.pitchesSoFar, 2)
})

test('an empty half (nothing visible yet) reports a safe, empty baseline', () => {
  const state = deriveLiveState([], null)
  assert.deepEqual(state.bases, { first: false, second: false, third: false })
  assert.equal(state.outs, 0)
  assert.equal(state.pitchesSoFar, 0)
  assert.equal(state.batter, null)
  assert.equal(state.midHalfPitcherId, null)
})

// Sanity check against the real computeHalfInningFeed pipeline (top of the
// 1st in the shared mini-game fixture: a strikeout, a solo home run, two more
// outs) — a home run scores immediately, so it must never show as an
// occupied base even though the batter clearly "reached."
test('integration: a home run never leaves its batter on base', () => {
  const entries = computeHalfInningFeed(buildFeed(), 1, 'top', 'away')
  const afterHomer = deriveLiveState(entries, 2) // strikeout, then the home run
  assert.deepEqual(afterHomer.bases, { first: false, second: false, third: false })
  assert.equal(afterHomer.batter.last, 'Bell')

  const beforeHomer = deriveLiveState(entries, 1)
  assert.equal(beforeHomer.batter.last, 'Ashby', 'must not name the next batter ahead of the cap')
})

// batterDone — the field HalfInning.jsx's composeLive uses to decide whether
// to advance to the next slot in the order (the reported bug: the scorebug
// kept showing the batter who just doubled instead of the next man up).
test('batterDone is true once a plate appearance actually resolves', () => {
  const entries = [atbat(1, 'Turang', { reached: 2, pitches: ['X'] })] // a double
  const state = deriveLiveState(entries, 1)
  assert.equal(state.batter.last, 'Turang')
  assert.equal(state.batterDone, true)
})

test('batterDone is false for a mid-count stoppage — the same batter is still up', () => {
  const entries = [atbat(1, 'Yelich', { pitches: ['B'], interrupted: true })]
  const state = deriveLiveState(entries, 1)
  assert.equal(state.batter.last, 'Yelich')
  assert.equal(state.batterDone, false)
})
