// The cluster's contract, asserted from the stylesheet text, the source tree
// and the pure class helper (#1180). Each of these would fail silently
// otherwise — lint green, the page rendering, only a screenshot noticing:
//
//   1. THE SLOT. system/cluster.css loads before 06, so a block that keeps its
//      own gap, alignment or justification still wins on order. It sits ahead
//      of the section head, because the head, the card and 06 are pinned as
//      adjacent imports.
//   2. ONE BASE, ONE CLASS. Exactly one .cluster base rule, and every rule in
//      the file is a single class, so no rule outweighs a block's namespace.
//   3. THE GAPS. Each gap name reads its own token. A row modifier sets
//      row-gap and comes after the base, and never a custom property, which
//      would inherit into a nested cluster.
//   4. THE HELPER. Unknown gaps, row gaps, alignments and elements are refused,
//      not drawn as something else; a list gets its reset as a modifier.
//   5. NO IMPORTS. Cluster may render inside a SealBox reveal, so it imports no
//      api/ module and no stamp module.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { toPosix } from '../scripts/lib/walk.mjs'
import { ALIGNS, CLUSTER_TAGS, GAPS, clusterClassName } from '../src/lib/design/clusterClass.js'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const STYLES = join(SRC, 'styles')
const clusterCss = () => stripComments(readFileSync(join(STYLES, 'system/cluster.css'), 'utf8'))
const TOKEN = { tight: '--space-1', snug: '--space-2', base: '--space-3' }

function cssFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return cssFiles(abs)
    return f.endsWith('.css') ? [abs] : []
  })
}

// ---- 1. the slot ----

test('system/cluster.css is imported before 06, and does not split the head, card and 06', () => {
  const imports = [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map(
    (m) => m[1],
  )
  const head = imports.indexOf('system/section-head.css')
  const cluster = imports.indexOf('system/cluster.css')
  const six = imports.indexOf('06-loader-and-cards.css')
  assert.ok(cluster !== -1, 'index.css should import system/cluster.css')
  assert.ok(cluster < head, 'cluster.css should sit ahead of the section head')
  assert.ok(cluster < six, 'cluster.css must load before 06')
})

// ---- 2. one base, one class ----

test('.cluster is a wrapping row with one gap, and no other stylesheet draws it', () => {
  const base = ruleBody(clusterCss(), '.cluster')
  assert.ok(base, 'cluster.css should have a .cluster base rule')
  assert.match(base, /display:\s*flex/)
  assert.match(base, /flex-wrap:\s*wrap/)
  assert.match(base, /gap:\s*var\(--cluster-gap\)/)
  for (const f of cssFiles(STYLES)) {
    if (toPosix(f).endsWith('system/cluster.css')) continue
    const css = stripComments(readFileSync(f, 'utf8'))
    assert.equal(ruleBody(css, '.cluster'), null, `${f} should not redraw .cluster`)
  }
})

test('every selector in cluster.css is a single class', () => {
  const selectors = selectorsOf(clusterCss())
  assert.ok(selectors.length >= 11, 'cluster.css should hold the base, gaps, row gaps, alignments and the list reset')
  for (const s of selectors) assert.match(s, /^\.cluster(--[a-z]+(-[a-z]+)?)?$/, `"${s}" should be one cluster class`)
})

function selectorsOf(css) {
  return css
    .replace(/\{[^}]*\}/g, '|')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

// ---- 3. the gaps ----

test('each gap reads its own step', () => {
  const css = clusterCss()
  assert.deepEqual(Object.keys(TOKEN), GAPS)
  for (const gap of GAPS) {
    const body = ruleBody(css, `.cluster--${gap}`)
    assert.ok(body, `.cluster--${gap} should exist`)
    assert.match(body, new RegExp(`--cluster-gap:\\s*var\\(${TOKEN[gap]}\\)`))
  }
})

test('a row gap sets row-gap after the base, and no custom property', () => {
  const css = clusterCss()
  for (const gap of GAPS) {
    const body = ruleBody(css, `.cluster--row-${gap}`)
    assert.ok(body, `.cluster--row-${gap} should exist`)
    assert.match(body, new RegExp(`row-gap:\\s*var\\(${TOKEN[gap]}\\)`))
    assert.ok(css.indexOf(`.cluster--row-${gap}`) > css.indexOf('.cluster {'), 'a row gap must follow the base')
  }
  assert.ok(!/--cluster-row/.test(css), 'a row gap as a custom property would inherit into a nested cluster')
})

test('each alignment sets align-items', () => {
  const css = clusterCss()
  const expected = { start: 'flex-start', center: 'center', baseline: 'baseline' }
  assert.deepEqual(Object.keys(expected), ALIGNS)
  for (const align of ALIGNS) {
    assert.match(ruleBody(css, `.cluster--align-${align}`), new RegExp(`align-items:\\s*${expected[align]}`))
  }
})

// ---- 4. the helper ----

test('the default is the snug gap on a div, with no row gap and no alignment', () => {
  assert.equal(clusterClassName(), 'cluster cluster--snug')
})

test('gap, row gap and alignment each name their own class, and a namespace follows', () => {
  for (const gap of GAPS) assert.equal(clusterClassName({ gap }), `cluster cluster--${gap}`)
  assert.equal(
    clusterClassName({ gap: 'base', rowGap: 'tight', align: 'center', className: 'chal' }),
    'cluster cluster--base cluster--row-tight cluster--align-center chal',
  )
})

test('an unknown gap, row gap, alignment or element is refused', () => {
  assert.throws(() => clusterClassName({ gap: 'loose' }), /unknown gap "loose"/)
  assert.throws(() => clusterClassName({ gap: '8' }), /unknown gap/)
  assert.throws(() => clusterClassName({ rowGap: 'section' }), /unknown rowGap "section"/)
  assert.throws(() => clusterClassName({ align: 'end' }), /unknown align "end"/)
  assert.throws(() => clusterClassName({ as: 'p' }), /unknown element "p"/)
})

test('a list gets the reset modifier and nothing else does', () => {
  for (const as of CLUSTER_TAGS) {
    assert.equal(clusterClassName({ as }).includes('cluster--list'), as === 'ul' || as === 'ol', as)
  }
})

// ---- 5. no imports ----

test('Cluster and its helper import no api/ or stamp module', () => {
  for (const rel of ['components/ui/layout/Cluster.jsx', 'lib/design/clusterClass.js']) {
    const text = readFileSync(join(SRC, rel), 'utf8')
    const imports = [...text.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
    for (const spec of imports) {
      assert.ok(!/\/api\//.test(spec), `${rel} imports ${spec}`)
      assert.ok(!/stamp/i.test(spec), `${rel} imports ${spec}`)
    }
  }
})
