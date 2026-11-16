// The low-risk batch of nested boxes becomes flat (#1775, after the 2026-11-16
// census). Each was a panel or well drawn inside a card, sheet or modal. A box
// put back would pass lint and render fine; only this test notices.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { rulesEndingIn } from './helpers/css.js'

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')

const BOX = new Set(['background', 'background-color', 'border', 'border-radius', 'box-shadow'])

// Not nested: on /tensest the club strip sits on the page as its own stamped card.
const STANDALONE = new Set(['report/tensest.css: .tensest__picker .vsteam__tray'])

const FLAT = [
  'logomodal__variants',
  'bookmgmt__confirm',
  'trrank__boardcontrols',
  'trrank__related',
  'vsteam__tray',
  'horizontile__statbox',
  'psseries__lrows',
  'psseries__rosterlist',
]

for (const cls of FLAT) {
  test(`.${cls} sits flat in its card, with no box of its own`, () => {
    const rules = rulesEndingIn(STYLES, cls)
    assert.ok(rules.length > 0, `.${cls} should still have a rule`)
    for (const { where, props } of rules) {
      if (STANDALONE.has(where)) continue
      assert.deepEqual(props.filter((p) => BOX.has(p)), [], `${where} draws a box again`)
    }
  })
}

// The stat cell (#1775's last case). It keeps its paper fill, because the
// 1px-gap grids it sits in draw their rules with the background behind it, but
// never a frame of its own. `.statline`, the old StatBox grid, renders nowhere.
test('.stat is a flat cell, with no frame of its own anywhere', () => {
  const FRAME = new Set(['border', 'border-radius', 'box-shadow'])
  const rules = rulesEndingIn(STYLES, 'stat')
  assert.ok(rules.length > 0, '.stat should still have a rule')
  for (const { where, props } of rules) {
    assert.deepEqual(props.filter((p) => FRAME.has(p)), [], `${where} sets a frame`)
  }
})

test('the dead .statline grid is gone', () => {
  assert.deepEqual(rulesEndingIn(STYLES, 'statline'), [])
})
