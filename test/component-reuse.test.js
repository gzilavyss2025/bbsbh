import test from 'node:test'
import assert from 'node:assert/strict'
import { scanSheet } from '../scripts/check-component-reuse.mjs'

// The pure half of scripts/check-component-reuse.mjs (#1114). The guard counts
// SHAPES, so each case writes a rule with a name that says nothing about its
// shape, and asserts the guard still finds it.
const kinds = (css, rel = 'src/styles/x.css') => {
  const r = scanSheet(rel, css)
  return {
    found: Object.fromEntries(Object.entries(r.hits).map(([k, v]) => [k, v.length])),
    bare: r.bare,
  }
}

const PILL = '.rankchip { border-radius: var(--radius-pill); font-size: 11px; }'
const SHEET = `.roster { border: var(--bw-hair) solid var(--border-rule); border-radius: var(--radius-md);
  background: var(--surface-card); box-shadow: var(--shadow-card); }`
const LEDGER = `.rows { border: var(--bw-hair) solid var(--border-rule); border-radius: var(--radius-sm);
  background: var(--surface-card); }`
const BAND = '.thing__head { background: var(--bar-fill); color: var(--bar-text); }'

test('a capsule, sheet, ledger and band are found whatever the class is called', () => {
  assert.deepEqual(kinds(PILL).found, { capsule: 1, sheet: 0, ledger: 0, band: 0 })
  assert.deepEqual(kinds(SHEET).found, { capsule: 0, sheet: 1, ledger: 0, band: 0 })
  assert.deepEqual(kinds(LEDGER).found, { capsule: 0, sheet: 0, ledger: 1, band: 0 })
  assert.deepEqual(kinds(BAND).found, { capsule: 0, sheet: 0, ledger: 0, band: 1 })
})

test('a pill radius with no own font-size is a layout detail, not a capsule', () => {
  assert.equal(kinds('.dot { border-radius: var(--radius-pill); }').found.capsule, 0)
})

test('a ledger has no shadow: the same recipe with one is a sheet or nothing', () => {
  const css = LEDGER.replace('background:', 'box-shadow: var(--shadow-card); background:')
  assert.equal(kinds(css).found.ledger, 0)
})

test('a rule inside @media is found, and a comment is not', () => {
  assert.equal(kinds(`@media (min-width: 740px) { ${PILL} }`).found.capsule, 1)
  assert.equal(kinds(`/* ${PILL} */`).found.capsule, 0)
})

test('the canonical sheets under system/ are not counted', () => {
  assert.equal(kinds(PILL, 'src/styles/system/pill.css').found.capsule, 0)
})

test('an exempt marker with a reason passes; one with no reason is reported', () => {
  const ok = kinds(PILL.replace('}', '/* component-reuse-exempt: stamp art (ADR-0035) */ }'))
  assert.equal(ok.found.capsule, 0)
  assert.deepEqual(ok.bare, [])
  const bare = kinds(PILL.replace('}', '/* component-reuse-exempt */ }'))
  assert.equal(bare.found.capsule, 1)
  assert.equal(bare.bare.length, 1)
})

test('the hit names the file and line of the selector', () => {
  const r = scanSheet('src/styles/x.css', `\n\n${PILL}`)
  assert.equal(r.hits.capsule[0], 'src/styles/x.css:3 .rankchip')
})

// Triage (.scratch/design-system/component-reuse-triage.md): a card-shape guard
// must not count a form control or a button. The ledger recipe (hairline border,
// small radius, card fill) is also the recipe of every input, select and tappable
// tile, so those are Button/input work, not card shells.
test('a rule whose selector is an input, select, textarea or button is a control, not a shape', () => {
  const body = LEDGER.replace('.rows', '')
  for (const sel of ['input.x', '.x select', '.x textarea', '.x button', '.a__input', '.a__seasonselect', '.a__stepbtn', '.a .a__btn--save', '.a__select']) {
    assert.equal(kinds(`${sel}${body}`).found.ledger, 0, sel)
  }
  assert.equal(kinds(PILL.replace('.rankchip', '.pcard__infobtn span')).found.capsule, 0)
  assert.equal(kinds(BAND.replace('.thing__head', '.bpadmin__btn--save')).found.band, 0)
})

test('a name that merely contains a control word is still counted', () => {
  // `button` and `input` only count as a whole element or a `__` suffix.
  assert.equal(kinds(LEDGER.replace('.rows', '.buttonbar')).found.ledger, 1)
  assert.equal(kinds(LEDGER.replace('.rows', '.inputs__list')).found.ledger, 1)
  assert.equal(kinds(LEDGER.replace('.rows', '.selection')).found.ledger, 1)
})

test('a tappable rule (cursor: pointer) or a resizable one is a control, not a card', () => {
  assert.equal(kinds(LEDGER.replace('}', 'cursor: pointer; }')).found.ledger, 0)
  assert.equal(kinds(LEDGER.replace('}', 'resize: vertical; }')).found.ledger, 0)
  assert.equal(kinds(PILL.replace('}', 'cursor: pointer; }')).found.capsule, 0)
})

test('cursor: default, or a comment that names cursor: pointer, does not make a control', () => {
  assert.equal(kinds(LEDGER.replace('}', 'cursor: default; }')).found.ledger, 1)
  assert.equal(kinds(LEDGER.replace('}', '/* cursor: pointer */ }')).found.ledger, 1)
})
