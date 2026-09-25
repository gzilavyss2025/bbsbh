// The two band controls of #1131 slice 5, asserted from the stylesheet text.
// Each one sits on a coloured band, which is where a control's paint most
// often goes wrong without an error:
//
//   1. THE CARD BAND'S PILL (.psodds-pill: Postseason Odds, Stamp In). It is
//      <Pill role="control" fill="ink">. On a club-themed band a navy pill
//      disappears into a navy club, so it is a paper chip there. That look is
//      a host TINT through the pill's own five properties, never a repaint
//      (a repaint of background or color beats the pill's hover and selected
//      rules, and they stop drawing). It never reads a club colour (ADR-0030)
//      and never the seal (ADR-0083).
//   2. THE RECORDS RAIL (.trrank__jump a). Buttons with an href on a navy
//      band. The host re-inks the Button's five properties, and the hover fill
//      must stay dark, or the paper text disappears under a pointer. Its focus
//      ring must draw: the rail's old rule wrote `outline: var(--focus-ring)`,
//      a colour with no style, which set the outline to none, so a keyboard
//      user saw no ring at all. And on navy the ring must not be --field green,
//      which is under the 3:1 non-text bar there.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')
const read = (rel) => readFileSync(join(STYLES, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// Every `selectors { body }` in a sheet, innermost only, so a rule inside
// @media is found too.
const rules = (css) =>
  [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
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

const rulesFor = (rel, selector) => rules(read(rel)).filter((r) => r.selectors.includes(selector))

const REPAINTS = ['background', 'background-color', 'color', 'border', 'border-color', 'border-style', 'border-width']

test('the card band pill keeps no paint of its own and never reads the seal', () => {
  const found = rulesFor('39-manager-page.css', '.psodds-pill')
  assert.equal(found.length, 1, 'one .psodds-pill rule in 39-manager-page.css')
  for (const property of REPAINTS) {
    assert.equal(decl(found[0].body, property), undefined, `.psodds-pill paints ${property}; the Pill draws it`)
  }
  assert.doesNotMatch(found[0].body, /--seal/, 'ADR-0083 took this control off kraft')
})

test('on a club-themed band the pill is a paper chip through its own five properties', () => {
  const found = rulesFor('09-team-info.css', '.team-hub.is-themed .psodds-pill')
  assert.equal(found.length, 1, 'one themed-band rule for .psodds-pill')
  const { body } = found[0]
  for (const property of ['--pill-fill', '--pill-edge', '--pill-text', '--pill-fill-hover', '--pill-edge-hover']) {
    const value = decl(body, property)
    assert.ok(value, `the themed band sets ${property}`)
    assert.doesNotMatch(value, /--bar-|--seal|--marker/, `${property} takes no club colour, seal or marker`)
  }
  for (const property of REPAINTS) {
    assert.equal(decl(body, property), undefined, `the themed band repaints ${property}; set --pill-* instead`)
  }
})

test('the records rail re-inks the Button, and its hover fill stays dark under paper text', () => {
  const found = rulesFor('66-situational-records.css', '.trrank__jump a')
  assert.equal(found.length, 1, 'one base rule for the rail links')
  const { body } = found[0]
  assert.equal(decl(body, '--btn-ink'), 'var(--text-on-ink)')
  // The stock hover is --surface-inset, the lightest paper: paper text on it
  // vanishes. The rail's hover is a paper wash on the navy, so it stays dark.
  assert.match(decl(body, '--btn-fill-hover') ?? '', /color-mix\(in srgb, var\(--text-on-ink\) \d+%, transparent\)/)
  assert.ok(decl(body, '--btn-edge-hover'), 'the hover edge is set too')
  for (const property of REPAINTS) {
    assert.equal(decl(body, property), undefined, `the rail repaints ${property}; set --btn-* instead`)
  }
})

test('the records rail draws a focus ring, in paper on the navy band', () => {
  const found = rulesFor('66-situational-records.css', '.trrank__jump a:focus-visible')
  assert.ok(found.length > 0, 'the rail sets its ring colour for the navy band')
  for (const { body } of found) {
    // `outline: <colour>` alone sets the style to none: no ring draws.
    assert.equal(decl(body, 'outline'), undefined, 'the Button draws the ring; the rail sets only its colour')
  }
  const colours = found.map(({ body }) => decl(body, 'outline-color')).filter(Boolean)
  assert.deepEqual(colours, ['var(--text-on-ink)'])
})
