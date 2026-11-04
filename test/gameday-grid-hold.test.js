import { test } from 'node:test'
import assert from 'node:assert/strict'
import { holdGrid } from '../src/screens/gameday/next/steps/subStep.js'

// #2768: the line-score grid waits like the advance does. Until "Middle 1st ›" opens the
// checkpoint (or while the half's rule inks in), a tapped inning moves nothing, forward or back.
test('a grid tap during the close-out moves nothing, and marks the cells aria-disabled', () => {
  const moves = []
  const panels = { curIdx: 0, onSelect: (i) => moves.push(i) }
  const held = holdGrid(panels, true)
  held.onSelect(1)
  held.onSelect(0)
  assert.deepEqual(moves, [], 'neither a forward nor a back tap moves')
  assert.equal(held.disabled, true)
  assert.equal(held.curIdx, 0, 'the rest of the panel context is kept')
})

test('once the checkpoint is open, the grid moves again', () => {
  const moves = []
  const panels = { onSelect: (i) => moves.push(i) }
  const free = holdGrid(panels, false)
  free.onSelect(3)
  assert.deepEqual(moves, [3])
  assert.ok(!free.disabled)
})
