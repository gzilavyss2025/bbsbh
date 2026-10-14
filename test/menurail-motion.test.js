// The menu rail's motion (#2073, slice 05b): the glide, the fold, the panel and the
// rise on each pick, on the unfold and stamp tokens, and none of it under reduced motion.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const read = (rel) => readFileSync(join(SRC, rel), 'utf8')
const all = () => stripComments(read('styles/motion/menurail.css'))
const REDUCED = '@media (prefers-reduced-motion: reduce)'
const main = () => all().split(REDUCED)[0]
const reduced = () => all().split(REDUCED)[1] ?? ''
const decl = (body, property) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${property}:`))?.slice(property.length + 1).trim()
const flat = (v) => v?.replace(/\s+/g, ' ')
// A rule inside the @media block: its selector is indented two spaces.
const indented = (css, selector) => {
  const at = css.indexOf(`  ${selector} {`)
  return at === -1 ? null : css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
}

test('the cards glide: flex-basis and padding on --dur-unfold / --ease-unfold, the press kept', () => {
  const t = flat(decl(ruleBody(main(), '.menurail__card.btn'), 'transition'))
  assert.match(t, /flex-basis var\(--dur-unfold\) var\(--ease-unfold\)/)
  assert.match(t, /padding var\(--dur-unfold\) var\(--ease-unfold\)/)
  assert.match(t, /transform var\(--dur-fast\) var\(--ease-stamp\)/)
  assert.match(t, /box-shadow var\(--dur-fast\) var\(--ease-stamp\)/)
})

test('the figures and the panel fold on grid-template-rows, the same pair', () => {
  for (const sel of ['.menurail__fold', '.menurail__panel']) {
    assert.equal(decl(ruleBody(main(), sel), 'transition'), 'grid-template-rows var(--dur-unfold) var(--ease-unfold)', sel)
  }
})

test('a shutting panel hides only after the fold; an opening one shows at once', () => {
  assert.equal(decl(ruleBody(main(), '.menurail__panelin'), 'transition'), 'visibility 0s var(--dur-unfold)')
  assert.equal(decl(ruleBody(main(), '.menurail__panel--open .menurail__panelin'), 'transition-delay'), '0s')
})

test('two keyframes with the same steps, so a new pick restarts the rise', () => {
  const c = all()
  const steps = (name) => flat(c.match(new RegExp(`@keyframes ${name}\\s*\\{\\s*from\\s*\\{([^}]*)\\}`))?.[1]).trim()
  assert.equal(steps('menurail-rise-a'), 'opacity: 0; transform: translateY(var(--space-2));')
  assert.equal(steps('menurail-rise-b'), steps('menurail-rise-a'))
  assert.equal(decl(ruleBody(main(), '.menurail__body--a'), 'animation'), 'menurail-rise-a var(--dur-stamp-in) var(--ease-stamp) backwards')
  assert.equal(decl(ruleBody(main(), '.menurail__body--b'), 'animation'), 'menurail-rise-b var(--dur-stamp-in) var(--ease-stamp) backwards')
})

test('reduced motion: no glide, no fold, no rise', () => {
  const r = reduced()
  for (const sel of ['.menurail__card.btn', '.menurail__fold', '.menurail__head', '.menurail__panel', '.menurail__panelin']) {
    assert.equal(decl(indented(r, sel), 'transition'), 'none', sel)
  }
  assert.equal(decl(indented(r, '.menurail__body--a'), 'animation'), 'none')
  assert.equal(decl(indented(r, '.menurail__body--b'), 'animation'), 'none')
})

test('index.css loads it with the motion package, before focus/', () => {
  const imports = [...read('index.css').matchAll(/@import '\.\/styles\/([^']+)'/g)].map((m) => m[1])
  const at = imports.indexOf('motion/menurail.css')
  assert.ok(at > imports.indexOf('motion/stamp-in.css'))
  const focus = imports.findIndex((p) => p.startsWith('focus/'))
  assert.ok(focus === -1 || at < focus)
})

test('the Animation Lab shows the rail and freezes the rise', () => {
  const lab = stripComments(read('styles/46-consent-modal.css'))
  assert.match(lab, /\.animlab__frame \.menurail__body--a,/)
  assert.match(lab, /\.animlab__frame \.menurail__body--b,/)
  const demo = read('screens/animlab/PlayerMotionLab.jsx')
  assert.match(demo, /<MenuRail /)
  assert.match(demo, /className="menurail__body menurail__body--a"/)
})
