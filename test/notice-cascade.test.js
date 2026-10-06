// The Notice's contract (#1132, slice N1), asserted from the stylesheet text, the
// source tree and the pure class helper, the way empty-state-cascade.test.js does
// for the EmptyState. Each of these would fail silently otherwise: lint green,
// the page rendering, only a screenshot noticing.
//
//   1. THE SLOT. system/notice.css loads right after empty-state.css and before
//      06, so a family partial that keeps a margin wins on order.
//   2. THE LOOK. The wash (decisions Q1): a thin SOLID edge all round and a pale
//      tint, the same for every tone. Four tones, tokens only, no margin but the
//      reset, no shadow, no dashed edge, no rail, and no --seal (ADR-0083).
//   3. THE HELPER. An unknown tone or size is refused; the label, the icon and the
//      action render only when given; the error tone defaults to role="alert".
//   4. NO IMPORTS. A notice may sit on a spoiler surface, so Notice imports no
//      api/ module and no stamp module (ADR-0035), and it has no reveal prop.
//   5. THE PILOT. The poster studio's overflow line renders on Notice.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { SIZES, TONES, noticeClass, noticeParts } from '../src/lib/design/noticeClass.js'
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
const decls = (body) =>
  body
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
const props = (body) => decls(body).map((d) => d.split(':')[0].trim())
const imports = () =>
  [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map((m) => m[1])

const CSS = 'system/notice.css'

// ---- 1. the slot ----

test('system/notice.css is imported right after empty-state.css and before 06', () => {
  const list = imports()
  const empty = list.indexOf('system/empty-state.css')
  const notice = list.indexOf('system/notice.css')
  assert.ok(notice !== -1, 'index.css should import system/notice.css')
  assert.equal(notice, empty + 1, 'notice.css sits right after empty-state.css')
  assert.equal(list.indexOf('06-loader-and-cards.css'), notice + 1, 'notice.css sits right before 06, so a namespace rule wins on order')
})

// ---- 2. the look ----

test('the root draws a thin solid edge all round, a wash and the tone ink, with no margin', () => {
  const root = ruleBody(read(CSS), '.notice')
  assert.equal(decl(root, 'border'), 'var(--bw-hair) solid var(--notice-edge)')
  assert.equal(decl(root, 'border-radius'), 'var(--radius-sm)')
  assert.equal(decl(root, 'background'), 'var(--notice-wash)')
  assert.equal(decl(root, 'color'), 'var(--notice-ink)')
  assert.equal(decl(root, 'margin'), '0', 'the space around it is the parent\'s')
})

test('the only ground in the file is the root\'s, and it comes from a tone', () => {
  for (const [sel, body] of rules(read(CSS))) {
    assert.equal(decl(body, 'box-shadow'), undefined, `${sel} paints no shadow`)
    assert.equal(decl(body, 'background-color'), undefined, `${sel} sets no background-color`)
    if (sel !== '.notice') assert.equal(decl(body, 'background'), undefined, `${sel} paints no ground of its own`)
  }
})

test('no rail and no dashed edge: the edge is one solid hairline (decisions Q1)', () => {
  const css = read(CSS)
  assert.doesNotMatch(css, /dashed|dotted/, 'a namespace may keep a dashed edge; Notice never owns one')
  for (const [sel, body] of rules(css)) {
    for (const p of props(body)) assert.doesNotMatch(p, /^border-(left|right|top|bottom|inline|block)/, `${sel} draws no one-sided edge`)
  }
})

test('the file names no --seal token (ADR-0083) and no club property (ADR-0030)', () => {
  const css = read(CSS)
  assert.doesNotMatch(css, /--seal/, 'kraft amber means sealed, and nothing else')
  assert.doesNotMatch(css, /--bar-accent|--club|--team/, 'a Notice wears no club colour')
})

test('four tones, each setting the edge and the wash; only error changes the ink', () => {
  const css = read(CSS)
  const want = {
    info: { edge: 'var(--border-hairline)', wash: 'color-mix(in srgb, var(--navy) 7%, var(--surface-card))' },
    event: { edge: undefined, wash: 'color-mix(in srgb, var(--marker) 16%, var(--surface-card))' },
    caution: { edge: 'var(--clay)', wash: 'var(--clay-soft)' },
    error: { edge: 'var(--clay)', wash: 'var(--clay-soft)' },
  }
  assert.deepEqual(Object.keys(want), TONES)
  for (const tone of TONES) {
    const body = ruleBody(css, `.notice--${tone}`)
    assert.ok(body, `.notice--${tone} exists`)
    assert.equal(decl(body, '--notice-edge'), want[tone].edge, `${tone} edge`)
    assert.equal(decl(body, '--notice-wash'), want[tone].wash, `${tone} wash`)
    assert.equal(decl(body, '--notice-ink'), tone === 'error' ? 'var(--clay-deep)' : undefined, `${tone} ink`)
  }
  assert.equal(decl(ruleBody(css, '.notice--caution'), '--notice-label'), 'var(--clay-deep)', 'the caution label is clay-deep over body ink')
})

test('error ink is --clay-deep: --clay on --clay-soft is 4.28:1 and fails AA (spec 14)', () => {
  assert.doesNotMatch(ruleBody(read(CSS), '.notice--error'), /--notice-ink:\s*var\(--clay\)/)
})

test('two sizes, each one padding from the spacing scale', () => {
  const css = read(CSS)
  assert.equal(decl(ruleBody(css, '.notice--block'), 'padding'), 'var(--space-2h) var(--space-3)')
  assert.equal(decl(ruleBody(css, '.notice--compact'), 'padding'), 'var(--space-1h) var(--space-2h)')
  assert.equal(decl(ruleBody(css, '.notice'), 'padding'), undefined, 'the size owns the padding, not the root')
})

test('the label is the display caps face; the text is the body face', () => {
  const css = read(CSS)
  const label = ruleBody(css, '.notice__label')
  assert.equal(decl(label, 'font-family'), 'var(--font-display)')
  assert.equal(decl(label, 'font-size'), 'var(--fs-label)')
  assert.equal(decl(label, 'color'), 'var(--notice-label)')
  const text = ruleBody(css, '.notice__text')
  assert.equal(decl(text, 'font-family'), 'var(--font-body)')
  assert.equal(decl(text, 'font-size'), 'var(--fs-small)')
})

test('every rule is one class at one weight, every value a token, and only the root and the text reset a margin', () => {
  const list = rules(read(CSS))
  assert.deepEqual(
    list.map(([sel]) => sel),
    [
      '.notice',
      '.notice--block',
      '.notice--compact',
      '.notice--info',
      '.notice--event',
      '.notice--caution',
      '.notice--error',
      '.notice__icon',
      '.notice__body',
      '.notice__label',
      '.notice__text',
      '.notice__action',
    ],
    'the ADR-0084 names, and nothing else',
  )
  const KEYWORDS = /^(\s|0|1|solid|flex|wrap|center|none|auto|block|transparent)*$/
  for (const [sel, body] of list) {
    for (const d of decls(body)) {
      const value = d.slice(d.indexOf(':') + 1).trim()
      // var(--token) and a color-mix of two tokens are the only calls; what is left must be a plain keyword.
      const left = value.replace(/var\(--[\w-]+\)/g, '').replace(/color-mix\(in srgb,\s*(7|16)%,\s*\)/g, '')
      assert.match(left, KEYWORDS, `${sel} { ${d} } uses tokens only`)
    }
    const margins = props(body).filter((p) => p.startsWith('margin'))
    if (sel === '.notice' || sel === '.notice__text') assert.deepEqual(margins, ['margin'], `${sel} resets its own margin`)
    else assert.deepEqual(margins, [], `${sel} sets no margin`)
  }
})

// ---- 3. the helper ----

test('the helper names the root: the block, the tone, the size, then the namespace', () => {
  assert.deepEqual(TONES, ['info', 'event', 'caution', 'error'])
  assert.deepEqual(SIZES, ['block', 'compact'])
  assert.equal(noticeClass(), 'notice notice--info notice--block')
  assert.equal(noticeClass({ tone: 'event' }), 'notice notice--event notice--block')
  assert.equal(noticeClass({ tone: 'caution', size: 'compact' }), 'notice notice--caution notice--compact')
  assert.equal(noticeClass({ tone: 'error', className: 'gamephotos__notice' }), 'notice notice--error notice--block gamephotos__notice')
  assert.equal(noticeParts({ tone: 'event', className: 'x' }).root, noticeClass({ tone: 'event', className: 'x' }), 'the component and a caller that owns its root get one string')
})

test('an unknown tone or size is a caller typo, and it throws', () => {
  assert.throws(() => noticeClass({ tone: 'warn' }), /unknown tone "warn"/)
  assert.throws(() => noticeClass({ tone: '' }), /unknown tone ""/)
  assert.throws(() => noticeParts({ tone: 'delay' }), /unknown tone "delay"/)
  assert.throws(() => noticeClass({ size: 'small' }), /unknown size "small"/)
  assert.throws(() => noticeParts({ size: '' }), /unknown size ""/)
})

test('the label, the icon and the action render only when given', () => {
  const none = noticeParts()
  assert.deepEqual([none.label, none.icon, none.action], [false, false, false], 'text only: no empty label, icon or action box')
  const all = noticeParts({ label: 'Unsealed', icon: { type: 'svg' }, action: { type: 'button' } })
  assert.deepEqual([all.label, all.icon, all.action], [true, true, true])
  for (const missing of [null, undefined, false, '']) {
    const p = noticeParts({ label: missing, icon: missing, action: missing })
    assert.deepEqual([p.label, p.icon, p.action], [false, false, false], `${JSON.stringify(missing)} is not given`)
  }
  assert.equal(noticeParts({ label: 0 }).label, true, 'a 0 is a value, not a missing label')
})

test('the error tone defaults to role="alert"; no other tone sets a role', () => {
  assert.equal(noticeParts({ tone: 'error' }).role, 'alert')
  for (const tone of ['info', 'event', 'caution']) assert.equal(noticeParts({ tone }).role, undefined, `${tone} has no default role`)
  assert.equal(noticeParts().role, undefined)
})

test('Notice renders each optional part behind the helper, the text always, and any role the caller passes wins', () => {
  const code = src('components/ui/state/Notice.jsx')
  assert.match(code, /\{parts\.icon && <span className="notice__icon" aria-hidden="true">\{icon\}<\/span>\}/)
  assert.match(code, /<div className="notice__body">/)
  assert.match(code, /\{parts\.label && <span className="notice__label">\{label\}<\/span>\}/)
  assert.match(code, /\n\s*<p className="notice__text">\{children\}<\/p>/, 'the text renders unconditionally')
  assert.match(code, /\{parts\.action && <div className="notice__action">\{action\}<\/div>\}/)
  assert.match(code, /<div className=\{parts\.root\} role=\{role \?\? parts\.role\} \{\.\.\.rest\}>/, 'one <div> root; the caller\'s role beats the default')
})

// ---- 4. no imports, no reveal ----

test('Notice and its helper import no api/ module and no stamp module', () => {
  for (const rel of ['components/ui/state/Notice.jsx', 'lib/design/noticeClass.js']) {
    const froms = [...src(rel).matchAll(/from ['"]([^'"]+)['"]/g)].map((m) => m[1])
    for (const from of froms) assert.doesNotMatch(from, /\/api\/|stamp/i, `${rel} imports ${from}`)
  }
})

test('Notice takes no reveal prop: it is never the placeholder for a sealed value', () => {
  const sig = src('components/ui/state/Notice.jsx').match(/export function Notice\(\{([^}]*)\}/)
  assert.ok(sig, 'Notice destructures its props')
  assert.doesNotMatch(sig[1], /reveal|seal/i)
})

// ---- 5. the pilot, and the lab ----

test('N1 pilot: the poster studio renders its overflow line on Notice, tone caution, as a live region', () => {
  const code = src('screens/GamePreview.jsx')
  assert.match(code, /import \{ Notice \} from '\.\.\/components\/ui\/state\/Notice\.jsx'/)
  assert.match(
    code,
    /<Notice tone="caution" role="status">\s*Turn one section off — three full sections run past the bottom of the sheet\.\s*<\/Notice>/,
  )
  assert.doesNotMatch(code, /posterstudio__warn/, 'the bare class is gone')
})

test('N1 pilot: the test that decides WHEN the line shows stays in the caller, byte for byte', () => {
  const code = src('screens/GamePreview.jsx')
  assert.ok(code.includes('const overflows = posterLayout(enabled, heights).overflows'))
  assert.match(code, /\{overflows && \(\s*<Notice /)
})

test('N1 pilot: .posterstudio__warn is deleted, and the panel\'s grid gap spaces the Notice', () => {
  const css = read('62-game-preview.css')
  assert.equal(ruleBody(css, '.posterstudio__warn'), null, 'nothing was left for the rule to say')
  const panel = ruleBody(css, '.posterstudio__panel')
  assert.equal(decl(panel, 'display'), 'grid')
  assert.equal(decl(panel, 'gap'), 'var(--space-3)')
})

test('the lab shows one Notice per tone, a label + action one and a compact one', () => {
  const lab = src('screens/designlab/components.jsx')
  assert.match(lab, /import \{ Notice \} from '\.\.\/\.\.\/components\/ui\/state\/Notice\.jsx'/)
  for (const tone of TONES) assert.ok(lab.includes(`<Notice tone="${tone}"`) || lab.includes(`tone="${tone}"`), `the lab shows tone ${tone}`)
  assert.match(lab, /<Notice[^>]*\blabel=/s)
  assert.match(lab, /<Notice[^>]*\baction=/s)
  assert.match(lab, /<Notice[^>]*size="compact"/s)
})
