// The stamp-press (#2073, decision 1): every Button and Pill control, and the
// jump bar, moves 2px down and right when pressed, on the canvas press curve.
// Neither control has an offset shadow, so the press draws no shadow at all.
// Asserted from the stylesheet text, as test/notice-n5.test.js does.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ruleBody, stripComments } from './helpers/css.js'

const read = (rel) =>
  stripComments(readFileSync(fileURLToPath(new URL(`../src/styles/${rel}`, import.meta.url)), 'utf8'))
const decl = (body, property) =>
  body
    ?.split(';')
    .map((d) => d.trim().replace(/\s+/g, ' '))
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

const PRESS = 'translate(var(--bw-heavy), var(--bw-heavy))'

for (const [rel, sel] of [
  ['system/button.css', '.btn'],
  ['system/pill.css', '.pill--control'],
]) {
  test(`${sel}: the press moves 2px down and right, and draws no shadow`, () => {
    const body = ruleBody(read(rel), `${sel}:active`)
    assert.equal(decl(body, 'transform'), PRESS)
    assert.equal(decl(body, 'box-shadow'), undefined, 'no inset: the press is a move only')
  })

  test(`${sel}: under reduced motion the press does not move`, () => {
    const css = read(rel).replace(/\s+/g, ' ')
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    assert.match(reduced, new RegExp(`\\${sel}:active \\{ transform: none; \\}`))
  })
}

for (const [rel, sel] of [
  ['system/button.css', '.btn'],
  ['system/pill.css', '.pill--control'],
  ['system/jumpbar/jumpbar.css', '.jumpbar__item'],
]) {
  test(`${sel}: the press runs --dur-fast on --ease-stamp`, () => {
    const transition = decl(ruleBody(read(rel), sel), 'transition')
    assert.match(transition, /(^|, )transform var\(--dur-fast\) var\(--ease-stamp\)(,|$)/)
    assert.doesNotMatch(transition, /transform var\(--dur-fast\) var\(--ease-standard\)/)
  })
}

test('one press everywhere: Button, Pill and the jump bar move the same way', () => {
  const jump = decl(ruleBody(read('system/jumpbar/jumpbar.css'), '.jumpbar__item:active'), 'transform')
  assert.equal(jump, PRESS)
  assert.equal(decl(ruleBody(read('system/button.css'), '.btn:active'), 'transform'), jump)
  assert.equal(decl(ruleBody(read('system/pill.css'), '.pill--control:active'), 'transform'), jump)
})
