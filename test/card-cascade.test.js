// The section head's contract, asserted from the stylesheet text, the source
// tree and the pure class helper (#1113, slice H1a). Each of these would fail
// silently otherwise — lint green, the page rendering, only a screenshot
// noticing:
//
//   1. THE SLOT. system/section-head.css loads before 06, so every per-site
//      rule that places a head (a bleed, a corner) still wins on order.
//   2. ONE BAND. The six selectors that each painted the club band are gone,
//      from the stylesheets and from the markup, and the band is drawn once.
//   3. THE FALLBACKS. With no club, the band is the house navy with a kraft
//      line; a club head is a plain label and never falls back to navy or
//      kraft (#1113 Q2: both unthemed faces stay as they are).
//   4. THE HELPER. Label is the default; an unknown look and a band switch
//      on a quiet look are refused, not drawn as something else.
//   6. THE QUIET LOOKS. The label and the rule never read a club colour or
//      kraft, and the rule draws its leader (#1113 slice H2).
//   5. NO IMPORTS. SectionHead may render inside a SealBox reveal and beside
//      a stamp surface, so it imports no api/ module and no stamp module.
//
// Slice C0 adds Card beside the head (7 to 11 below): its slot, its one
// frame rule, its two frames, its class helper, and the retired .thub-card.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { sectionHeadClassName, sectionHeadTitleTag } from '../src/lib/design/sectionHeadClass.js'
import { cardAccentStyle, cardBodyClassName, cardClassName, cardTag } from '../src/lib/design/cardClass.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const STYLES = join(SRC, 'styles')

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const read = (rel) => stripComments(readFileSync(join(STYLES, rel), 'utf8'))

function ruleBody(css, selector) {
  let from = 0
  for (;;) {
    const at = css.indexOf(selector, from)
    if (at === -1) return null
    from = at + selector.length
    const before = at === 0 ? '\n' : css[at - 1]
    if (!'\n;}{,'.includes(before)) continue
    let i = from
    while (css[i] === ' ' || css[i] === '\n' || css[i] === '\r') i += 1
    if (css[i] !== '{') continue
    return css.slice(i + 1, css.indexOf('}', i))
  }
}

const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

function files(dir, ext, prefix = '') {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return files(abs, ext, `${prefix}${f}/`)
    return ext.some((e) => f.endsWith(e)) ? [`${prefix}${f}`] : []
  })
}

// ---- 1. the slot ----

test('system/section-head.css is imported before 06, so a host that places a head wins on order', () => {
  const imports = [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map(
    (m) => m[1],
  )
  const head = imports.indexOf('system/section-head.css')
  const six = imports.indexOf('06-loader-and-cards.css')
  assert.ok(head !== -1, 'index.css should import system/section-head.css')
  assert.ok(six !== -1)
  assert.ok(head < six, 'section-head.css must load before 06')
})

// ---- 2. one band ----

// The six painters #1113 names, and the element classes that went with them.
// `.metricbar__logo` is `.sectionhead__mark` now (slice H1b).
const RETIRED = [
  'metricbar',
  'metricbar__title',
  'metricbar__aside',
  'metricbar__logo',
  'thub-card__head',
  'tstats-card__head',
  'roster-super__head',
  'team-score__head',
  'section__title',
  'section__title--bar',
  'section__title--aside',
  'section__title--primary',
]
const retired = new RegExp(`\\.(${RETIRED.join('|')})(?![\\w-])`)
const retiredInMarkup = new RegExp(`["'\` ](${RETIRED.join('|')})(?![\\w-])[^"'\`]*["'\`]`)

test('no stylesheet paints a retired band class', () => {
  const found = files(STYLES, ['.css']).filter((rel) => retired.test(read(rel)))
  assert.deepEqual(found, [], 'these partials still name a class the SectionHead replaced')
})

test('no component renders a retired band class', () => {
  const found = files(SRC, ['.jsx', '.js'])
    .filter((rel) => !rel.startsWith('styles/'))
    .filter((rel) => {
      const code = readFileSync(join(SRC, rel), 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join('\n')
      return retiredInMarkup.test(code)
    })
  assert.deepEqual(found, [], 'these files still render a class the SectionHead replaced')
})

test('the band is drawn once: only system/section-head.css reads --bar-fill for a head', () => {
  const css = read('system/section-head.css')
  const band = ruleBody(css, '.sectionhead--band')
  assert.ok(band, 'a .sectionhead--band rule')
  const owners = files(STYLES, ['.css']).filter((rel) => /\.sectionhead[^{]*\{[^}]*--bar-fill/.test(read(rel)))
  assert.deepEqual(owners, ['system/section-head.css'])
})

// ---- 3. the fallbacks ----

test('with no club, the band is the house navy with a kraft line', () => {
  const band = ruleBody(read('system/section-head.css'), '.sectionhead--band')
  assert.equal(decl(band, '--band-fill'), 'var(--bar-fill, var(--navy))')
  assert.equal(decl(band, '--band-accent'), 'var(--bar-accent, var(--seal))')
  assert.equal(decl(band, '--band-text'), 'var(--bar-text, var(--text-on-ink))')
  assert.equal(decl(band, 'background'), 'var(--band-fill)')
  assert.equal(decl(band, 'border-bottom'), '3px solid var(--band-accent)')
  assert.equal(decl(band, 'color'), 'var(--band-text)')
})

test('the house band is navy and kraft whatever club the page wears', () => {
  // Two classes, so it beats the band's own --band-* defaults in any order.
  const house = ruleBody(read('system/section-head.css'), '.sectionhead--band.sectionhead--house')
  assert.ok(house, 'a .sectionhead--band.sectionhead--house rule')
  assert.equal(decl(house, '--band-fill'), 'var(--navy)')
  assert.equal(decl(house, '--band-accent'), 'var(--seal)')
  assert.equal(decl(house, '--band-text'), 'var(--text-on-ink)')
  assert.doesNotMatch(house, /--bar-/, 'the house band reads no club colour (ADR-0030)')
})

test('the paint travels alone: the band sets no layout, and only a real head gets corners', () => {
  const css = read('system/section-head.css')
  const band = ruleBody(css, '.sectionhead--band')
  for (const prop of ['padding', 'display', 'margin', 'border-radius', 'font-size']) {
    assert.equal(decl(band, prop), undefined, `.sectionhead--band sets no ${prop}; the innings heads keep their own`)
  }
  const corners = ruleBody(css, ':where(.sectionhead).sectionhead--band')
  assert.equal(decl(corners, 'border-radius'), 'var(--radius-md) var(--radius-md) 0 0')
})

test('every band in the innings view and the box score wears the band paint', () => {
  // The heads that drew their own navy and kraft before slice H1b. Each must
  // carry .sectionhead--band in its markup, or it draws no band at all now.
  const heads = {
    'components/gamehud/StatBox.jsx': ['statbox__title', 'abs__title'],
    'components/playbyplay/DueUpNextCard.jsx': ['dueup__title'],
    'components/inning/EnteringReference.jsx': ['lineupcard__title', 'lineupteam__name', 'halfdefense__title'],
    'components/inning/RosterPanel.jsx': ['roster__toggle'],
    'components/umpire/UmpireTendenciesFold.jsx': ['roster__toggle'],
    'components/charts/WinProbChart.jsx': ['winprob__head'],
    'components/inning/MarginNotes.jsx': ['marginnotes__title'],
    'components/inning/PitchersSection.jsx': ['pitchers__title'],
    'screens/BoxScore.jsx': ['abs__title', 'halfdefense__title'],
  }
  for (const [rel, classes] of Object.entries(heads)) {
    const code = readFileSync(join(SRC, rel), 'utf8')
    for (const cls of classes) {
      const own = new RegExp(`["\`]${cls}(?![\\w-])`)
      const uses = code.split('\n').filter((l) => own.test(l))
      assert.ok(uses.length > 0, `${rel} renders .${cls}`)
      for (const line of uses) assert.match(line, /sectionhead--band/, `${rel}: .${cls} wears the band paint`)
    }
  }
})

test('a club head is a plain label with no club, and never falls back to navy or kraft', () => {
  const css = read('system/section-head.css')
  const club = ruleBody(css, '.sectionhead--club')
  assert.equal(decl(club, 'background'), 'transparent')
  assert.equal(decl(club, 'color'), 'var(--text-caption)')
  assert.match(decl(club, 'border-bottom'), /^var\(--bw-hair\) solid/)
  const themed = ruleBody(css, '.is-themed .sectionhead--club')
  assert.equal(decl(themed, 'background'), 'var(--bar-fill, transparent)')
  assert.equal(decl(themed, 'border-bottom'), '3px solid var(--bar-accent, transparent)')
  for (const body of [club, themed]) assert.doesNotMatch(body, /--navy|--seal/)
})

test('the head names no font-weight: the display face ships one weight', () => {
  assert.doesNotMatch(read('system/section-head.css'), /font-weight/)
})

// ---- 4. the helper ----

test('the band and its two switches turn into classes', () => {
  assert.equal(sectionHeadClassName({ look: 'band' }), 'sectionhead sectionhead--band')
  assert.equal(
    sectionHeadClassName({ look: 'band', club: true, bleed: true, className: 'umptend__bar' }),
    'sectionhead sectionhead--band sectionhead--club sectionhead--bleed umptend__bar',
  )
})

test('label is the default look; an unknown look or a band switch on a quiet one is refused', () => {
  assert.equal(sectionHeadClassName(), 'sectionhead sectionhead--label')
  assert.equal(sectionHeadClassName({ look: 'rule' }), 'sectionhead sectionhead--rule')
  assert.throws(() => sectionHeadClassName({ look: 'navy' }), /unknown look/)
  assert.throws(() => sectionHeadClassName({ look: 'label', club: true }), /band switches/)
  assert.throws(() => sectionHeadClassName({ look: 'rule', bleed: true }), /band switches/)
})

// ---- 6. the quiet looks ----

test('the label and the rule read no club colour and no kraft', () => {
  const css = read('system/section-head.css')
  const quiet = [
    '.sectionhead--label',
    '.sectionhead--rule',
    '.sectionhead--rule .sectionhead__note',
    '.sectionhead--rule .sectionhead__title',
    '.sectionhead--rule .sectionhead__title::after',
  ]
  for (const sel of quiet) {
    const body = ruleBody(css, sel)
    assert.ok(body !== null, `${sel} is found`)
    assert.doesNotMatch(body, /--bar-|--seal|--navy/, sel)
  }
})

test('the label sits on a hairline and the rule draws a leader to its note', () => {
  const css = read('system/section-head.css')
  assert.match(decl(ruleBody(css, '.sectionhead--label'), 'border-bottom'), /^var\(--bw-hair\) solid/)
  const leader = ruleBody(css, '.sectionhead--rule .sectionhead__title::after')
  assert.ok(leader, 'a leader rule')
  assert.equal(decl(leader, 'height'), 'var(--bw-hair)')
  assert.equal(decl(leader, 'flex'), '1 1 auto')
})

test('the title is a heading or a span, nothing else', () => {
  assert.equal(sectionHeadTitleTag(), 'h3')
  for (const tag of ['h2', 'h3', 'h4', 'span']) assert.equal(sectionHeadTitleTag(tag), tag)
  assert.throws(() => sectionHeadTitleTag('div'))
})

// ---- 5. no imports ----

test('SectionHead imports no api/ module and no stamp module', () => {
  const code = readFileSync(join(SRC, 'components', 'ui', 'frame', 'SectionHead.jsx'), 'utf8')
  const imports = [...code.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
  assert.ok(imports.length > 0)
  for (const spec of imports) {
    assert.doesNotMatch(spec, /\/api\//, `${spec}: a head computes nothing`)
    assert.doesNotMatch(spec, /stamp/i, `${spec}: stamp art renders only on its own surfaces (ADR-0035)`)
  }
})

// ---- 7. the card's slot ----

test('system/card.css is imported right after section-head.css and before 06', () => {
  const imports = [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map(
    (m) => m[1],
  )
  const head = imports.indexOf('system/section-head.css')
  const card = imports.indexOf('system/card.css')
  const six = imports.indexOf('06-loader-and-cards.css')
  assert.ok(card !== -1, 'index.css should import system/card.css')
  assert.equal(card, head + 1, 'card.css sits right after section-head.css')
  assert.equal(six, card + 1, 'card.css sits right before 06, so every namespace rule wins on order')
})

// ---- 8. one frame rule ----

// Every rule in a stylesheet, as [selector, body], comments stripped.
const rules = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]])
const FRAME_PROPS = ['border', 'border-radius', 'box-shadow', 'overflow']
const drawsFrame = (body) => FRAME_PROPS.some((p) => decl(body, p) !== undefined)
const namesCard = (selector) => /\.card(?![\w-])|\.card--/.test(selector)

test('card.css draws the frame in exactly one rule, .card', () => {
  const framing = rules(read('system/card.css')).filter(([, body]) => drawsFrame(body))
  assert.deepEqual(
    framing.map(([sel]) => sel),
    ['.card'],
  )
  const card = ruleBody(read('system/card.css'), '.card')
  assert.equal(decl(card, 'border'), 'var(--bw-hair) solid var(--border-rule)')
  assert.equal(decl(card, 'background'), 'var(--surface-card)')
  assert.equal(decl(card, 'border-radius'), 'var(--card-radius)')
  assert.equal(decl(card, 'box-shadow'), 'var(--card-shadow)')
  assert.equal(decl(card, 'overflow'), 'hidden', 'the card clips a band head to its corners')
  for (const prop of ['margin', 'margin-top', 'margin-bottom', 'display', 'gap', 'padding']) {
    assert.equal(decl(card, prop), undefined, `.card sets no ${prop}: spacing and layout are the parent's and the namespace's`)
  }
})

test('no other stylesheet frames a card', () => {
  const found = files(STYLES, ['.css'])
    .filter((rel) => rel !== 'system/card.css')
    .flatMap((rel) =>
      rules(read(rel))
        .filter(([sel, body]) => namesCard(sel) && (drawsFrame(body) || decl(body, 'background') !== undefined))
        .map(([sel]) => `${rel}: ${sel}`),
    )
  assert.deepEqual(found, [])
})

// ---- 9. the two frames ----

test('the sheet is the md radius with the card shadow; the ledger is the sm radius with none', () => {
  const css = read('system/card.css')
  const sheet = ruleBody(css, '.card--sheet')
  const ledger = ruleBody(css, '.card--ledger')
  assert.equal(decl(sheet, '--card-radius'), 'var(--radius-md)')
  assert.equal(decl(sheet, '--card-shadow'), 'var(--shadow-card)')
  assert.equal(decl(ledger, '--card-radius'), 'var(--radius-sm)')
  assert.equal(decl(ledger, '--card-shadow'), 'none')
})

test('the padded body is the old team hub body', () => {
  assert.equal(decl(ruleBody(read('system/card.css'), '.card__body'), 'padding'), 'var(--space-3) var(--space-4) var(--space-4)')
})

test('club colour never reaches the card (ADR-0030)', () => {
  assert.doesNotMatch(read('system/card.css'), /--bar-|--seal|--navy/)
})

test('an interactive card tints with its accent and shows the focus ring', () => {
  const css = read('system/card.css')
  assert.match(css, /var\(--card-accent, var\(--border-rule\)\)/)
  assert.equal(decl(ruleBody(css, '.card--interactive:focus-visible'), 'outline'), 'var(--bw-heavy) solid var(--focus-ring)')
})

// ---- 10. the card's helper ----

test('sheet and padded are the defaults, and each prop turns into its class', () => {
  assert.equal(cardClassName(), 'card card--sheet')
  assert.equal(cardClassName({ frame: 'ledger', className: 'chal' }), 'card card--ledger chal')
  assert.equal(cardClassName({ as: 'a' }), 'card card--sheet card--interactive')
  assert.equal(cardClassName({ as: 'button', accent: '--offday-accent' }), 'card card--sheet card--interactive')
  assert.equal(cardBodyClassName(), 'card__body')
  assert.equal(cardBodyClassName('padded'), 'card__body')
  assert.equal(cardBodyClassName('flush'), null)
  assert.equal(cardTag(), 'section')
  for (const tag of ['section', 'div', 'article', 'li', 'aside', 'a', 'button']) assert.equal(cardTag(tag), tag)
  assert.deepEqual(cardAccentStyle('--offday-accent'), { '--card-accent': 'var(--offday-accent)' })
  assert.equal(cardAccentStyle(undefined), undefined)
})

test('an unknown frame, body or element, or an accent on a still card, is refused', () => {
  assert.throws(() => cardClassName({ frame: 'plain' }), /unknown frame/)
  assert.throws(() => cardClassName({ frame: 'report' }), /unknown frame/)
  assert.throws(() => cardBodyClassName('tight'), /unknown body/)
  assert.throws(() => cardTag('span'), /as="span"/)
  assert.throws(() => cardClassName({ accent: '--offday-accent' }), /interactive/)
  assert.throws(() => cardClassName({ as: 'div', accent: '--offday-accent' }), /interactive/)
  assert.throws(() => cardAccentStyle('#ff0000'), /custom property/)
})

test('Card imports no api/ module, no stamp module and no club theme', () => {
  const code = readFileSync(join(SRC, 'components', 'ui', 'frame', 'Card.jsx'), 'utf8')
  const imports = [...code.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
  assert.ok(imports.length > 0)
  for (const spec of imports) {
    assert.doesNotMatch(spec, /\/api\//, `${spec}: a card computes nothing`)
    assert.doesNotMatch(spec, /stamp/i, `${spec}: stamp art renders only on its own surfaces (ADR-0035)`)
    assert.doesNotMatch(spec, /headerTheme|teams\.js|identity/, `${spec}: a card takes no club colour (ADR-0030)`)
  }
})

// ---- 11. .thub-card is gone ----

// Strict: comments count too. A comment that names a retired class sends the
// next reader to a rule that does not exist.
const RETIRED_CARD = /(^|[^\w-])(thub-card|chalcard)(?![\w-])|(^|[^\w-])(thub-card|chalcard)__/

test('no stylesheet names .thub-card or .chalcard, not even in a comment', () => {
  const found = files(STYLES, ['.css']).filter((rel) => RETIRED_CARD.test(readFileSync(join(STYLES, rel), 'utf8')))
  assert.deepEqual(found, [])
})

test('no component or catalog names .thub-card or .chalcard', () => {
  const found = files(SRC, ['.jsx', '.js'])
    .filter((rel) => !rel.startsWith('styles/'))
    .filter((rel) => RETIRED_CARD.test(readFileSync(join(SRC, rel), 'utf8')))
  assert.deepEqual(found, [])
})

test('the team hub keeps its space between cards, from the hub and not from Card', () => {
  const hub = ruleBody(read('09-team-info.css'), '.team-hub :where(.card)')
  assert.ok(hub, 'a .team-hub :where(.card) rule')
  assert.equal(decl(hub, 'margin-top'), 'var(--space-4)')
})
