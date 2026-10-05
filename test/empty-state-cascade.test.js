// The EmptyState's contract (#1132, slice E1), asserted from the stylesheet
// text, the source tree and the pure class helper, the way table-cascade.test.js
// does for the Table. Each of these would fail silently otherwise: lint green,
// the page rendering, only a screenshot noticing.
//
//   1. THE SLOT. system/empty-state.css loads right after table.css and before
//      06, so a family partial that keeps a margin wins on order.
//   2. THE LOOK. A dashed hairline inset with NO ground of its own, graphite
//      copy, two paddings, tokens only, and no margin but the reset (#1132
//      decisions Q2 and Q3).
//   3. THE HELPER. An unknown size is refused; the label, the note and the
//      action render only when given.
//   4. NO IMPORTS. An empty state may sit on a spoiler surface, so EmptyState
//      imports no api/ module and no stamp module (ADR-0035), and it has no
//      reveal prop.
//   5. THE PILOT. The club transactions page's empty line renders on
//      EmptyState, and its namespace rule keeps only a margin.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SIZES, emptyStateParts } from '../src/lib/design/emptyStateClass.js'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => stripComments(readFileSync(join(SRC, 'styles', rel), 'utf8'))
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()
const rules = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim().replace(/\s+/g, ' '), m[2]])
const props = (body) =>
  body
    .split(';')
    .map((d) => d.trim().split(':')[0].trim())
    .filter(Boolean)
const imports = () =>
  [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map((m) => m[1])

// ---- 1. the slot ----

test('system/empty-state.css is imported right after table.css and before 06', () => {
  const list = imports()
  const table = list.indexOf('system/table.css')
  const empty = list.indexOf('system/empty-state.css')
  assert.ok(empty !== -1, 'index.css should import system/empty-state.css')
  assert.equal(empty, table + 1, 'empty-state.css sits right after table.css')
  assert.equal(list.indexOf('06-loader-and-cards.css'), empty + 1, 'empty-state.css sits right before 06, so a namespace rule wins on order')
})

// ---- 2. the look ----

test('the root draws a dashed hairline inset with no ground of its own', () => {
  const root = ruleBody(read('system/empty-state.css'), '.emptystate')
  assert.equal(decl(root, 'border'), 'var(--bw-hair) dashed var(--border-rule)')
  assert.equal(decl(root, 'border-radius'), 'var(--radius-sm)')
  assert.equal(decl(root, 'color'), 'var(--text-caption)', 'graphite copy')
  assert.equal(decl(root, 'margin'), '0', 'the space around it is the parent\'s')
})

test('no rule in the file paints a ground or a shadow (decisions Q2: no fill)', () => {
  for (const [sel, body] of rules(read('system/empty-state.css'))) {
    for (const p of ['background', 'background-color', 'box-shadow']) {
      assert.equal(decl(body, p), undefined, `${sel} sets no ${p}`)
    }
  }
})

test('two sizes, each one padding from the spacing scale (decisions Q3)', () => {
  const css = read('system/empty-state.css')
  assert.equal(decl(ruleBody(css, '.emptystate--block'), 'padding'), 'var(--space-4)')
  assert.equal(decl(ruleBody(css, '.emptystate--compact'), 'padding'), 'var(--space-2) var(--space-3)')
  assert.equal(decl(ruleBody(css, '.emptystate'), 'padding'), undefined, 'the size owns the padding, not the root')
})

test('the label is the display caps face; the text and the note are the body face', () => {
  const css = read('system/empty-state.css')
  const label = ruleBody(css, '.emptystate__label')
  assert.equal(decl(label, 'font-family'), 'var(--font-display)')
  assert.equal(decl(label, 'font-size'), 'var(--fs-label)')
  for (const sel of ['.emptystate__text', '.emptystate__note']) {
    const body = ruleBody(css, sel)
    assert.equal(decl(body, 'font-family'), 'var(--font-body)', `${sel} is the body face`)
    assert.equal(decl(body, 'font-size'), 'var(--fs-small)', `${sel} is --fs-small`)
  }
  assert.equal(decl(ruleBody(css, '.emptystate__action'), 'margin-top'), 'var(--space-3)')
})

test('every rule is one class at one weight, every value a token, and only the root resets a margin', () => {
  const css = read('system/empty-state.css')
  const list = rules(css)
  assert.deepEqual(
    list.map(([sel]) => sel),
    ['.emptystate', '.emptystate--block', '.emptystate--compact', '.emptystate__label', '.emptystate__text', '.emptystate__note', '.emptystate__action'],
    'the ADR-0084 names, and nothing else',
  )
  for (const [sel, body] of list) {
    for (const d of body.split(';').map((x) => x.trim()).filter(Boolean)) {
      const value = d.slice(d.indexOf(':') + 1).trim()
      assert.match(value, /^(0|block|var\(--[\w-]+\)( var\(--[\w-]+\))*( dashed var\(--[\w-]+\))?( 0)*)$/, `${sel} { ${d} } uses tokens only`)
    }
    if (sel !== '.emptystate') {
      const margins = props(body).filter((p) => p.startsWith('margin'))
      if (sel === '.emptystate__text') assert.deepEqual(margins, ['margin'], 'the <p> resets its own margin')
      else if (sel === '.emptystate__note') assert.deepEqual(margins, ['margin'], 'the note sits one step under the text')
      else if (sel === '.emptystate__action') assert.deepEqual(margins, ['margin-top'], 'the action sits under the copy')
      else assert.deepEqual(margins, [], `${sel} sets no margin`)
    }
  }
})

// ---- 3. the helper ----

test('the helper names the root: the block, the size, then the namespace', () => {
  assert.deepEqual(SIZES, ['block', 'compact'])
  assert.equal(emptyStateParts().root, 'emptystate emptystate--block')
  assert.equal(emptyStateParts({ size: 'compact' }).root, 'emptystate emptystate--compact')
  assert.equal(emptyStateParts({ className: 'txpage__empty' }).root, 'emptystate emptystate--block txpage__empty')
})

test('an unknown size is a caller typo, and it throws', () => {
  assert.throws(() => emptyStateParts({ size: 'small' }), /unknown size "small"/)
  assert.throws(() => emptyStateParts({ size: '' }), /unknown size ""/)
})

test('the label, the note and the action render only when given', () => {
  assert.deepEqual(
    { ...emptyStateParts(), root: undefined },
    { root: undefined, label: false, note: false, action: false },
    'text only: no empty label, note or action box',
  )
  const all = emptyStateParts({ label: 'Standing vs level', note: '300 PA needed.', action: { type: 'button' } })
  assert.deepEqual([all.label, all.note, all.action], [true, true, true])
  for (const missing of [null, undefined, false, '']) {
    const p = emptyStateParts({ label: missing, note: missing, action: missing })
    assert.deepEqual([p.label, p.note, p.action], [false, false, false], `${JSON.stringify(missing)} is not given`)
  }
  assert.equal(emptyStateParts({ note: 0 }).note, true, 'a 0 is a value, not a missing note')
})

test('EmptyState renders each optional part behind the helper, and the text always', () => {
  const code = src('components/ui/state/EmptyState.jsx')
  assert.match(code, /\{parts\.label && <span className="emptystate__label">\{label\}<\/span>\}/)
  assert.match(code, /\n\s*<p className="emptystate__text">\{children\}<\/p>/, 'the text renders unconditionally')
  assert.match(code, /\{parts\.note && <p className="emptystate__note">\{note\}<\/p>\}/)
  assert.match(code, /\{parts\.action && <div className="emptystate__action">\{action\}<\/div>\}/)
  assert.match(code, /<div className=\{parts\.root\} \{\.\.\.rest\}>/, 'one <div> root carries the classes and the rest')
})

// ---- 4. no imports, no reveal ----

test('EmptyState and its helper import no api/ module and no stamp module', () => {
  for (const rel of ['components/ui/state/EmptyState.jsx', 'lib/design/emptyStateClass.js']) {
    const froms = [...src(rel).matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1])
    for (const from of froms) assert.doesNotMatch(from, /\/api\/|stamp/i, `${rel} imports ${from}`)
  }
})

test('EmptyState takes no reveal prop: a sealed value is never "empty"', () => {
  const sig = src('components/ui/state/EmptyState.jsx').match(/export function EmptyState\(\{([^}]*)\}/)
  assert.ok(sig, 'EmptyState destructures its props')
  assert.doesNotMatch(sig[1], /reveal|seal/i)
})

// ---- 5. the pilot ----

test('E1 pilot: the club transactions page renders its empty line on EmptyState', () => {
  const code = src('screens/team/TeamTransactionsPage.jsx')
  assert.match(code, /import \{ EmptyState \} from '\.\.\/\.\.\/components\/ui\/state\/EmptyState\.jsx'/)
  assert.match(code, /<EmptyState className="txpage__empty">No roster moves posted for this club yet\.<\/EmptyState>/)
  assert.doesNotMatch(code, /className="hint txpage__empty"/, 'the bare .hint is gone')
  assert.match(code, /\{days\.length === 0 \? \(/, 'the empty test stays in the caller')
})

test('E1 pilot: .txpage__empty keeps only its margin, never a second frame', () => {
  const body = ruleBody(read('72-club-transactions.css'), '.txpage__empty')
  assert.deepEqual(props(body), ['margin'])
})
