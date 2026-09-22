// A control's per-site rule must keep every declaration that PLACES it (#1130).
//
// The door collapse (#1161) lost `.txcard__door`'s `align-self: stretch` in a
// cut that read "all it keeps is where it stands", and the door went from 151px
// to 54px with lint green (test/door-placement.test.js). The button collapse
// makes the same cut on about twenty controls, so every declaration it keeps ON
// PURPOSE is pinned here, from the stylesheet text, where it is always true or
// always false rather than true only on the day a page happens to render it.
//
// A second failure is specific to this collapse. A rule that sits in 01–06b
// loads BEFORE system/button.css, so any declaration it keeps that .btn also
// sets — padding, min-width — must be written at two-class specificity or it
// silently loses to the base rule on order. Those rows pin the SELECTOR too.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')
const read = (name) => readFileSync(join(STYLES, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

// The declaration block of a rule whose selector list contains `selector`
// exactly — never a pseudo, a compound or a longer name that starts with it.
function ruleBody(css, selector) {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '))
    if (sels.includes(selector)) return m[2]
  }
  return null
}

const declares = (body, property, value) =>
  body
    .split(';')
    .map((d) => d.trim())
    .some((d) => d.startsWith(`${property}:`) && d.slice(d.indexOf(':') + 1).trim() === value)

// [file, selector, property, value, why]
const KEPT = [
  ['07-team-logo-and-buttons.css', '.btn--next', 'width', '100%', 'the advance fills the bar slot'],
  ['07-team-logo-and-buttons.css', '.btn--next', 'margin-top', '20px', 'the advance stands off the page above it'],
  ['05-masthead-nav.css', '.stepnav .stepnav__btn', 'flex', '1 1 0', 'the stops share the row equally'],
  ['05-masthead-nav.css', '.stepnav .stepnav__btn', 'padding-inline', 'var(--space-1)', 'five stops fit a phone row only at the row’s own padding'],
  ['27-player-position-innings.css', '.posinn__scopebtn', 'flex', '1 1 0', 'the scopes share the row equally'],
  ['27-player-position-innings.css', '.posinn__scopebtn', 'padding-inline', 'var(--space-1)', 'the row, not the label, sizes the cell'],
  ['38-umpire-pages.css', '.umpage__filterbtn', 'flex', '1', 'the two filters share the row'],
  ['scorecard/page.css', '.sc-zoom__btn', 'width', 'var(--control-min)', 'a one-glyph step is square'],
  ['scorecard/page.css', '.sc-zoom__btn', 'padding', '0', 'a square takes its width from the height, not padding'],
  ['55-my-tally-account.css', '.erasesheet__btn', 'flex', '1 1 auto', 'the erase pair share the row'],
  ['21b-box-score-tally.css', '.bs__tallyScopebtn', 'min-width', '42px', 'three segments read as equal'],
]

for (const [file, selector, property, value, why] of KEPT) {
  test(`${selector} keeps ${property}: ${value} — ${why}`, () => {
    const body = ruleBody(read(file), selector)
    assert.ok(body, `${file} should still have a rule for ${selector}`)
    assert.ok(declares(body, property, value), `${selector} in ${file} lost ${property}: ${value}`)
  })
}

// The 01–06b rows: a bare single-class selector there would parse, render and
// lose its padding to .btn--control without a signal.
test('a kept declaration that .btn also sets, in a partial before the slot, outranks .btn', () => {
  const css = read('05-masthead-nav.css')
  assert.equal(ruleBody(css, '.stepnav__btn'), null, 'write it as .stepnav .stepnav__btn, not a bare .stepnav__btn')
})
