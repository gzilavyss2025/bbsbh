// The low-risk batch of nested boxes becomes flat (#1775, after the 2026-11-16
// census). Each was a panel or well drawn inside a card, sheet or modal. A box
// put back would pass lint and render fine; only this test notices.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import postcss from 'postcss'

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')

function sheets(dir, prefix = '') {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return sheets(abs, `${prefix}${f}/`)
    return f.endsWith('.css') ? [`${prefix}${f}`] : []
  })
}

// Every rule (outside the design lab) whose selector ends on `cls`.
function rulesEndingIn(cls) {
  const tail = new RegExp(`\\.${cls}(?![\\w-])[^\\s>+~]*$`)
  const found = []
  for (const rel of sheets(STYLES).filter((f) => !f.startsWith('designlab/'))) {
    postcss.parse(readFileSync(join(STYLES, rel), 'utf8')).walkRules((rule) => {
      if (!rule.selectors.some((sel) => tail.test(sel.trim()))) return
      const props = rule.nodes.filter((n) => n.type === 'decl').map((d) => d.prop.toLowerCase())
      found.push({ where: `${rel}: ${rule.selector}`, props })
    })
  }
  return found
}

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
    const rules = rulesEndingIn(cls)
    assert.ok(rules.length > 0, `.${cls} should still have a rule`)
    for (const { where, props } of rules) {
      if (STANDALONE.has(where)) continue
      assert.deepEqual(props.filter((p) => BOX.has(p)), [], `${where} draws a box again`)
    }
  })
}
