// A pressed paper control keeps a paper edge (#1131 slice 4, Gary's call).
//
// A paper Pill control rides a coloured band: the masthead toggles
// (.mastheadpill: Bullpen, "vs pitcher", MLB only, AAA log) sit on a club's
// bar. Pressed, every control takes the ink fill, navy. On the Brewers' navy
// bar that is 1.01:1, so the pressed chip disappears; the old yellow was
// 8.6:1. The fix is ONE Pill rule, not a host tint: a pressed paper control
// draws its edge in paper, so the chip keeps its outline on any bar.
//
// The edge reads a paper token, never a club colour (ADR-0030) and never the
// seal (ADR-0083).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PILL = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'system', 'pill.css')
const css = readFileSync(PILL, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selectors: m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
  body: m[2],
}))

const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

for (const state of ["[aria-pressed='true']", "[aria-current='page']"]) {
  const selector = `.pill--control.pill--paper${state}`

  test(`a paper control ${state} draws a paper edge`, () => {
    const found = rules.filter((r) => r.selectors.includes(selector))
    assert.equal(found.length, 1, `one ${selector} rule in system/pill.css`)
    assert.equal(decl(found[0].body, 'border-color'), 'var(--surface-card)')
    assert.doesNotMatch(found[0].body, /--bar-|--seal|--marker/, 'no club colour, seal or marker')
  })
}

test('the paper edge rule comes after the selected rule, so it wins at equal weight too', () => {
  const selected = rules.findIndex((r) => r.selectors.includes(".pill--control[aria-pressed='true']"))
  const paper = rules.findIndex((r) => r.selectors.includes(".pill--control.pill--paper[aria-pressed='true']"))
  assert.ok(selected >= 0, 'the selected rule exists')
  assert.ok(paper > selected, 'the paper edge rule follows the selected rule')
})
