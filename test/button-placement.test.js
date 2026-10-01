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
import { stripComments } from './helpers/css.js'

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')
const read = (name) => stripComments(readFileSync(join(STYLES, name), 'utf8'))

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
  ['11-innings.css', '.innings__notes', 'flex', 'none', 'Game Notes never shrinks in the team head'],
  ['24-floating-nav-and-hud.css', '.innings__refresh--float', 'pointer-events', 'auto', 'the bar is click-through; Refresh is not'],
  ['focus/stage.css', '.pagenav--focus .innings__refresh--float', 'z-index', '3', 'Refresh rides above the reveal pair’s dead space'],
  ['focus/stage.css', '.pagenav--focus .innings__refresh--float', 'min-width', 'var(--tap-min)', 'Refresh stays a square-ish tap target on one row'],
  ['04-site-bar.css', '.sitebar__search', 'min-width', 'var(--tap-min)', 'an icon-only control is square'],
  ['04-site-bar.css', '.btn.sitebar__search', 'padding', '0', 'a square takes its width from the height'],
  ['04-site-bar.css', '.btn.sitebar__logbook', 'padding', '0 var(--space-2h)', 'the Game Log lockup draws at its row’s height'],
  ['04-site-bar.css', '.account__btn', 'margin-left', '2px', 'the account control closes the site bar’s row'],
  ['04-site-bar.css', '.continuebar__pitchcta', 'flex', '0 0 auto', 'the sign-in CTA keeps its width in the continue bar'],
  ['08-site-shell.css', '.sitefooter__btn', 'min-width', '0', 'a long label wraps inside its grid cell'],
  ['26-player-page.css', '.player__back', 'margin-left', 'calc(-1 * var(--space-2h))', 'the word sits on the page’s edge'],
  ['42-first-scorebook.css', '.allstarlegacy__door', 'margin-top', 'var(--space-3)', 'the door stands clear of the last honoree card'],
  ['48-logbook.css', '.logbook__season', 'align-items', 'baseline', 'the year, its count and the tick share a baseline'],
  ['35-postseason-series.css', '.psseries__facewrap .flipback__door', 'margin-bottom', 'var(--space-1)', 'the Box score door stands off the ledger row below it'],
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
  const bar = read('04-site-bar.css')
  for (const cls of ['.sitebar__search', '.sitebar__menu', '.sitebar__logbook']) {
    const bare = ruleBody(bar, cls)
    assert.ok(!bare || !/(^|;)\s*padding/.test(bare), `${cls}'s padding must be written as .btn${cls} to beat .btn`)
  }
})

// The floating bar's primary-action rules must skip Refresh, which wears .btn
// too: without the guard it takes the primary's full width, raised shadow and
// dead-space hit area.
test('the floating bar keeps its primary-action rules off Refresh', () => {
  const css = read('24-floating-nav-and-hud.css')
  assert.ok(ruleBody(css, '.pagenav .btn:where(:not(.innings__refresh))'), '.pagenav .btn must exclude Refresh')
  assert.equal(ruleBody(css, '.pagenav .btn'), null)
  assert.ok(ruleBody(css, '.pagenav--innings .btn:where(:not(.innings__refresh))::after'))
})

// The last hand-drawn copies (#1174). Each drew its own fill, edge, radius,
// type or selected state; each is now the one Button (or, for Box score, a
// Door) and keeps placement only, so none of these rules may come back.
test('the swept controls draw nothing of their own', () => {
  const gone = [
    ['48-stamp-strip.css', '.stampstrip__modes button'],
    ['48-stamp-strip.css', '.stampstrip__modes button.is-active'],
    ['48-logbook.css', '.logbook__seasons button'],
    ['48-logbook.css', '.logbook__seasons button.is-active'],
    ['58-logbook-shelf.css', '.bookmgmt__modes'],
    ['58-logbook-shelf.css', '.bookmgmt__modes button'],
    ['22-box-score-tables.css', '.flipback__boxbtn'],
    ['35-postseason-series.css', '.psseries__facewrap .flipback__boxbtn'],
    ['59-stamp-in.css', '.stampin__facewrap .flipback__boxbtn'],
    ['52-highlight-clip-card.css', '.flipback__watchbtn'],
  ]
  for (const [file, selector] of gone) assert.equal(ruleBody(read(file), selector), null, `${file} still draws ${selector}`)
})

test('the swept toggles take their selected state from aria, not .is-active or a skin', () => {
  const SRC = join(STYLES, '..')
  const jsx = (rel) => readFileSync(join(SRC, rel), 'utf8')
  const strip = jsx('components/logbook/StampGameButton.jsx')
  assert.match(strip, /<Button size="control" key=\{mode\} pressed=\{existing\.mode === mode\}/)
  const seasons = jsx('screens/logbook/StampCollection.jsx')
  assert.match(seasons, /aria-current=\{year === season \? 'page' : undefined\}/)
  for (const rel of ['components/logbook/StampGameButton.jsx', 'screens/logbook/StampCollection.jsx']) {
    assert.doesNotMatch(jsx(rel), /is-active/, `${rel} still writes .is-active`)
  }
  for (const rel of ['screens/scorecard/ScorecardPage.jsx', 'screens/ScorecardLab.jsx']) {
    const all = jsx(rel)
    const at = all.indexOf('aria-label="Half of inning"')
    const src = all.slice(at, all.indexOf('</div>', at))
    assert.doesNotMatch(src, /btn--ghost|skin=/, `${rel}: the unselected half is outline; pressed carries the state`)
    assert.equal(src.match(/<Button size="control" pressed=\{side === '(top|bottom)'\}/g)?.length, 2, rel)
  }
  const watch = jsx('components/highlights/WatchCondensedButton.jsx')
  assert.match(watch, /<Button size="control" skin="ink" className="flipback__watchbtn"/)
  const face = jsx('components/game/GameResultFace.jsx')
  assert.match(face, /<Door className="flipback__door" \{\.\.\.routeLink\(boxScorePath\)\}>/, 'Box score leaves the card, so it is a door')
})
