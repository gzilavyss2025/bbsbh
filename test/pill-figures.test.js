// The figure pill (#1186): one rule centres the mono face, for a tag and a
// control, in Chromium and WebKit alike. Before it, four hosts each added 1px
// of top padding. That centred the figures in Chromium and put them 0.5px low
// in WebKit (iPhone Safari), and the next mono tag would have needed a fifth
// nudge. These tests hold the rule in one place:
//
//   1. THE OPT-IN. `figure` on Pill (or the pill--figure class by hand) is the
//      one way a pill takes the mono face.
//   2. THE RULE. system/pill.css trims the line to the cap height, gives the
//      trim back as padding, and centres a control with align-content.
//   3. NO NUDGE ON A HOST. A figure host sets no block padding and no face of
//      its own: the pad goes through --pill-pad-block, the face is the rule's.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pillClassName } from '../src/lib/design/pillClass.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const readCss = (rel) => stripComments(readFileSync(join(SRC, 'styles', rel), 'utf8'))

// Every rule body whose selector list names `selector` exactly (not as a
// prefix of a longer class), with the selector list it came from.
function rulesFor(css, selector) {
  const out = []
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`${escaped}(?![\\w-])`)
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (re.test(m[1])) out.push({ selectors: m[1].trim(), body: m[2] })
  }
  return out
}

const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

// The figure hosts: the partial, the host selector, and the component that
// renders it (and so must opt in).
const HOSTS = [
  { css: '04a-wire-dock.css', sel: '.wiredock__count', jsx: 'components/transactions/WireDock.jsx' },
  { css: '20-charts.css', sel: '.winprob__ledger-chip', jsx: 'components/charts/WinProbChart.jsx' },
  { css: '23-box-score-detail.css', sel: '.tlead__level', jsx: 'components/teamstats/TeamLeaders.jsx' },
  { css: '31-wild-card.css', sel: '.thub-affiliate__level', jsx: 'screens/team/modules/minors/AffiliatesCard.jsx' },
  { css: '31-wild-card.css', sel: '.prospecttable__top', jsx: 'screens/team/modules/minors/ProspectsCard.jsx' },
]

test('figure is an opt-in class, and it changes no colour axis', () => {
  assert.equal(pillClassName({ figure: true }), 'pill pill--figure')
  assert.equal(pillClassName({ fill: 'paper', figure: true, className: 'x__level' }), 'pill pill--paper pill--figure x__level')
  assert.equal(pillClassName({ role: 'control', figure: true }), 'pill pill--control pill--figure')
  assert.equal(pillClassName({ fill: 'ink' }), 'pill pill--ink', 'no figure, no class')
})

test('the figure rule trims to the cap height and gives the trim back as padding', () => {
  const css = readCss('system/pill.css')
  const [plain] = rulesFor(css, '.pill--figure').filter((r) => r.selectors === '.pill--figure')
  assert.ok(plain, 'system/pill.css should have a .pill--figure rule')
  assert.equal(decl(plain.body, 'display'), 'inline-block', 'text-box applies only to a block container, never to a flex container')
  assert.equal(decl(plain.body, 'font-family'), 'var(--font-mono)')
  assert.equal(decl(plain.body, 'font-variant-numeric'), 'tabular-nums')
  assert.equal(decl(plain.body, 'padding-block'), 'var(--pill-pad-block)', 'without text-box, the plain pad and no trim')

  const supports = css.indexOf('@supports (text-box: trim-both cap alphabetic)')
  assert.ok(supports !== -1, 'the trim sits behind @supports, so an engine without it keeps the plain pad')
  const trimmed = rulesFor(css.slice(supports), '.pill--figure').find((r) => r.selectors === '.pill--figure')
  assert.equal(decl(trimmed.body, 'text-box'), 'trim-both cap alphabetic')
  assert.equal(
    decl(trimmed.body, 'padding-block'),
    'calc(var(--pill-pad-block) + (1lh - 1cap) / 2)',
    'the padding gives back what the trim cut, so the tag keeps its height',
  )
})

test('a figure control is centred by align-content, not by a pad', () => {
  const css = readCss('system/pill.css')
  const control = rulesFor(css, '.pill--figure').find((r) => r.selectors === '.pill--control.pill--figure')
  assert.ok(control, 'system/pill.css should have a .pill--control.pill--figure rule')
  assert.equal(decl(control.body, 'align-content'), 'center')
  assert.equal(decl(control.body, 'padding-block'), '0')
})

test('no figure host nudges its figures or restates the face', () => {
  for (const { css, sel } of HOSTS) {
    const rules = rulesFor(readCss(css), sel)
    assert.ok(rules.length > 0, `${css}: ${sel} should still exist`)
    for (const { selectors, body } of rules) {
      for (const property of ['padding-top', 'padding-bottom', 'padding-block', 'padding-block-start', 'padding-block-end']) {
        assert.equal(decl(body, property), undefined, `${selectors} sets ${property}; set --pill-pad-block instead`)
      }
      const shorthand = decl(body, 'padding')
      assert.equal(shorthand, undefined, `${selectors} sets padding; the block pad is --pill-pad-block (use padding-inline)`)
      assert.equal(decl(body, 'font-family'), undefined, `${selectors} restates the mono face; the figure rule sets it`)
      assert.equal(decl(body, 'font-variant-numeric'), undefined, `${selectors} restates tabular-nums; the figure rule sets it`)
    }
  }
})

test('every figure host opts in to the figure rule', () => {
  for (const { sel, jsx } of HOSTS) {
    const src = readFileSync(join(SRC, jsx), 'utf8')
    const cls = sel.slice(1)
    const at = src.indexOf(cls)
    assert.ok(at !== -1, `${jsx} should render ${cls}`)
    // The element's opening tag: from the `<` before the class to the `>` after it.
    const open = src.slice(src.lastIndexOf('<', at), src.indexOf('>', at) + 1)
    assert.match(open, /\bfigure\b|pill--figure/, `${jsx}: ${cls} should be a figure pill (figure prop or pill--figure)`)
  }
})

test('the two level tags share the rule, not seven copied declarations', () => {
  const tlead = rulesFor(readCss('23-box-score-detail.css'), '.tlead__level')[0].body
  const affiliate = rulesFor(readCss('31-wild-card.css'), '.thub-affiliate__level')[0].body
  for (const property of ['font-family', 'font-size', 'letter-spacing', 'padding-block']) {
    assert.equal(decl(tlead, property), undefined, `.tlead__level still sets ${property}`)
    assert.equal(decl(affiliate, property), undefined, `.thub-affiliate__level still sets ${property}`)
  }
})
