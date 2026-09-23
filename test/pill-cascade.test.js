// The pill's contract, asserted from the stylesheet text and the pure class
// helper (#1131). Each of these would fail silently otherwise — lint green, the
// page rendering, only a screenshot comparison noticing:
//
//   1. THE SLOT. system/pill.css must load before 07, so every per-site pill
//      rule from 07 on still wins on order.
//   2. ONE BASE. Exactly one .pill base rule, in system/pill.css.
//   3. THE TWO HEIGHTS. A control is var(--control-min), never a literal; a tag
//      declares no height at all, so it can never be set to a control's.
//   4. NO WEIGHT. The display face ships one weight; a font-weight on the pill
//      is a no-op that implies a choice which does not exist.
//   5. THE INK. There is no tone: a caller passes a token by name, and the
//      seal, a club's bar and the marker are refused as inks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pillClassName, pillInkStyle } from '../src/lib/design/pillClass.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const STYLES = join(SRC, 'styles')

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const read = (rel) => stripComments(readFileSync(join(STYLES, rel), 'utf8'))

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

test('system/pill.css is imported before 07, so every per-site pill rule still wins on order', () => {
  const imports = [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map(
    (m) => m[1],
  )
  const pill = imports.indexOf('system/pill.css')
  const seven = imports.indexOf('07-team-logo-and-buttons.css')
  assert.ok(pill !== -1, 'index.css should import system/pill.css')
  assert.ok(pill < seven, 'pill.css must load before 07')
  const early = imports.slice(0, pill).filter((f) => /^0[1-6]/.test(f))
  assert.ok(early.length > 0, 'the 01–06b partials load before the pill, which is why a kept rule there is two-class')
})

test('there is exactly one .pill base rule, and it is in system/pill.css', () => {
  const owners = sheets(STYLES).filter((rel) => ruleBody(read(rel), '.pill') !== null)
  assert.deepEqual(owners, ['system/pill.css'])
})

test('a control is --control-min tall and a tag declares no height, so the two never meet', () => {
  const css = read('system/pill.css')
  assert.doesNotMatch(css, /(?<![0-9.])34px/, 'the control height is var(--control-min), never a literal')
  const control = ruleBody(css, '.pill--control')
  assert.equal(decl(control, 'min-height'), 'var(--control-min)')
  assert.equal(decl(control, 'padding'), '0 var(--space-3)')
  const tag = ruleBody(css, '.pill')
  assert.equal(decl(tag, 'min-height'), undefined)
  assert.equal(decl(tag, 'height'), undefined)
  assert.equal(decl(tag, 'padding'), '2px var(--space-1h)')
  assert.equal(decl(tag, 'border-radius'), 'var(--radius-pill)')
})

test('the pill names no font-weight and no dashed edge', () => {
  const css = read('system/pill.css')
  assert.doesNotMatch(css, /font-weight/, 'the display face ships one weight; emphasis is ink or fill')
  assert.doesNotMatch(css, /dashed/, 'a dashed line means pencilled-in (#1132)')
})

test('hover lives inside (hover: hover), so a tap on a phone never sticks', () => {
  const css = read('system/pill.css')
  const hovers = [...css.matchAll(/[^{}]*:hover[^{]*\{/g)].map((m) => m.index)
  assert.ok(hovers.length > 0)
  const media = css.indexOf('@media (hover: hover)')
  assert.ok(media !== -1)
  for (const at of hovers) assert.ok(at > media, 'every :hover rule sits inside the hover media query')
})

test('only .pill--seal reads the seal', () => {
  const css = read('system/pill.css')
  const reads = [...css.matchAll(/([^{}]+)\{[^}]*var\(--seal/g)].map((m) => m[1].trim())
  assert.deepEqual(reads, ['.pill--seal'])
})

test('the defaults carry no class, and a typo throws', () => {
  assert.equal(pillClassName(), 'pill')
  assert.equal(pillClassName({ role: 'control' }), 'pill pill--control')
  assert.equal(pillClassName({ fill: 'seal', role: 'control', className: 'x__due' }), 'pill pill--control pill--seal x__due')
  assert.throws(() => pillClassName({ fill: 'accent' }), /unknown fill/)
  assert.throws(() => pillClassName({ role: 'badge' }), /unknown role/)
})

test('the ink is a token by name, and the seal, a club bar and the marker are refused', () => {
  assert.equal(pillInkStyle(), undefined)
  assert.deepEqual(pillInkStyle({ ink: '--field' }), { '--pill-ink': 'var(--field)' })
  assert.deepEqual(pillInkStyle({ fill: 'paper', ink: '--clay' }), { '--pill-ink': 'var(--clay)' })
  assert.throws(() => pillInkStyle({ ink: '#2F6E4F' }), /token name/)
  assert.throws(() => pillInkStyle({ ink: 'green' }), /token name/)
  assert.throws(() => pillInkStyle({ ink: '--seal-cover' }), /ADR-0083/)
  assert.throws(() => pillInkStyle({ ink: '--bar-fill' }), /ADR-0030/)
  assert.throws(() => pillInkStyle({ ink: '--marker' }), /fill, never an ink/)
  assert.throws(() => pillInkStyle({ fill: 'ink', ink: '--field' }), /carries its own ink/)
})
