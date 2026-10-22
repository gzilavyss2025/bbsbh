// The Segmented control (#2073): a joined row of 44px .btn toggles. Asserted from
// the pure builder (rendered once through react-dom/server, as
// callout-ledger.test.js does) and from the stylesheet text.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { segmentedClassName, segmentedMarkup, segmentedOptions } from '../src/lib/design/segmentedClass.js'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const css = stripComments(readFileSync(join(SRC, 'styles/system/segmented/segmented.css'), 'utf8'))
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()
const rule = (selector) => {
  const body = ruleBody(css, selector)
  assert.ok(body, `${selector} should be a rule in system/segmented/segmented.css`)
  return body
}

const OPTIONS = [
  { value: 'all', label: 'All', count: 22 },
  { value: 'reg', label: 'Regular season', count: 0 },
  { value: 'post', label: 'Postseason', disabled: true },
]
const render = (props) =>
  renderToStaticMarkup(segmentedMarkup(createElement, { label: 'Show games', value: 'all', onChange() {}, options: OPTIONS, ...props }))

test('the group is a labelled role=group with the segmented class', () => {
  const html = render()
  assert.match(html, /^<div role="group" aria-label="Show games" class="segmented">/)
  assert.match(render({ fill: true, className: 'batlog__scope' }), /class="segmented segmented--fill batlog__scope"/)
})

test('each option is a .btn toggle: type=button, aria-pressed on every one', () => {
  const html = render()
  const buttons = html.match(/<button[^>]*>/g)
  assert.equal(buttons.length, 3)
  for (const b of buttons) {
    assert.match(b, /type="button"/)
    assert.match(b, /class="btn segmented__btn"/)
    assert.match(b, /aria-pressed="(true|false)"/)
  }
  assert.match(buttons[0], /aria-pressed="true"/)
  assert.match(buttons[1], /aria-pressed="false"/)
  assert.match(buttons[2], /disabled=""/)
})

test('a count renders in its own span; zero shows, a missing count does not', () => {
  const html = render()
  assert.match(html, />All<span class="segmented__count">22<\/span><\/button>/)
  assert.match(html, />Regular season<span class="segmented__count">0<\/span><\/button>/)
  assert.match(html, />Postseason<\/button>/)
})

test('pressed compares with Object.is, so an index of 0 can be the value', () => {
  const view = segmentedOptions([{ value: 0, label: 'Fouls' }, { value: 1, label: 'Whiffs' }], 0)
  assert.deepEqual(view.map((o) => o.pressed), [true, false])
  assert.equal(segmentedClassName(), 'segmented')
})

test('a tap calls onChange with the option value', () => {
  const seen = []
  const el = segmentedMarkup(createElement, { label: 'x', value: 'all', onChange: (v) => seen.push(v), options: OPTIONS })
  el.props.children[1].props.onClick()
  assert.deepEqual(seen, ['reg'])
})

test('index.css loads segmented.css after pill.css and before button.css; button stays directly before 07', () => {
  const imports = [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map((m) => m[1])
  const pill = imports.indexOf('system/pill.css')
  const seg = imports.indexOf('system/segmented/segmented.css')
  const button = imports.indexOf('system/button.css')
  assert.ok(seg !== -1, 'index.css should import system/segmented/segmented.css')
  assert.ok(pill < seg && seg < button, 'segmented.css sits between pill.css and button.css')
  assert.equal(button, imports.indexOf('07-team-logo-and-buttons.css') - 1)
})

test('the button: 44px, a heavy stamped edge, square, the card face', () => {
  const b = rule('.segmented .segmented__btn')
  assert.equal(decl(b, 'min-height'), 'var(--tap-min)')
  assert.equal(decl(b, 'border-width'), 'var(--bw-heavy)')
  assert.equal(decl(b, 'border-radius'), '0')
  assert.equal(decl(b, '--btn-edge'), 'var(--border-stamped)')
  assert.equal(decl(b, '--btn-fill'), 'var(--surface-card)')
  assert.equal(decl(b, '--btn-ink'), 'var(--text-heading)')
})

test('the join: each button after the first moves left by one heavy edge', () => {
  assert.equal(decl(rule('.segmented .segmented__btn + .segmented__btn'), 'margin-left'), 'calc(var(--bw-heavy) * -1)')
})

test('selected: ink fill, paper text, and no tick', () => {
  const on = rule(".segmented .segmented__btn[aria-pressed='true']")
  assert.equal(decl(on, 'background'), 'var(--text-heading)')
  assert.equal(decl(on, 'color'), 'var(--text-on-ink)')
  assert.equal(decl(rule(".segmented .segmented__btn[aria-pressed='true']::before"), 'content'), 'none')
  assert.match(css, /@media \(forced-colors: active\)/)
})

test('fill shares the row; the count is mono; no literal sizes', () => {
  assert.equal(decl(rule('.segmented--fill > .segmented__btn'), 'flex'), '1 1 0')
  assert.equal(decl(rule('.segmented .segmented__count'), 'font-family'), 'var(--font-mono)')
  assert.doesNotMatch(css, /\b(34|44)px\b/)
  assert.doesNotMatch(css, /--control-min/)
})

test('an option style reaches its button, so a caller can theme one tab', () => {
  const html = renderToStaticMarkup(
    segmentedMarkup(createElement, {
      label: 'Club',
      value: 'a',
      onChange() {},
      options: [{ value: 'a', label: 'A', style: { '--bar-fill': '#005A9C' } }, { value: 'b', label: 'B' }],
    }),
  )
  assert.match(html, /style="--bar-fill:#005A9C"/)
  assert.equal(html.match(/style=/g).length, 1)
})
