// The lens's page turn as a pure step (#724, src/lib/scorecard/turn.js):
// useLensMotion runs the turn through turnStep. The case that matters is the
// reader who leaves the lens in the middle of a turn ([Sheet], or the phone
// turned on its side): the side switch the Turn tap asked for must still run,
// or the sheet stays on the old club's page.
import assert from 'node:assert/strict'
import test from 'node:test'
import { TURN_IDLE, turnStep } from '../src/lib/scorecard/turn.js'

const flips = () => {
  const calls = []
  return { calls, fn: () => calls.push('flip') }
}

test('a turn runs out, switches the side at the end of the out beat, then runs in', () => {
  const { calls, fn } = flips()
  let s = turnStep(TURN_IDLE, { type: 'start', fn })
  assert.equal(s.turning, 'out')
  assert.equal(s.run, null)
  s = turnStep(s, { type: 'end', name: 'sc-lens-turn-out' })
  assert.equal(s.turning, 'in')
  s.run?.()
  assert.deepEqual(calls, ['flip'])
  s = turnStep(s, { type: 'end', name: 'sc-lens-turn-in' })
  assert.deepEqual({ turning: s.turning, pending: s.pending, run: s.run }, { turning: null, pending: null, run: null })
})

test('leaving the lens in the middle of the out beat still switches the side, once', () => {
  const { calls, fn } = flips()
  let s = turnStep(TURN_IDLE, { type: 'start', fn })
  s = turnStep(s, { type: 'leave' })
  assert.equal(s.turning, null)
  assert.equal(s.pending, null, 'no stale switch is left behind')
  s.run?.()
  assert.deepEqual(calls, ['flip'])
  // A late animationend from the removed class does nothing more.
  s = turnStep(s, { type: 'end', name: 'sc-lens-turn-out' })
  s.run?.()
  assert.deepEqual(calls, ['flip'])
})

test('leaving the lens with no turn under way runs nothing', () => {
  const s = turnStep(TURN_IDLE, { type: 'leave' })
  assert.equal(s.turning, null)
  assert.equal(s.run, null)
})

test('an unrelated animation ending changes nothing', () => {
  const { fn } = flips()
  const out = turnStep(TURN_IDLE, { type: 'start', fn })
  const s = turnStep(out, { type: 'end', name: 'sc-lens-breath' })
  assert.equal(s.turning, 'out')
  assert.equal(s.pending, fn)
  assert.equal(s.run, null)
})
