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
const GREEN = /var\(--(accent-hover|accent-positive|field|field-deep)\)/

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
  ['pitcher-card/card.css', '.pcard__gamelink'],
  ['report/game-notes.css', '.gnotes__pdf a'],
  ['outliers/outliers.css', '.outl__name'],
  ['04-site-bar.css', '.tally-cl-link'],
]
// A door in a ruled box: the box stays, the text is ink. The ink comes from one rule (#2613).
const BOXED_DOORS = [['system/door.css', '.door--boxed']]
// Placement only: the four hosts that seat a boxed door draw no colour of their own.
const BOXED_HOSTS = [
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
  ['04-site-bar.css', '.tally-cl-textbtn'],
  ['postseason/series-parts.css', '.psseries__ldoormark'],
]

test('a text link is ink with a dotted rule', () => {
  for (const [file, selector] of TEXT_LINKS) {
    const bodies = bodiesFor(file, selector)
    assert.ok(bodies.length, `${selector} should have a rule in ${file}`)
    const own = bodies.join(';')
    assert.match(own, /color:\s*var\(--text-heading\)/, `${selector} draws in ink`)
    if (!SHARED_RULE.includes(selector)) assert.match(own, /text-decoration:\s*underline dotted/, `${selector} carries the dotted rule`)
  }
})

// #2528: the dotted rule is drawn in one place. A class listed here owns no copy of it.
const SHARED_RULE = [
  '.door--inline', '.door__label', '.plink.lsp__seeall', '.pcard__gamelink', '.outl__name', '.gnotes__pdf a',
]
test('the dotted link rule has one source in system/door.css', () => {
  const shared = rulesOf(readCss('system/door.css')).find((r) => SHARED_RULE.every((s) => r.selectors.includes(s)))
  assert.ok(shared, 'door.css has one rule naming every collapsed link')
  assert.match(shared.body, /text-decoration:\s*underline dotted/)
  assert.match(shared.body, /text-decoration-thickness:\s*var\(--bw-hair\)/)
  assert.match(shared.body, /text-underline-offset:\s*3px/)
  for (const [file, selector] of [
    ['lineup-next/starter.css', '.plink.lsp__seeall'],
    ['pitcher-card/card.css', '.pcard__gamelink'], ['report/game-notes.css', '.gnotes__pdf a'],
    ['outliers/outliers.css', '.outl__name'],
  ]) {
    for (const body of bodiesFor(file, selector)) assert.doesNotMatch(body, /text-underline-offset/, `${selector} keeps its own copy`)
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

test('a boxed door host keeps placement, never ink or type', () => {
  for (const [file, selector] of BOXED_HOSTS) {
    const bodies = bodiesFor(file, selector)
    assert.ok(bodies.length, `${selector} should have a rule in ${file}`)
    for (const body of bodies) {
      assert.doesNotMatch(body, /(^|[;\s])color:|font-(family|size|weight)|letter-spacing|border:|border-radius|min-height/, `${selector} restates the boxed door's dress`)
    }
  }
})

test('a link in a hover state or a leader board does not turn green', () => {
  const cases = [
    ['44-pre-game-cards.css', '.photostrip__viewall:hover'],
    ['boxlines/listdoor.css', '.boxlines__list .boxlines-entry:hover .boxlines-entry__chev'],
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
  assert.match(bodies('a:hover').join(';'), /text-decoration-thickness:\s*2px/, 'a hovered link goes heavier, so the rail reads it')
  for (const selector of ['a', 'a:hover', '.basics__rail a:hover']) {
    for (const body of bodies(selector)) {
      for (const c of colours(body)) assert.doesNotMatch(c, GREEN, `${selector} reads green`)
    }
  }
})

// The token that used to be --accent-link. Every rule left that read it is a :hover rule (the
// arrows on the photo strips and clip rails, a thumbnail's border, a cell's wash, the prospect
// board's bar, the Box Lines door's outline), so the name says that: the green a control takes
// under a pointer. It colours no text. This keeps the name true, and keeps the old one gone.
test('--accent-hover is read only by hover rules, and --accent-link is gone', () => {
  let reads = 0
  const outside = []
  for (const path of cssFiles(STYLES)) {
    const css = readFileSync(path, 'utf8')
    assert.doesNotMatch(stripComments(css), /--accent-link/, `${relative(STYLES, path)} still names --accent-link`)
    for (const { selectors, body } of rulesOf(css)) {
      if (!/var\(--accent-hover\)/.test(body)) continue
      reads += 1
      for (const selector of selectors) if (!selector.includes(':hover')) outside.push(`${relative(STYLES, path)}: ${selector}`)
    }
  }
  assert.ok(reads > 0, '--accent-hover should be read by the hover rules')
  assert.deepEqual(outside, [], 'a rule that is not a :hover rule reads --accent-hover (use the token that names its job)')
  const tokens = stripComments(readFileSync(join(STYLES, '..', 'tokens', 'colors.css'), 'utf8'))
  assert.match(tokens, /--accent-hover:\s*var\(--field\)/, 'colors.css defines --accent-hover')
  assert.doesNotMatch(tokens, /--accent-link/, 'colors.css no longer defines --accent-link')
})

// A door that is a CARD (the World Series hero's next-game card) restates what the shared rule
// draws for a line of text. The dotted rule belongs under a label, not under a card's title, its
// date line and its chevron, so the card says `text-decoration: none` for itself.
test('a card-shaped door draws no dotted rule', () => {
  const bodies = bodiesFor('worldseries/hero.css', '.door.ww-hero__next')
  assert.ok(bodies.length, '.door.ww-hero__next should have a rule')
  assert.ok(bodies.some((b) => /text-decoration:\s*none/.test(b)), 'the hero card turns the dotted rule off')
})

// One rule colours a door in a band: section-head.css, from the band's own ink. A page that keeps
// a colour of its own (the team page's Games band did) ends up disagreeing with it.
test('only the shared rule colours a door in a band', () => {
  const found = []
  for (const path of cssFiles(STYLES)) {
    for (const { selectors, body } of rulesOf(readFileSync(path, 'utf8'))) {
      if (!colours(body).length) continue
      for (const selector of selectors) {
        if (/sectionhead--band/.test(selector) && /\.door\b/.test(selector)) found.push(`${relative(STYLES, path)}: ${selector}`)
      }
    }
  }
  assert.deepEqual(found, ['system/section-head.css: .sectionhead--band .door--inline'])
})

// The two Clerk buttons are not links. They share the sign-in widget's ink, and only the footer
// link carries the dotted rule.
test('the sign-in widget keeps the dotted rule for its link, not its buttons', () => {
  const clerk = readFileSync(join(STYLES, '..', 'lib', 'clerkAppearance.js'), 'utf8')
  assert.match(clerk, /footerActionLink:\s*'tally-cl-link'/)
  assert.match(clerk, /profileSectionPrimaryButton:\s*'tally-cl-textbtn'/)
  assert.match(clerk, /formButtonReset:\s*'tally-cl-textbtn'/)
  const button = bodiesFor('04-site-bar.css', '.tally-cl-textbtn').join(';')
  assert.ok(button, '.tally-cl-textbtn should have a rule')
  assert.doesNotMatch(button, /underline/, 'a button does not draw the dotted rule')
})
