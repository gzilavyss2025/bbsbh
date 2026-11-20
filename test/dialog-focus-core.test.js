// Unit coverage for the React-free core of useDialogFocus
// (src/hooks/dialog/dialogFocusCore.js). There is no DOM in this suite, so
// `window`, `document` and `HTMLElement` are the smallest stubs the core reads.
import assert from 'node:assert/strict'
import test from 'node:test'
import { bindEscape, focusIn } from '../src/hooks/dialog/dialogFocusCore.js'

class FakeElement {
  constructor(doc) {
    this.doc = doc
  }
  focus() {
    this.doc.activeElement = this
  }
}

function setup() {
  const doc = { activeElement: null }
  globalThis.window = new EventTarget()
  globalThis.document = doc
  globalThis.HTMLElement = FakeElement
  return doc
}

function press(key) {
  const e = new Event('keydown')
  e.key = key
  globalThis.window.dispatchEvent(e)
}

test('bindEscape calls onClose on Escape only, and stops after cleanup', () => {
  setup()
  let closed = 0
  const off = bindEscape(() => closed++)
  press('a')
  press('Enter')
  assert.equal(closed, 0)
  press('Escape')
  assert.equal(closed, 1)
  off()
  press('Escape')
  assert.equal(closed, 1)
})

test('with sheets stacked, Escape closes only the topmost one', () => {
  const doc = setup()
  // Two portalled dialogs: the roster sheet, then a player sheet opened over it.
  const roster = { id: 'roster' }, player = { id: 'player' }
  doc.querySelectorAll = () => [roster, player]
  const inside = (dialog) => ({ closest: () => dialog })
  let rosterClosed = 0, playerClosed = 0
  const offRoster = bindEscape(() => rosterClosed++, () => inside(roster))
  const offPlayer = bindEscape(() => playerClosed++, () => inside(player))
  press('Escape')
  assert.deepEqual([rosterClosed, playerClosed], [0, 1])
  // The player sheet is gone; the next Escape closes the roster sheet.
  offPlayer()
  doc.querySelectorAll = () => [roster]
  press('Escape')
  assert.deepEqual([rosterClosed, playerClosed], [1, 1])
  offRoster()
  // A dialog whose element is not on the page (a sheet that handed its place to another) does nothing.
  let ghost = 0
  const offGhost = bindEscape(() => ghost++, () => null)
  press('Escape')
  assert.equal(ghost, 0)
  offGhost()
})

test('focusIn focuses the dialog element and cleanup returns focus to the trigger', () => {
  const doc = setup()
  const trigger = new FakeElement(doc)
  const closeBtn = new FakeElement(doc)
  trigger.focus()
  const restore = focusIn(closeBtn)
  assert.equal(doc.activeElement, closeBtn)
  restore()
  assert.equal(doc.activeElement, trigger)
})

test('focusIn with no element, or a non-element trigger, does not throw', () => {
  const doc = setup()
  doc.activeElement = null // nothing focused
  const restore = focusIn(null)
  assert.doesNotThrow(restore)
  assert.equal(doc.activeElement, null)
})
