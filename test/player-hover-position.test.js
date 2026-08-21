import assert from 'node:assert/strict'
import test from 'node:test'
import { playerHoverCardPosition, CARD_WIDTH, VIEWPORT_MARGIN } from '../src/lib/playerHoverPosition.js'

const VIEWPORT = { width: 1280, height: 900 }

test('playerHoverCardPosition: plenty of room — sits below the trigger, nudged left', () => {
  const rect = { left: 400, top: 100, bottom: 120, right: 460 }
  const p = playerHoverCardPosition(rect, VIEWPORT)
  assert.equal(p.flipped, false)
  assert.equal(p.top, 130) // bottom (120) + the 10px trigger gap
  assert.equal(p.left, 382) // left (400) - the 18px nudge
})

test('playerHoverCardPosition: clamps to the left viewport edge, never negative', () => {
  const rect = { left: 5, top: 100, bottom: 120, right: 60 }
  const p = playerHoverCardPosition(rect, VIEWPORT)
  assert.equal(p.left, VIEWPORT_MARGIN)
})

test('playerHoverCardPosition: clamps to the right viewport edge, card never runs off-screen', () => {
  const rect = { left: 1250, top: 100, bottom: 120, right: 1270 }
  const p = playerHoverCardPosition(rect, VIEWPORT)
  assert.equal(p.left, VIEWPORT.width - CARD_WIDTH - VIEWPORT_MARGIN)
})

test('playerHoverCardPosition: no room below — flips above the trigger', () => {
  const rect = { left: 400, top: 800, bottom: 820, right: 460 }
  const p = playerHoverCardPosition(rect, VIEWPORT)
  assert.equal(p.flipped, true)
  assert.ok(p.top < rect.top, 'card sits above the trigger, not below it')
})

test('playerHoverCardPosition: no room below OR above — stays below, clamped to the top margin rather than off-screen', () => {
  const short = { width: 1280, height: 150 }
  const rect = { left: 400, top: 60, bottom: 80, right: 460 }
  const p = playerHoverCardPosition(rect, short)
  assert.equal(p.flipped, false)
  assert.ok(p.top >= VIEWPORT_MARGIN)
})
