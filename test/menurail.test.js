// The shared menu, rail and panel (#2073, slice 05a): the pure core, the markup it renders
// (server-rendered, the real builder MenuRail.jsx calls) and the resting CSS of the states.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { stripComments, ruleBody } from './helpers/css.js'
import {
  BODY_A, BODY_B, bodyClass, cardProps, firstView, menuRailMarkup, nextView, panelProps, pickFor, rootProps,
} from '../src/components/ui/control/menuRail.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = () => stripComments(read('styles/system/menurail/menurail.css'))
const decl = (body, property) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${property}:`))?.slice(property.length + 1).trim()

const ITEMS = [
  { key: 'a', title: 'First', meta: '41%', figures: 'one', label: 'First: 41 percent' },
  { key: 'b', title: 'Second', meta: '27%', figures: 'two', heading: 'Group B' },
  { key: 'c', title: 'Third', disabled: true },
]
const render = ({ picked = null, view = firstView(picked), ...rest } = {}) =>
  renderToStaticMarkup(
    menuRailMarkup(createElement, {
      label: 'Kinds',
      items: ITEMS,
      onPick() {},
      panel: (k) => createElement('p', null, `panel ${k}`),
      backLabel: 'All kinds',
      picked,
      view,
      ...rest,
    }),
  )
const count = (s, needle) => s.split(needle).length - 1

test('the panel shows the last pick while it folds shut (the shownKey lag)', () => {
  let v = firstView(null)
  assert.equal(v.shownKey, null)
  v = nextView(v, 'FF')
  assert.equal(v.shownKey, 'FF')
  v = nextView(v, null)
  assert.equal(v.picked, null)
  assert.equal(v.shownKey, 'FF') // still FF: the content stays until the fold ends
})

test('every new pick swaps the body a <-> b; a close or the same pick does not', () => {
  let v = nextView(firstView(null), 'FF')
  const g1 = v.gen
  v = nextView(v, 'SL')
  assert.equal(v.gen, g1 + 1)
  assert.notEqual(bodyClass(g1), bodyClass(v.gen))
  assert.equal(nextView(v, 'SL'), v) // the same object: no state write during render
  const shut = nextView(v, null)
  assert.equal(shut.gen, v.gen)
  assert.equal(nextView(shut, 'SL').gen, v.gen + 1) // re-open the same one: it rises again
  assert.deepEqual([bodyClass(0), bodyClass(1)], [`menurail__body ${BODY_A}`, `menurail__body ${BODY_B}`])
})

test('a tap on the picked card closes; a tap on another picks it', () => {
  assert.equal(pickFor('FF', 'FF'), null)
  assert.equal(pickFor('SL', 'FF'), 'SL')
  assert.equal(pickFor('SL', null), 'SL')
})

test('the small helpers: root state, card toggle, inert panel', () => {
  assert.deepEqual(rootProps({ picked: 'a', railMeta: true, className: 'x' }), {
    className: 'menurail menurail--rail menurail--railmeta x',
    'data-state': 'rail',
  })
  assert.equal(cardProps({ key: 'a' }, null).pressed, false)
  assert.equal(cardProps({ key: 'a', className: 'is-x' }, 'a').className, 'menurail__card is-x')
  assert.deepEqual(panelProps(false), { className: 'menurail__panel', inert: true })
  assert.deepEqual(panelProps(true), { className: 'menurail__panel menurail__panel--open', inert: false })
})

test('menu state markup: a labelled group of .btn toggles, all off; the panel shut and inert', () => {
  const html = render()
  assert.match(html, /^<div class="menurail" data-state="menu">/)
  assert.match(html, /<div class="menurail__menu" role="group" aria-label="Kinds">/)
  assert.equal(count(html, 'class="btn menurail__card"'), 3)
  assert.equal(count(html, 'aria-pressed="false"'), 3)
  assert.equal(count(html, 'aria-pressed="true"'), 0)
  assert.match(html, /aria-label="First: 41 percent"/)
  assert.match(html, /<button type="button" class="btn menurail__card" aria-pressed="false" disabled=""/)
  assert.ok(html.indexOf('Group B') < html.indexOf('Second')) // the head comes before its card
  assert.match(html, /<div class="menurail__panel" inert="">/)
  assert.doesNotMatch(html, /menurail__body/) // nothing picked yet: no body
})

test('rail state markup: one card pressed, the panel open, not inert, body b (first pick), Back first', () => {
  const html = render({ picked: 'b', view: nextView(firstView(null), 'b') })
  assert.match(html, /data-state="rail"/)
  assert.match(html, /class="menurail menurail--rail"/)
  assert.equal(count(html, 'aria-pressed="true"'), 1)
  assert.match(html, /<div class="menurail__panel menurail__panel--open">/)
  assert.doesNotMatch(html, /menurail__panel menurail__panel--open" inert/)
  assert.match(html, /class="btn btn--ghost menurail__back"><span class="btn__icon" aria-hidden="true">←<\/span>All kinds<\/button><div class="menurail__body menurail__body--b"><p>panel b<\/p>/)
})

test('closing keeps the last panel while it folds, and the panel goes inert at once', () => {
  const open = nextView(nextView(firstView(null), 'a'), 'b') // gen 2: body a
  const html = render({ picked: null, view: nextView(open, null) })
  assert.match(html, /data-state="menu"/)
  assert.match(html, /<div class="menurail__panel" inert="">/)
  assert.match(html, /<div class="menurail__body menurail__body--a"><p>panel b<\/p>/)
})

test('no panel prop: a pick does not throw', () => {
  const html = render({ panel: undefined, picked: 'b', view: nextView(firstView(null), 'b') })
  assert.equal(count(html, 'menurail__panel'), 0)
})

test('no panel prop: no panel at all (Splits opens its own sections)', () => {
  assert.doesNotMatch(render({ panel: undefined }), /menurail__panel/)
})

test('MenuRail.jsx renders the builder with the stepped view', () => {
  const jsx = read('components/ui/control/MenuRail.jsx')
  assert.match(jsx, /return menuRailMarkup\(createElement, \{ \.\.\.props, picked, view: next \}\)/)
  assert.match(jsx, /if \(next !== view\) setView\(next\)/)
})

test('menu state CSS: cards share the row from a 150px basis; the pick is mint with a 2px shadow', () => {
  const c = css()
  assert.equal(decl(ruleBody(c, '.menurail'), '--menurail-card'), 'calc(var(--space-2h) * 15)')
  const card = ruleBody(c, '.menurail__card.btn')
  assert.equal(decl(card, 'flex'), '1 1 var(--menurail-card)')
  assert.equal(decl(card, 'border-radius'), '0')
  const pick = ruleBody(c, ".menurail__card.btn[aria-pressed='true']")
  assert.equal(decl(pick, 'background'), 'var(--accent-tint)')
  assert.equal(decl(pick, 'box-shadow'), 'var(--bw-heavy) var(--bw-heavy) 0 var(--border-stamped)')
  assert.equal(decl(ruleBody(c, ".menurail__card.btn[aria-pressed='true']::before"), 'content'), 'none')
  assert.equal(decl(ruleBody(c, '.menurail__fold'), 'grid-template-rows'), '1fr')
  const figs = ruleBody(c, '.menurail__figs')
  assert.equal(decl(figs, 'min-height'), '0')
  assert.equal(decl(figs, 'overflow'), 'hidden')
})

test('rail state CSS: narrow cards, the figures fold to 0fr, the meta hides unless railMeta', () => {
  const c = css()
  assert.equal(decl(ruleBody(c, '.menurail'), '--menurail-rail'), 'calc(var(--tap-min) * 3)')
  assert.equal(decl(ruleBody(c, '.menurail--rail .menurail__card.btn'), 'flex'), '0 0 var(--menurail-rail)')
  assert.equal(decl(ruleBody(c, '.menurail--rail .menurail__fold'), 'grid-template-rows'), '0fr')
  assert.equal(decl(ruleBody(c, '.menurail--rail:not(.menurail--railmeta) .menurail__meta'), 'display'), 'none')
  assert.equal(decl(ruleBody(c, '.menurail--rail .menurail__head'), 'max-height'), '0')
})

test('panel CSS: 0fr and hidden when shut, 1fr and visible when open', () => {
  const c = css()
  assert.equal(decl(ruleBody(c, '.menurail__panel'), 'grid-template-rows'), '0fr')
  assert.equal(decl(ruleBody(c, '.menurail__panel--open'), 'grid-template-rows'), '1fr')
  assert.equal(decl(ruleBody(c, '.menurail__panelin'), 'visibility'), 'hidden')
  assert.equal(decl(ruleBody(c, '.menurail__panel--open .menurail__panelin'), 'visibility'), 'visible')
})

test('index.css loads the sheet, and not between button.css and 07', () => {
  const imports = [...read('index.css').matchAll(/@import '\.\/styles\/([^']+)'/g)].map((m) => m[1])
  assert.ok(imports.indexOf('system/menurail/menurail.css') > -1)
  assert.equal(imports[imports.indexOf('system/button.css') + 1], '07-team-logo-and-buttons.css')
})
