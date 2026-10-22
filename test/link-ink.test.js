// Link text is ink, never green.
//
// Field green is the app's "positive" colour (a win, a good rate, an "add" chip) and its
// focus ring. A link drawn in it read as a good number, so a door went to ink with a dotted
// rule (system/door.css), and the hand-written links beside it follow. This pins the links
// that were green, and scans every stylesheet for a new link-like rule that reads green.
// Asserted from the stylesheet text, where it is always true or always false, rather than
// from a render that depends on the data of the day.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const STYLES = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles')
const GREEN = /var\(--(accent-link|accent-positive|field|field-deep)\)/

// Comments come out first: a long prose block glues itself to the declaration after it.
function stripComments(css) {
  let out = ''
  let i = 0
  for (;;) {
    const open = css.indexOf('/*', i)
    if (open === -1) return out + css.slice(i)
    out += css.slice(i, open)
    const close = css.indexOf('*/', open + 2)
    if (close === -1) return out
    i = close + 2
  }
}

// Every rule as { selectors, body }. A rule inside @media is found as well: the pattern only
// matches a block with no brace inside it, so the @media wrapper itself never matches.
function rulesOf(css) {
  const out = []
  for (const m of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selectors: m[1].split(',').map((s) => s.replace(/\s+/g, ' ').trim()), body: m[2] })
  }
  return out
}

const colours = (body) => [...body.matchAll(/(?:^|[;\s])color:\s*([^;]+)/g)].map((m) => m[1].trim())
const readCss = (file) => readFileSync(join(STYLES, file), 'utf8')
const bodiesFor = (file, selector) =>
  rulesOf(readCss(file)).filter((r) => r.selectors.includes(selector)).map((r) => r.body)

// A link that is plain text: ink, with the dotted rule a door has.
const TEXT_LINKS = [
  ['lineup-next/starter.css', '.plink.lsp__seeall'],
  ['26-player-page.css', '.plink.foulcard__door'],
  ['pitcher-card/card.css', '.pcard__gamelink'],
  ['report/game-notes.css', '.gnotes__pdf a'],
  ['outliers/outliers.css', '.outl__name'],
  ['04-site-bar.css', '.tally-cl-link'],
]
// A door in a ruled box: the box stays, the text is ink.
const BOXED_DOORS = [
  ['25-wide-layout.css', '.wirerail__door'],
  ['78-offseason.css', '.oseason__door'],
  ['78-offseason.css', '.srecord__door'],
  ['78-offseason.css', '.seasonnote__when'],
]
// A control with a text label, and a glyph that opens a note: ink, no rule.
const TEXT_CONTROLS = [
  ['03-slate-header.css', '.topbar__back'],
  ['60-book-cover-picker.css', '.coverpick__back'],
  ['08-site-shell.css', '.searchbox__clear'],
  ['08-site-shell.css', '.searchoverlay__cancel'],
  ['08-site-shell.css', '.searchoverlay__clearrecent'],
  ['09-team-info.css', '.fact__infoglyph'],
]

test('a text link is ink with a dotted rule', () => {
  for (const [file, selector] of TEXT_LINKS) {
    const bodies = bodiesFor(file, selector)
    assert.ok(bodies.length, `${selector} should have a rule in ${file}`)
    const own = bodies.join(';')
    assert.match(own, /color:\s*var\(--text-heading\)/, `${selector} draws in ink`)
    assert.match(own, /text-decoration:\s*underline dotted/, `${selector} carries the dotted rule`)
  }
})

test('a boxed door and a text control are ink', () => {
  for (const [file, selector] of [...BOXED_DOORS, ...TEXT_CONTROLS]) {
    const bodies = bodiesFor(file, selector)
    assert.ok(bodies.length, `${selector} should have a rule in ${file}`)
    const cs = bodies.flatMap(colours)
    assert.ok(cs.some((c) => /var\(--text-heading\)/.test(c)), `${selector} draws in ink`)
    for (const c of cs) assert.doesNotMatch(c, GREEN, `${selector} reads green`)
  }
})

test('a link in a hover state or a leader board does not turn green', () => {
  const cases = [
    ['44-pre-game-cards.css', '.photostrip__viewall:hover'],
    ['boxlines/listdoor.css', '.boxlines__list .boxlines-entry:hover .boxlines-entry__chev'],
    ['postseason/series-parts.css', '.psseries__lboard .sectionhead__note'],
    ['postseason/series-parts.css', '.psseries__ldoormark'],
  ]
  for (const [file, selector] of cases) {
    for (const body of bodiesFor(file, selector)) {
      for (const c of colours(body)) assert.doesNotMatch(c, GREEN, `${selector} reads green`)
    }
  }
})

// The guard for the next one. A rule named like a link (a door, a "see all", a back or cancel
// button, a "view all", a game link) that draws its text in a green says "link" in the colour
// the app uses for "good". If a green here is deliberate, name the rule in ALLOWED with a reason.
const LINKISH = /door|seeall|view-?all|gamelink|__back|__cancel|__clear|-link/
const ALLOWED = new Set([])

function* cssFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* cssFiles(path)
    else if (name.endsWith('.css')) yield path
  }
}

test('no link-like rule draws its text in green', () => {
  const found = []
  for (const path of cssFiles(STYLES)) {
    const file = relative(STYLES, path)
    for (const { selectors, body } of rulesOf(readFileSync(path, 'utf8'))) {
      if (!colours(body).some((c) => GREEN.test(c))) continue
      for (const selector of selectors) {
        if (LINKISH.test(selector) && !ALLOWED.has(selector)) found.push(`${file}: ${selector}`)
      }
    }
  }
  assert.deepEqual(found, [], 'link-like rules that read green (draw them in ink, or list them in ALLOWED with a reason)')
})

// The static guides at /learn have their own stylesheet (public/learn.css, ADR-0053). A prose
// link there is ink with the dotted rule too, and goes solid on hover. The call-to-action
// button keeps its green fill: it is a button, and the focus ring stays green.
test('a link in the landing guides is ink, not green', () => {
  const learn = readFileSync(join(STYLES, '..', '..', 'public', 'learn.css'), 'utf8')
  const bodies = (selector) => rulesOf(learn).filter((r) => r.selectors.includes(selector)).map((r) => r.body)
  const base = bodies('a').join(';')
  assert.match(base, /color:\s*var\(--ink-0\)/, 'a link draws in ink')
  assert.match(base, /text-decoration:\s*underline dotted/, 'a link carries the dotted rule')
  assert.match(bodies('a:hover').join(';'), /text-decoration-style:\s*solid/, 'a hovered link goes solid')
  for (const selector of ['a', 'a:hover', '.basics__rail a:hover']) {
    for (const body of bodies(selector)) {
      for (const c of colours(body)) assert.doesNotMatch(c, GREEN, `${selector} reads green`)
    }
  }
})
