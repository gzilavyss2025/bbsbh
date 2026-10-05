// The grid's contract, asserted from the stylesheet text, the source tree and
// the pure class helper (#1180). Each of these would fail silently otherwise —
// lint green, the page rendering, only a screenshot noticing:
//
//   1. THE SLOT. system/grid.css loads before 06, so a block that keeps its
//      own gap or columns still wins on order. It sits ahead of the section
//      head, because the head, the card and 06 are pinned as adjacent imports.
//   2. ONE BASE, ONE CLASS. Exactly one .grid base rule, and every rule in the
//      file is a single class, so no rule outweighs a block's namespace.
//   3. THE COLUMNS. The base FILLS and --fit collapses; both cap the minimum
//      at 100% so a narrow parent never overflows, and neither fixes a count.
//   4. THE GAPS. Each gap name reads its own step.
//   5. THE HELPER. Unknown gaps and elements are refused; a bad minimum is
//      refused so nothing but a length reaches the style attribute; a list
//      gets its reset as a modifier.
//   6. NO IMPORTS. Grid may render inside a SealBox reveal, so it imports no
//      api/ module and no stamp module.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { toPosix } from '../scripts/lib/walk.mjs'
import { GAPS, GRID_TAGS, gridClassName, gridMinStyle } from '../src/lib/design/gridClass.js'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const STYLES = join(SRC, 'styles')
const gridCss = () => stripComments(readFileSync(join(STYLES, 'system/grid.css'), 'utf8'))
const TOKEN = { tight: '--space-1', snug: '--space-2', base: '--space-3', loose: '--space-4' }

function cssFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return cssFiles(abs)
    return f.endsWith('.css') ? [abs] : []
  })
}

const selectorsOf = (css) =>
  css
    .replace(/\{[^}]*\}/g, '|')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)

// ---- 1. the slot ----

test('system/grid.css is imported before 06, and does not split the head, card and 06', () => {
  const imports = [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map(
    (m) => m[1],
  )
  const head = imports.indexOf('system/section-head.css')
  const grid = imports.indexOf('system/grid.css')
  const six = imports.indexOf('06-loader-and-cards.css')
  assert.ok(grid !== -1, 'index.css should import system/grid.css')
  assert.ok(grid < head, 'grid.css should sit ahead of the section head')
  assert.ok(grid < six, 'grid.css must load before 06')
})

// ---- 2. one base, one class ----

test('.grid is a grid with one gap, and no other stylesheet draws it', () => {
  const base = ruleBody(gridCss(), '.grid')
  assert.ok(base, 'grid.css should have a .grid base rule')
  assert.match(base, /display:\s*grid/)
  assert.match(base, /gap:\s*var\(--grid-gap\)/)
  assert.match(base, /--grid-min:\s*9rem/, 'the default minimum lives on the base rule')
  for (const f of cssFiles(STYLES)) {
    if (toPosix(f).endsWith('system/grid.css')) continue
    const css = stripComments(readFileSync(f, 'utf8'))
    assert.equal(ruleBody(css, '.grid'), null, `${f} should not redraw .grid`)
  }
})

test('every selector in grid.css is a single class', () => {
  const selectors = selectorsOf(gridCss())
  assert.ok(selectors.length >= 7, 'grid.css should hold the base, --fit, four gaps and the list reset')
  for (const s of selectors) assert.match(s, /^\.grid(--[a-z]+)?$/, `"${s}" should be one grid class`)
})

// ---- 3. the columns ----

test('the base fills and --fit collapses, both capped at 100%, with no fixed count', () => {
  const css = gridCss()
  const base = ruleBody(css, '.grid')
  const fit = ruleBody(css, '.grid--fit')
  assert.match(base, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(var\(--grid-min\),\s*100%\),\s*1fr\)\)/)
  assert.match(fit, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(var\(--grid-min\),\s*100%\),\s*1fr\)\)/)
  assert.ok(css.indexOf('.grid--fit') > css.indexOf('.grid {'), '--fit must follow the base')
  assert.ok(!/repeat\(\s*\d/.test(css), 'a fixed column count is not this part')
})

// ---- 4. the gaps ----

test('each gap reads its own step', () => {
  const css = gridCss()
  assert.deepEqual(Object.keys(TOKEN), GAPS)
  for (const gap of GAPS) {
    const body = ruleBody(css, `.grid--${gap}`)
    assert.ok(body, `.grid--${gap} should exist`)
    assert.match(body, new RegExp(`--grid-gap:\\s*var\\(${TOKEN[gap]}\\)`))
  }
})

// ---- 5. the helper ----

test('the default is the snug gap on a div, filling', () => {
  assert.equal(gridClassName(), 'grid grid--snug')
})

test('gap, fit and a namespace each name their own class', () => {
  for (const gap of GAPS) assert.equal(gridClassName({ gap }), `grid grid--${gap}`)
  assert.equal(gridClassName({ gap: 'base', fit: true, className: 'rehabgrid' }), 'grid grid--base grid--fit rehabgrid')
})

test('an unknown gap or element is refused', () => {
  assert.throws(() => gridClassName({ gap: 'section' }), /unknown gap "section"/)
  assert.throws(() => gridClassName({ gap: '8' }), /unknown gap/)
  assert.throws(() => gridClassName({ as: 'span' }), /unknown element "span"/)
})

test('a list gets the reset modifier and nothing else does', () => {
  for (const as of GRID_TAGS) {
    assert.equal(gridClassName({ as }).includes('grid--list'), as === 'ul' || as === 'ol', as)
  }
})

test('min is a length: a number is px, a token passes, anything else is refused', () => {
  assert.deepEqual(gridMinStyle(), {}, 'left out, the .grid rule supplies the default')
  assert.deepEqual(gridMinStyle(150), { '--grid-min': '150px' })
  assert.deepEqual(gridMinStyle('8.5rem'), { '--grid-min': '8.5rem' })
  assert.deepEqual(gridMinStyle('var(--shot-sm-w)'), { '--grid-min': 'var(--shot-sm-w)' })
  for (const bad of [0, -10, NaN, '', '10', 'auto', '10px; color: red', '10px}', 'calc(1px)', null, {}]) {
    assert.throws(() => gridMinStyle(bad), /min must be a length/, JSON.stringify(bad))
  }
})

// ---- 6. no imports ----

test('Grid and its helper import no api/ or stamp module', () => {
  for (const rel of ['components/ui/layout/Grid.jsx', 'lib/design/gridClass.js']) {
    const text = readFileSync(join(SRC, rel), 'utf8')
    const imports = [...text.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
    for (const spec of imports) {
      assert.ok(!/\/api\//.test(spec), `${rel} imports ${spec}`)
      assert.ok(!/stamp/i.test(spec), `${rel} imports ${spec}`)
    }
  }
})
