import assert from 'node:assert/strict'
import test from 'node:test'
import { MIN_CLEARANCE, tabCollisions } from '../e2e/lib/tabClearance.js'

// The geometry behind the rendered tab-clearance check. Pure: every case is a list of boxes.

const box = (id, top, bottom, extra = {}) => ({ id, x: 0, right: 400, top, bottom, shadow: 6, tabTop: null, inside: [], ...extra })

test('a tab 12px clear of the card above passes', () => {
  const boxes = [box('a', 0, 100), box('b', 118, 300, { tabTop: 118 })]
  assert.deepEqual(tabCollisions(boxes), [])
})

test('a card that ran 14px past its cell leaves its neighbour touching the tab', () => {
  // The scouting cards of #2587: the card above ends at 114, 14px past its cell, and the next
  // row's tab starts at 116, so the shadow (to 120) lies across it.
  const boxes = [box('platoon-above', 0, 114), box('platoon', 130, 300, { tabTop: 116 })]
  assert.deepEqual(tabCollisions(boxes), [{ id: 'platoon', above: 'platoon-above', gap: -4 }])
})

test('the shadow counts: a tab 4px below the border but under the shadow collides', () => {
  const boxes = [box('a', 0, 100), box('b', 118, 300, { tabTop: 104 })]
  assert.equal(tabCollisions(boxes)[0].gap, -2)
})

test('only the nearest box above is reported, once per card', () => {
  const boxes = [box('far', 0, 50), box('near', 60, 100), box('b', 130, 300, { tabTop: 104 })]
  assert.deepEqual(tabCollisions(boxes), [{ id: 'b', above: 'near', gap: -2 }])
})

test('a card with no tab is not read', () => {
  assert.deepEqual(tabCollisions([box('a', 0, 100), box('b', 101, 300)]), [])
})

test('a card inside another may stand under the parent\'s own edge', () => {
  const parent = box('parent', 0, 400)
  const child = box('child', 60, 300, { tabTop: 46, inside: ['parent'] })
  assert.deepEqual(tabCollisions([parent, child]), [])
})

test('a box in another column is not above', () => {
  const left = box('left', 0, 100, { right: 190 })
  const right = box('right', 110, 300, { x: 210, tabTop: 96 })
  assert.deepEqual(tabCollisions([left, right]), [])
})

test('a box beside the tab but starting below it is not above', () => {
  const lower = box('lower', 200, 400)
  const card = box('card', 110, 300, { tabTop: 96 })
  assert.deepEqual(tabCollisions([lower, card]), [])
})

test('the floor is 8px and can be passed in', () => {
  assert.equal(MIN_CLEARANCE, 8)
  const boxes = [box('a', 0, 100), box('b', 118, 300, { tabTop: 112 })]
  assert.equal(tabCollisions(boxes).length, 1)
  assert.equal(tabCollisions(boxes, { min: 4 }).length, 0)
})
