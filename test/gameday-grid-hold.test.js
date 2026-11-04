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
  assert.equal(held.gridHeld, true)
  assert.equal(held.curIdx, 0, 'the rest of the panel context is kept')
})

test('once the checkpoint is open, the grid moves again', () => {
  const moves = []
  const panels = { onSelect: (i) => moves.push(i) }
  const free = holdGrid(panels, false)
  free.onSelect(3)
  assert.deepEqual(moves, [3])
  assert.ok(!free.gridHeld)
})

// The wiring (#2768): the Mount holds the grid on the close-out or focus.closing, and InningViewer hands
// it focus.closing. Dropping either brings the skipped checkpoint back with the helper test still green.
test('GamedayNextMount holds the grid on the close-out and focus.closing', async () => {
  const { readFileSync } = await import('node:fs')
  const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
  assert.match(read('src/screens/gameday/next/GamedayNextMount.jsx'), /holdGrid\([\s\S]*?,\s*held \|\| panels\.closing\)/)
  assert.match(read('src/screens/InningViewer.jsx'), /onSelect: goTo, closing: focus\.closing/)
  assert.match(read('src/screens/gameday/next/panels/GamedayPanels.jsx'), /aria-disabled=\{gridHeld \|\| undefined\}/)
})
