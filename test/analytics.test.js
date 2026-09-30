// Unit coverage for toggle-consent analytics (Task B / ADR-0028). The one
// property that matters: the event payload can carry ONLY the three coarse,
// enumerated props — never a gamePk, score, inning, or reveal mark. If this
// allowlist ever loosens, anonymous chrome telemetry could become score-leaking.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TOGGLES,
  ACTIONS,
  SURFACES,
  buildToggleEventProps,
} from '../src/lib/analytics.js'

test('buildToggleEventProps keeps a well-formed event to exactly the three props', () => {
  const out = buildToggleEventProps({
    toggle: TOGGLES.SCORES_UNLOCKED,
    action: ACTIONS.CONFIRM,
    surface: SURFACES.SLATE,
  })
  assert.deepEqual(out, { toggle: 'scores_unlocked', action: 'confirm', surface: 'slate' })
  assert.deepEqual(Object.keys(out).sort(), ['action', 'surface', 'toggle'])
})

test('buildToggleEventProps STRIPS any game-identifying / score key', () => {
  const out = buildToggleEventProps({
    toggle: TOGGLES.SCORES_UNLOCKED,
    action: ACTIONS.DISMISS,
    surface: SURFACES.SLATE,
    // Everything below must never reach telemetry:
    gamePk: 823035,
    score: '4-2',
    awayScore: 4,
    homeScore: 2,
    inning: 7,
    revealedThrough: 13,
  })
  assert.deepEqual(out, { toggle: 'scores_unlocked', action: 'dismiss', surface: 'slate' })
  for (const forbidden of ['gamePk', 'score', 'awayScore', 'homeScore', 'inning', 'revealedThrough']) {
    assert.ok(!(forbidden in out), `${forbidden} must not survive`)
  }
})

// The allowlist is the key set buildToggleEventProps returns. Feed each
// game-identifying key alongside a valid event: none may pass through.
test('the allowlist itself excludes every game-identifying key', () => {
  const valid = { toggle: TOGGLES.SCORES_UNLOCKED, action: ACTIONS.CONFIRM, surface: SURFACES.SLATE }
  for (const forbidden of ['gamePk', 'score', 'awayScore', 'homeScore', 'inning', 'revealedThrough', 'expiry']) {
    const out = buildToggleEventProps({ ...valid, [forbidden]: 1 })
    assert.ok(!(forbidden in out), `${forbidden} not allowlisted`)
    assert.deepEqual(Object.keys(out).sort(), ['action', 'surface', 'toggle'])
  }
})

test('buildToggleEventProps rejects an unknown enum value (returns null)', () => {
  assert.equal(buildToggleEventProps({ toggle: 'everything', action: ACTIONS.CONFIRM, surface: SURFACES.SLATE }), null)
  assert.equal(buildToggleEventProps({ toggle: TOGGLES.SCORES_UNLOCKED, action: 'nuke', surface: SURFACES.SLATE }), null)
  assert.equal(buildToggleEventProps({ toggle: TOGGLES.SCORES_UNLOCKED, action: ACTIONS.CONFIRM, surface: 'billboard' }), null)
})

test('buildToggleEventProps rejects a missing field or non-object', () => {
  assert.equal(buildToggleEventProps({ action: ACTIONS.CONFIRM, surface: SURFACES.SLATE }), null)
  assert.equal(buildToggleEventProps(null), null)
  assert.equal(buildToggleEventProps(undefined), null)
  assert.equal(buildToggleEventProps('confirm'), null)
})
