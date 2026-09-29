// The icon-only button's contract (#1209), asserted from the class helper and
// the stylesheet text.
//
// Gary's design call: a round VISIBLE mark (18 to 32px, as each one always was)
// with a 44x44 TAP area, always, including the 18px (i). The tap area is an
// ::after, so a small mark cannot silently become a small target: this is the
// test that fails if someone tidies the ::after away or writes a literal size.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { MARKS, iconButtonClassName } from '../src/lib/design/buttonClass.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const button = strip(readFileSync(join(SRC, 'styles/system/button.css'), 'utf8'))
const layout = strip(readFileSync(join(SRC, 'tokens/layout.css'), 'utf8'))

function body(css, selector) {
  const at = css.indexOf(`\n${selector} {`)
  assert.ok(at !== -1, `${selector} should be a rule in system/button.css`)
  return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
}

test('the default icon button is a ghost at the full tap mark', () => {
  assert.equal(iconButtonClassName(), 'btn btn--ghost btn--icon')
})

test('a smaller mark adds a class; the tap default does not', () => {
  assert.equal(iconButtonClassName({ mark: 'md' }), 'btn btn--ghost btn--icon btn--mark-md')
  assert.equal(iconButtonClassName({ mark: 'sm', skin: 'outline' }), 'btn btn--icon btn--mark-sm')
  assert.deepEqual(MARKS, ['tap', 'md', 'sm'])
})

test('a host class rides last, and a typo in mark or skin throws', () => {
  assert.ok(iconButtonClassName({ className: 'x' }).endsWith(' x'))
  assert.throws(() => iconButtonClassName({ mark: 'lg' }), /unknown mark/)
  assert.throws(() => iconButtonClassName({ skin: 'loud' }), /unknown skin/)
})

test('the tap area is always --tap-min: a centred ::after, not the mark', () => {
  const after = body(button, '.btn--icon::after')
  assert.match(after, /width:\s*var\(--tap-min\)/)
  assert.match(after, /height:\s*var\(--tap-min\)/)
  assert.match(after, /position:\s*absolute/)
  assert.match(body(button, '.btn--icon'), /position:\s*relative/)
})

test('the mark is a circle sized by --icon-mark, with tokens for both small marks', () => {
  const icon = body(button, '.btn--icon')
  assert.match(icon, /width:\s*var\(--icon-mark\)/)
  assert.match(icon, /height:\s*var\(--icon-mark\)/)
  assert.match(icon, /border-radius:\s*var\(--radius-pill\)/)
  assert.match(body(button, '.btn--mark-md'), /--icon-mark:\s*var\(--mark-md\)/)
  assert.match(body(button, '.btn--mark-sm'), /--icon-mark:\s*var\(--mark-sm\)/)
  assert.match(layout, /--mark-md:\s*32px/)
  assert.match(layout, /--mark-sm:\s*18px/)
})

test('the icon rule loads before the skins, so a skin still owns its ink', () => {
  assert.ok(button.indexOf('.btn--icon {') < button.indexOf('.btn--ink {'))
})
