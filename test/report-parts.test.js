import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  CHIP_LAYOUTS, chipsClassName, isChipPicked, keyModel, leaderListClassName, leaderRowClassName,
  meterModel, nextChipValue, statTileClassName,
} from '../src/lib/design/report/classes.js'
import { buttonClassName } from '../src/lib/design/buttonClass.js'
import { cardClassName } from '../src/lib/design/cardClass.js'
import { pillClassName, pillInkStyle } from '../src/lib/design/pillClass.js'

// THE REPORT PARTS (ADR-0112): the pure half of the stat band and strip, the
// leader row, the meter, the key, the chip rows, plus the pill mark, the marker
// fill, the block button and the soft card tone. The CSS has its own cases at the
// bottom: no tick, and square corners on the pill and the button.

test('the band look and its lead tile name their classes; lead is band only', () => {
  assert.equal(statTileClassName(), 'stattile')
  assert.equal(statTileClassName({ look: 'band' }), 'stattile stattile--band')
  assert.equal(statTileClassName({ look: 'band', lead: true, className: 'x' }), 'stattile stattile--band stattile--lead x')
  assert.throws(() => statTileClassName({ lead: true }), /lead is for look="band"/)
  assert.throws(() => statTileClassName({ look: 'cap' }), /unknown look/)
})

test('a leader row takes lead or mine and nothing else; zebra is the list option', () => {
  assert.equal(leaderRowClassName(), 'leaderrow')
  assert.equal(leaderRowClassName({ state: 'mine' }), 'leaderrow leaderrow--mine')
  assert.throws(() => leaderRowClassName({ state: 'fav' }), /unknown state/)
  assert.equal(leaderListClassName(), 'leaders')
  assert.equal(leaderListClassName({ zebra: true }), 'leaders leaders--zebra')
})

test('the meter keeps each part as a weight and builds its own accessible name', () => {
  const m = meterModel([
    { code: 'Fresh', share: 5, tone: 'good' },
    { code: 'Ltd', share: 2, tone: 'caution' },
    { code: 'Out', share: 1, tone: 'bad', figure: 'one' },
  ])
  assert.deepEqual(m.parts.map((p) => p.share), [5, 2, 1])
  assert.equal(m.label, 'Fresh 5, Ltd 2, Out one')
  assert.equal(m.parts[0].ring, false)
})

test('the meter refuses a bad part rather than drawing a wrong bar', () => {
  assert.throws(() => meterModel([]), /at least one part/)
  assert.throws(() => meterModel([{ code: 'A', share: 0 }]), /share above zero/)
  assert.throws(() => meterModel([{ share: 1 }]), /no code/)
  assert.throws(() => meterModel([{ code: 'A', share: 1, tone: 'red' }]), /unknown tone/)
})

test('a key is swatches or marks, never a mix, and every item says what it means', () => {
  assert.equal(keyModel([{ label: 'Fresh', tone: 'good' }]).look, 'swatch')
  assert.equal(keyModel([{ label: 'Clinched', mark: 'x' }]).look, 'mark')
  assert.throws(() => keyModel([{ label: 'A', tone: 'good' }, { label: 'B', mark: 'x' }]), /one kind per key/)
  assert.throws(() => keyModel([{ label: 'A' }]), /a tone or a mark/)
  assert.throws(() => keyModel([{ label: 'A', mark: '' }]), /a tone or a mark/)
  assert.throws(() => keyModel([{ label: 'A', mark: false }]), /a tone or a mark/)
  assert.equal(keyModel([{ label: 'Out', tone: 'bad' }, { label: 'Out', tone: 'good' }]).items.length, 2, 'a repeated label is allowed')
  assert.throws(() => keyModel([{ tone: 'good' }]), /no label/)
})

test('chip layouts are rail and wrap; a full-width row is Segmented', () => {
  assert.deepEqual(CHIP_LAYOUTS, ['rail', 'wrap'])
  assert.equal(chipsClassName(), 'chips chips--rail')
  assert.equal(chipsClassName({ layout: 'wrap', className: 'f' }), 'chips chips--wrap f')
  assert.throws(() => chipsClassName({ layout: 'equal' }), /Segmented/)
})

test('one pick replaces the value; multiple toggles it in a list', () => {
  assert.equal(nextChipValue({ value: 'al', picked: 'all' }), 'al')
  assert.deepEqual(nextChipValue({ value: 'a', picked: ['b'], multiple: true }), ['b', 'a'])
  assert.deepEqual(nextChipValue({ value: 'a', picked: ['a', 'b'], multiple: true }), ['b'])
  assert.deepEqual(nextChipValue({ value: 'a', picked: undefined, multiple: true }), ['a'])
  assert.equal(isChipPicked({ value: 'a', picked: 'a' }), true)
  assert.equal(isChipPicked({ value: 'a', picked: ['a'], multiple: true }), true)
  assert.equal(isChipPicked({ value: 'a', picked: undefined, multiple: true }), false)
})

test('the pill gains a mark shape and a marker fill, and the marker carries its own ink', () => {
  assert.equal(pillClassName({ figure: true, mark: true, fill: 'marker' }), 'pill pill--marker pill--figure pill--mark')
  assert.equal(pillClassName(), 'pill')
  assert.throws(() => pillInkStyle({ fill: 'marker', ink: '--field' }), /carries its own ink/)
})

test('the block button and the soft card tone add one class each', () => {
  assert.equal(buttonClassName({ block: true }), 'btn btn--block')
  assert.equal(buttonClassName(), 'btn')
  assert.throws(() => buttonClassName({ hint: 'x' }), /hint is for block/)
  assert.equal(buttonClassName({ block: true, hint: 'x' }), 'btn btn--block')
  assert.match(cardClassName({ frame: 'stamped', tone: 'soft' }), /card--soft/)
  assert.throws(() => cardClassName({ frame: 'sheet', tone: 'soft' }), /frame="stamped"/)
})

// THE CSS HALF, read as text, the way pill-cascade.test.js reads pill.css.
const read = (rel) => readFileSync(join(process.cwd(), 'src', rel), 'utf8')
const walkFiles = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walkFiles(p, out)
    else out.push(p)
  }
  return out
}

test('no sheet or component draws the checkmark glyph (ADR-0112)', () => {
  const hits = walkFiles(join(process.cwd(), 'src'))
    .filter((f) => /\.(css|jsx|js)$/.test(f))
    .filter((f) => /[✓✔☑✅]/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(hits, [], 'the selected state is the ink fill and the marker underline')
})

test('the pill and the button are square; the selected state underlines in the marker', () => {
  const pill = read('styles/system/pill.css')
  const button = read('styles/system/button.css')
  assert.doesNotMatch(pill.replace(/\/\*[\s\S]*?\*\//g, ''), /radius-pill/)
  assert.match(button, /\.btn \{[^}]*border-radius: 0;/)
  for (const css of [pill, button]) assert.match(css, /inset 0 calc\(-1 \* var\(--space-1\)\) 0 var\(--marker\)/)
})
