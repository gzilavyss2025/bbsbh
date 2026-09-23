// The button's contract, asserted from the stylesheet text (#1130).
//
// Three things here would each fail without a signal. Lint stays green, the
// page still renders, and only a reader comparing screenshots would notice:
//
//   1. THE SLOT. system/button.css must load BEFORE 07-team-logo-and-buttons.
//      .btn--reveal lives in 07 at the same specificity as .btn, so if the base
//      rule ever loads after it, the base rule silently wins every declaration
//      the two share and redraws the spoiler rule's one control in the display
//      face. Tidying the @import list is exactly how that would happen.
//   2. THE REVEAL'S FACE. It used to inherit its body type from .btn. The base
//      moved to the display face, so 07 now states the face the reveal button
//      always had. Drop that pin and the reveal changes font with no warning.
//   3. THE ANATOMY'S TWO BANS. No literal 34px (the height is --control-min, and
//      a literal is how five heights came back last time) and no dashed edge (a
//      dashed line means "pencilled in", #1132).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buttonAria, buttonClassName } from '../src/lib/design/buttonClass.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const STYLES = join(SRC, 'styles')

// Comments out first: this repo's CSS carries long prose, and the button's own
// header NAMES "34px" and "dashed" in order to ban them.
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const read = (rel) => stripComments(readFileSync(join(STYLES, rel), 'utf8'))

// The declaration block of a rule whose selector is exactly `selector`.
function ruleBody(css, selector) {
  let from = 0
  for (;;) {
    const at = css.indexOf(selector, from)
    if (at === -1) return null
    from = at + selector.length
    const before = at === 0 ? '\n' : css[at - 1]
    if (!'\n;}{,'.includes(before)) continue
    let i = from
    while (css[i] === ' ' || css[i] === '\n' || css[i] === '\r') i += 1
    if (css[i] !== '{') continue
    return css.slice(i + 1, css.indexOf('}', i))
  }
}

const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

function sheets(dir, prefix = '') {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return sheets(abs, `${prefix}${f}/`)
    return f.endsWith('.css') ? [`${prefix}${f}`] : []
  })
}

test('system/button.css is imported immediately before 07, where .btn used to open', () => {
  const imports = [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map(
    (m) => m[1],
  )
  const button = imports.indexOf('system/button.css')
  const seven = imports.indexOf('07-team-logo-and-buttons.css')
  assert.ok(button !== -1, 'index.css should import system/button.css')
  assert.ok(seven !== -1, 'index.css should import 07-team-logo-and-buttons.css')
  assert.equal(
    button,
    seven - 1,
    'button.css must sit directly before 07: .btn--reveal in 07 ties .btn on specificity and wins only on order',
  )
})

test('there is exactly one .btn base rule, and it is in system/button.css', () => {
  const owners = sheets(STYLES).filter((rel) => ruleBody(read(rel), '.btn') !== null)
  assert.deepEqual(owners, ['system/button.css'])
})

test('the reveal button states the face it used to inherit from .btn', () => {
  const reveal = ruleBody(read('07-team-logo-and-buttons.css'), '.btn--reveal')
  assert.ok(reveal, '.btn--reveal should keep its rule in 07')
  assert.equal(decl(reveal, 'font-family'), 'var(--font-body)')
  assert.equal(decl(reveal, 'font-size'), 'var(--fs-body)')
  assert.equal(decl(reveal, 'letter-spacing'), 'var(--ls-none)')
  // Its hover values are its rest values, so the shared hover rule changes
  // nothing on it — the seal does not lighten to paper under a pointer.
  assert.equal(decl(reveal, '--btn-fill-hover'), decl(reveal, 'background'))
  assert.equal(decl(reveal, '--btn-edge-hover'), decl(reveal, 'border-color'))
})

test('the anatomy names no literal 34px and no dashed edge', () => {
  const css = read('system/button.css')
  assert.doesNotMatch(css, /(?<![0-9.])34px/, 'the control height is var(--control-min), never a literal')
  assert.doesNotMatch(css, /dashed/, 'a dashed line means pencilled-in (#1132); a button edge is solid')
  const control = ruleBody(css, '.btn--control')
  assert.equal(decl(control, 'min-height'), 'var(--control-min)')
  const layout = stripComments(readFileSync(join(SRC, 'tokens', 'layout.css'), 'utf8'))
  assert.match(layout, /--control-min:\s*34px;/)
})

test('hover lives inside (hover: hover), so a tap on a phone never sticks', () => {
  const css = read('system/button.css')
  const hovers = [...css.matchAll(/[^{}]*:hover[^{]*\{/g)].map((m) => m.index)
  assert.ok(hovers.length > 0, 'the button should have a hover state')
  const media = css.indexOf('@media (hover: hover)')
  assert.ok(media !== -1)
  for (const at of hovers) assert.ok(at > media, 'every :hover rule sits inside the hover media query')
})

test('the defaults carry no class, and a typo throws rather than shipping outline', () => {
  assert.equal(buttonClassName(), 'btn')
  assert.equal(buttonClassName({ size: 'control' }), 'btn btn--control')
  assert.equal(buttonClassName({ skin: 'ink', className: 'x__go' }), 'btn btn--ink x__go')
  assert.throws(() => buttonClassName({ skin: 'primary' }), /unknown skin/)
  assert.throws(() => buttonClassName({ size: 'small' }), /unknown size/)
})

test('pressed is tri-state: undefined is not a toggle, false is a toggle that is off', () => {
  assert.deepEqual(buttonAria(), {})
  assert.deepEqual(buttonAria({ pressed: false }), { 'aria-pressed': 'false' })
  assert.deepEqual(buttonAria({ pressed: true }), { 'aria-pressed': 'true' })
  assert.deepEqual(buttonAria({ busy: true }), { 'aria-busy': 'true' })
})
