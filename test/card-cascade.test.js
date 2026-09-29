// The section head's contract, asserted from the stylesheet text, the source
// tree and the pure class helper (#1113, slice H1a). Each of these would fail
// silently otherwise — lint green, the page rendering, only a screenshot
// noticing:
//
//   1. THE SLOT. system/section-head.css loads before 06, so every per-site
//      rule that places a head (a bleed, a corner) still wins on order.
//   2. ONE BAND. The six selectors that each painted the club band are gone,
//      from the stylesheets and from the markup, and the band is drawn once.
//   3. THE FALLBACKS. With no club, the band is the house navy with a
//      pencil-rule line (--band-rule; kraft until #1151, ADR-0083); a club
//      head is a plain label and never falls back to navy or kraft.
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
import { dirname, join, relative } from 'node:path'
import { sectionHeadClassName, sectionHeadTitleTag } from '../src/lib/design/sectionHeadClass.js'
import { cardAccentStyle, cardBodyClassName, cardClassName, cardHead, cardTag } from '../src/lib/design/cardClass.js'

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

test('with no club, the band is the house navy with a pencil-rule line, not kraft (#1151)', () => {
  const band = ruleBody(read('system/section-head.css'), '.sectionhead--band')
  assert.equal(decl(band, '--band-fill'), 'var(--bar-fill, var(--navy))')
  assert.equal(decl(band, '--band-accent'), 'var(--bar-accent, var(--band-rule))')
  assert.equal(decl(band, '--band-text'), 'var(--bar-text, var(--text-on-ink))')
  assert.equal(decl(band, 'background'), 'var(--band-fill)')
  assert.equal(decl(band, 'border-bottom'), '3px solid var(--band-accent)')
  assert.equal(decl(band, 'color'), 'var(--band-text)')
})

test('the house band is navy and the pencil rule whatever club the page wears', () => {
  // Two classes, so it beats the band's own --band-* defaults in any order.
  const house = ruleBody(read('system/section-head.css'), '.sectionhead--band.sectionhead--house')
  assert.ok(house, 'a .sectionhead--band.sectionhead--house rule')
  assert.equal(decl(house, '--band-fill'), 'var(--navy)')
  assert.equal(decl(house, '--band-accent'), 'var(--band-rule)')
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
    'components/inning/EnteringReference.jsx': ['entering__title', 'lineupteam__name', 'halfdefense__title'],
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
// Any edge, corner, shadow or ground, longhands included.
const paintsFrame = (body) =>
  body
    .split(';')
    .map((d) => d.trim())
    .some((d) => /^(border|background|box-shadow)[\w-]*\s*:/.test(d))
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
        .filter(([sel, body]) => namesCard(sel) && paintsFrame(body))
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
  assert.throws(() => cardClassName({ as: 'span' }), /as="span"/)
})

test('a link or button card takes no head: it holds phrasing content only', () => {
  assert.throws(() => cardHead('button', 'Head'), /no head/)
  assert.throws(() => cardHead('a', 'Head'), /no head/)
  assert.equal(cardHead('button', undefined), undefined)
  assert.equal(cardHead('section', 'Head'), 'Head')
})

test('the padded body says display: block, so it can be a span in a link card', () => {
  assert.equal(decl(ruleBody(read('system/card.css'), '.card__body'), 'display'), 'block')
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
  const hub = ruleBody(read('09-team-info.css'), '.team-hub :where(.card):not(:where(.card .card))')
  assert.ok(hub, 'a hub rule for a top-level card only; a card inside a card is a tile')
  assert.equal(decl(hub, 'margin-top'), 'var(--space-4)')
})

// ---- 12. slice C1: the rest of the team hub ----

// The thirteen hub blocks that drew their own copy of the card. Each one is a
// Card now, and its namespace rule keeps only what is its own: the layout, the
// padding, the space above it. `keep` names the one frame property a block
// may still set, because it is that block's look and not the frame: the
// jersey tile's per-jersey tint, the alumni card's inset ring, and the
// contract tile's 3px top rule.
const C1 = [
  { css: '23-box-score-detail.css', sel: '.tlead__cat', jsx: 'components/teamstats/TeamLeaders.jsx', ns: 'tlead__cat' },
  { css: '23-box-score-detail.css', sel: '.tledg__block', jsx: 'components/teamstats/TeamLeadersLedger.jsx', ns: 'tledg__block' },
  { css: '28-team-hub.css', sel: '.jerseydeck__card', jsx: 'components/logo/JerseyCombos.jsx', ns: 'jerseydeck__card', keep: ['background'] },
  { css: '28-team-hub.css', sel: '.team-score', jsx: 'components/teamstats/TeamScoreCard.jsx', ns: 'team-score' },
  { css: '29-team-transactions.css', sel: '.txstory', jsx: 'components/transactions/TxStory.jsx', ns: 'txstory' },
  { css: '31-wild-card.css', sel: '.tstats', jsx: 'screens/team/modules/TeamStatsCard.jsx', ns: 'tstats' },
  { css: '31-wild-card.css', sel: '.roster-super', jsx: 'screens/team/modules/RosterProjection.jsx', ns: 'roster-super' },
  { css: '31-wild-card.css', sel: '.thub-affiliate', jsx: 'screens/team/modules/minors/AffiliatesCard.jsx', ns: 'thub-affiliate' },
  { css: '31-wild-card.css', sel: '.horizontile', jsx: 'screens/team/modules/minors/DepthChartCard.jsx', ns: 'horizontile' },
  { css: '31-wild-card.css', sel: '.hzntile', jsx: 'screens/team/modules/minors/HorizonCard.jsx', ns: 'hzntile' },
  { css: '64-milb-alumni.css', sel: '.alum__card', jsx: 'components/teamstats/MilbAlumni.jsx', ns: 'alum__card', keep: ['box-shadow'] },
  { css: '70-contracts-grid.css', sel: '.ctr__tile', jsx: 'screens/team/ContractsTab.jsx', ns: 'ctr__tile', keep: ['border-top'] },
  { css: '70-contracts-grid.css', sel: '.ctr__card', jsx: 'components/salaries/ContractGrid.jsx', ns: 'ctr__card' },
]
const FRAME_DECL = /^(border|border-radius|background|box-shadow|overflow)\s*:/

test('C1: no hub block draws a second frame over its Card', () => {
  for (const { css, sel, keep = [] } of C1) {
    const body = ruleBody(read(css), sel)
    if (body === null) continue // the whole rule was the frame, and it is gone
    const extra = body
      .split(';')
      .map((d) => d.trim())
      .filter((d) => FRAME_DECL.test(d))
      .filter((d) => !keep.some((k) => d.startsWith(`${k}:`)))
    assert.deepEqual(extra, [], `${css}: ${sel} still draws its own frame`)
  }
})

test('C1: every hub block renders on Card, never on a bare element', () => {
  for (const { jsx, ns } of C1) {
    const code = readFileSync(join(SRC, jsx), 'utf8')
    assert.match(code, /<Card[\s>]/, `${jsx} renders a Card`)
    const bare = new RegExp(`<(div|section|li|article)\\s+(key=\\{[^}]+\\}\\s+)?className=\\{?["'\`]${ns}(?![\\w-])`)
    assert.doesNotMatch(code, bare, `${jsx}: .${ns} is on a bare element`)
  }
})

test('C1: the all-star rosters page wears the roster card on Card too', () => {
  const code = readFileSync(join(SRC, 'screens', 'AllStarRostersPage.jsx'), 'utf8')
  assert.doesNotMatch(code, /<div className="roster-super"/)
})

test('C1: the contract tile is a ledger and keeps its 3px top rule', () => {
  const tab = readFileSync(join(SRC, 'screens', 'team', 'ContractsTab.jsx'), 'utf8')
  assert.match(tab, /frame="ledger"/)
  assert.equal(decl(ruleBody(read('70-contracts-grid.css'), '.ctr__tile'), 'border-top'), '3px solid var(--border-rule)')
})

test('C1: the alumni card keeps its inset ring over the card shadow', () => {
  const body = ruleBody(read('64-milb-alumni.css'), '.alum__card')
  assert.equal(decl(body, 'box-shadow'), 'inset 0 0 0 3px var(--bg-canvas), var(--shadow-card)')
})

// The two-step rename (ADR-0084 ledger): the card is .tstats, and the grid
// that held that name is .tstats__grid. Strict, comments too.
const RETIRED_TSTATS = /(^|[^\w-])tstats-card(?![\w])/

test('C1: .tstats-card is gone, from stylesheets, markup and comments', () => {
  const css = files(STYLES, ['.css']).filter((rel) => RETIRED_TSTATS.test(readFileSync(join(STYLES, rel), 'utf8')))
  const code = files(SRC, ['.jsx', '.js'])
    .filter((rel) => !rel.startsWith('styles/'))
    .filter((rel) => RETIRED_TSTATS.test(readFileSync(join(SRC, rel), 'utf8')))
  assert.deepEqual([...css, ...code], [])
})

test('C1: the stat grid is .tstats__grid, and no rule still sizes a bare .tstats as a grid', () => {
  const wild = read('31-wild-card.css')
  assert.equal(decl(ruleBody(wild, '.tstats__grid'), 'display'), 'grid')
  assert.equal(decl(ruleBody(wild, '.tstats') ?? '', 'display'), undefined)
})

// A grid track sized `1fr` has a min of `auto`, so it cannot shrink below its
// widest row. On /leaders/org a chaser row carries a name, a club, a level tag
// and a prospect tag on one line, and that row pushed the column to 418px on a
// 390px phone (#1184). Card's `overflow: hidden` hides this today, because a
// clipping grid item's automatic minimum is zero. The leader grid must not lean
// on that clip: its tracks say `minmax(0, 1fr)` themselves.
test('the leader card grid lets its columns shrink below the widest row', () => {
  const css = read('23-box-score-detail.css')
  const columns = [...css.matchAll(/\.tlead__grid\s*\{([^}]*)\}/g)].map((m) => decl(m[1], 'grid-template-columns'))
  assert.equal(columns.length, 2, 'the phone rule and the 560px rule')
  for (const value of columns) assert.doesNotMatch(value.replaceAll('minmax(0, 1fr)', ''), /1fr/, `.tlead__grid uses a bare 1fr track (${value}); write minmax(0, 1fr)`)
})

// Kraft means "sealed" and nothing else (ADR-0083). A band's underline lifts no
// seal, so no band reads the seal: not the house band, not an unthemed club
// band, not the game HUD, not the pitch slab, not the identity lab's mocks
// (#1151). Their line is --band-rule, a pencil rule.
test('no band underline reads the seal', () => {
  const tokens = readFileSync(join(SRC, 'tokens', 'colors.css'), 'utf8')
  assert.match(tokens, /--band-rule:\s*var\(--border-rule\);/)
  const bands = [
    ['system/section-head.css', '.sectionhead--band'],
    ['system/section-head.css', '.sectionhead--band.sectionhead--house'],
    ['focus/console.css', '.gamehud--console'],
    ['69-pitch-arsenal.css', '.pitchslab__head'],
    ['69-pitch-arsenal.css', '.pitchslab__heat'],
    ['17-identity-lab-workbench.css', '.idlab__barmock'],
    ['62-identity-admin.css', '.idlab__barmock'],
  ]
  for (const [rel, sel] of bands) {
    const body = ruleBody(read(rel), sel)
    assert.ok(body, `${rel} should still have ${sel}`)
    assert.doesNotMatch(body, /--seal/, `${sel} in ${rel} reads the seal`)
    assert.match(body, /--band-rule/, `${sel} in ${rel} should draw its line in --band-rule`)
  }
})

// ---- 13. slice C2: the player page ----

// The seventeen player-page blocks that drew their own copy of the card. Each
// renders through Card now, one of two ways:
//   card  the Card IS the block: it carries the block's class, and the
//         namespace rule keeps the block's margin, padding and layout.
//   wrap  the Card wraps the block's list or grid, which keeps its class, its
//         own inset and its row rules. Used where the old frame sat on a
//         <ul>, <ol> or a gap-rule grid, and the block had no margin of its own.
// Every one takes body="flush": each block keeps its own padding, which is
// not the padded body's, so its layout does not move. `keep` names a frame
// property that is the block's own look, not the frame: a gap-rule grid's
// --border-rule ground, the 3px accent rule on the two dossier cards, and the
// ball-flight popover's raised shadow. `.awards` and `.awardblk` swap the
// frame at 740px, so they have a test of their own below.
const C2 = [
  { css: '26-player-page.css', sel: '.player__statgrid', jsx: ['screens/player/parts.jsx', 'components/playerstats/SplitsVsTeam.jsx'], ns: 'player__statgrid', mode: 'wrap', keep: ['background'] },
  { css: '26-player-page.css', sel: '.player__splits', jsx: ['screens/player/PlayerHistoryTab.jsx'], ns: 'player__splits', mode: 'wrap', keep: ['background'] },
  { css: '26-player-page.css', sel: '.vsteam__last', jsx: ['components/playerstats/SplitsVsTeam.jsx'], ns: 'vsteam__last', frame: 'ledger' },
  { css: '26-player-page.css', sel: '.gamelog', jsx: ['components/player/GameLog.jsx'], ns: 'gamelog' },
  { css: '26-player-page.css', sel: '.milestonewatch', jsx: ['components/playerstats/MilestoneWatchCard.jsx'], ns: 'milestonewatch' },
  { css: '26e-contract-history.css', sel: '.cthist__seasons', jsx: ['components/player/ContractHistoryLedger.jsx'], ns: 'cthist__seasons', mode: 'wrap' },
  { css: '27-player-position-innings.css', sel: '.posinn__diamond', jsx: ['components/player/PositionInnings.jsx'], ns: 'posinn__diamond', keep: ['background'] },
  { css: '31d-prospect-card.css', sel: '.levelprog', jsx: ['components/player/LevelProgressionCard.jsx'], ns: 'levelprog', frame: 'ledger', keep: ['border-top'] },
  { css: '31d-prospect-card.css', sel: '.prospectcard', jsx: ['components/playerstats/ProspectCard.jsx'], ns: 'prospectcard', frame: 'ledger', keep: ['border-top'] },
  { css: '51-similar-players.css', sel: '.simlike__link', jsx: ['components/playercard/SimilarPlayerGrid.jsx'], ns: 'simlike__link' },
  { css: '69-hit-chart.css', sel: '.hitchart', jsx: ['components/charts/HitChart.jsx'], ns: 'hitchart' },
  { css: '69-hit-chart.css', sel: '.bflight', jsx: ['components/charts/BallFlight.jsx'], ns: 'bflight', keep: ['box-shadow'] },
  { css: '73-spray-map.css', sel: '.spray', jsx: ['components/charts/SprayMap.jsx'], ns: 'spray' },
  // Four of these panels stack, so they are ledgers: no shadow (gamelines.css).
  { css: 'boxlines/gamelines.css', sel: '.gamelines__rows', jsx: ['components/playerstats/GameLinesCard.jsx'], ns: 'gamelines__rows', mode: 'wrap', frame: 'ledger' },
  // .factgrid: the Card is the block and keeps its margin; the gap-rule grid
  // is the inner .factgrid__grid. FactGrid draws both, once; eight files
  // render a FactGrid (FACT_GRID_USERS below).
  { css: '09-team-info.css', sel: '.factgrid', jsx: ['components/ui/frame/FactGrid.jsx'], ns: 'factgrid' },
]
const FACT_GRID_USERS = [
  'components/charts/CommandMap.jsx',
  'components/charts/SprayMap.jsx',
  'components/inning/focus/ExtrasFacts.jsx',
  'components/player/AdvancedStatsCard.jsx',
  'components/playerstats/FoulCard.jsx',
  'components/playerstats/PitcherWorkloadCard.jsx',
  'screens/PlayerPage.jsx',
  'screens/TeamInfo.jsx',
]

// Every rule whose whole selector is `sel`, inside a media query too.
const bodiesOf = (css, sel) => rules(css).filter(([s]) => s === sel).map(([, body]) => body)
const frameDecls = (body, keep = []) =>
  body
    .split(';')
    .map((d) => d.trim())
    .filter((d) => FRAME_DECL.test(d))
    .filter((d) => !keep.some((k) => d.startsWith(`${k}:`)))
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
// The attributes of each <Card …> opening tag in a file.
const cardTags = (code) => [...code.matchAll(/<Card\b([^>]*)>/g)].map((m) => m[1])
const namesClass = (attrs, ns) => new RegExp(`className=\\{?["'\`][^"'\`]*(?<![\\w-])${ns}(?![\\w-])`).test(attrs)
// The attributes of each Card whose first child is an element of class `ns`.
const wrappingTags = (code, ns) =>
  [...code.matchAll(/<Card\b([^>]*)>\s*<(?:div|ol|ul|dl)\b[^>]*?className=\{?["'`]([\w-]+)/g)]
    .filter((m) => m[2] === ns)
    .map((m) => m[1])
const bareUse = (ns) =>
  new RegExp(`<(div|section|li|article|ul|ol|dl)\\s+(key=\\{[^}]+\\}\\s+)?className=\\{?["'\`]${ns}(?![\\w-])`)

test('C2: no player-page block draws a second frame over its Card', () => {
  for (const { css, sel, keep = [] } of C2) {
    for (const body of bodiesOf(read(css), sel)) {
      assert.deepEqual(frameDecls(body, keep), [], `${css}: ${sel} still draws its own frame`)
    }
  }
})

test('C2: every player-page block renders on Card, with its frame and a flush body', () => {
  for (const { jsx, ns, mode = 'card', frame = 'sheet' } of C2) {
    for (const rel of jsx) {
      const code = src(rel)
      assert.match(code, /import \{ Card \} from ["'](?:[\w./]+\/ui\/frame|\.)\/Card\.jsx["']/, `${rel} imports Card`)
      const tags = mode === 'wrap' ? wrappingTags(code, ns) : cardTags(code).filter((attrs) => namesClass(attrs, ns))
      assert.ok(tags.length > 0, `${rel}: .${ns} renders ${mode === 'wrap' ? 'inside' : 'on'} a Card`)
      for (const attrs of tags) {
        assert.match(attrs, /body="flush"/, `${rel}: .${ns}'s Card keeps the block's own padding`)
        if (frame === 'ledger') assert.match(attrs, /frame="ledger"/, `${rel}: .${ns} is a ledger`)
        else assert.doesNotMatch(attrs, /frame=/, `${rel}: .${ns} is a sheet (the default)`)
      }
      if (mode === 'card') assert.doesNotMatch(code, bareUse(ns), `${rel}: .${ns} is on a bare element`)
      if (mode === 'wrap') {
        const uses = code.match(new RegExp(`className=\\{?["'\`]${ns}(?![\\w-])`, 'g')) ?? []
        assert.equal(uses.length, tags.length, `${rel}: every .${ns} sits inside a Card`)
      }
    }
  }
})

// The gap-rule grid (#1113 spec): the rules between cells are the grid's own
// --border-rule ground showing through 1px gaps. Card paints --surface-card,
// so that ground moved to the grid inside the Card, and the grid draws no
// edge, corner or shadow of its own.
test('C2: the three gap-rule grids keep their rules inside the Card', () => {
  const grids = [
    ['09-team-info.css', '.factgrid__grid'],
    ['26-player-page.css', '.player__statgrid'],
    ['26-player-page.css', '.player__splits'],
  ]
  for (const [css, sel] of grids) {
    const body = ruleBody(read(css), sel)
    assert.ok(body, `${css}: a ${sel} rule`)
    assert.equal(decl(body, 'display'), 'grid', sel)
    assert.equal(decl(body, 'gap'), '1px', sel)
    assert.equal(decl(body, 'background'), 'var(--border-rule)', sel)
    assert.deepEqual(frameDecls(body, ['background']), [], `${sel} draws no frame of its own`)
  }
  const outer = ruleBody(read('09-team-info.css'), '.factgrid')
  assert.equal(decl(outer, 'margin'), '0 0 18px', 'the fact card keeps its margin; Card owns none')
  assert.equal(decl(outer, 'display'), undefined, '.factgrid is the card now, not the grid')
})

// The Card and the grid inside it are drawn in one place, so the eight fact
// grids cannot drift apart: each file renders a FactGrid, never the pair.
test('C2: every fact grid is a FactGrid: one .factgrid__grid inside one .factgrid Card', () => {
  const grid = src('components/ui/frame/FactGrid.jsx')
  assert.equal(cardTags(grid).filter((attrs) => namesClass(attrs, 'factgrid')).length, 1)
  assert.equal((grid.match(/className="factgrid__grid"/g) ?? []).length, 1)
  for (const rel of FACT_GRID_USERS) {
    const code = src(rel)
    assert.match(code, /import \{ FactGrid \} from ["'][\w./]+\/ui\/frame\/FactGrid\.jsx["']/, `${rel} imports FactGrid`)
    assert.match(code, /<FactGrid[\s>]/, `${rel} renders a FactGrid`)
    assert.doesNotMatch(code, /factgrid__grid/, `${rel} builds no fact grid of its own`)
    assert.equal(cardTags(code).filter((attrs) => namesClass(attrs, 'factgrid')).length, 0, `${rel}: no hand-built .factgrid Card`)
  }
  // The co-classes that sized the old grid now size its inner grid.
  assert.equal(decl(ruleBody(read('73-spray-map.css'), '.spray__facts .factgrid__grid'), 'grid-template-columns'), 'repeat(4, 1fr)')
  assert.equal(decl(ruleBody(read('focus/reference.css'), '.refextras__grid .factgrid__grid'), 'grid-template-columns'), '1fr')
})

test('C2: the game log is a .gamelog Card holding a .gamelog__list', () => {
  assert.match(src('components/player/GameLog.jsx'), /<ul className="gamelog__list">/)
  const outer = ruleBody(read('26-player-page.css'), '.gamelog')
  assert.equal(decl(outer, 'margin'), '8px 0 0')
  assert.equal(decl(outer, 'list-style'), undefined)
})

// Issue #1113, comment 2: the contract ledger's "Show all" foot is a Door. It
// keeps its one useState; the Door (a <button> with no href) draws the look.
test('C2: the contract ledger toggle is a block Door', () => {
  const code = src('components/player/ContractHistoryLedger.jsx')
  assert.match(code, /import \{ Door \} from '\.\.\/ui\/control\/Door\.jsx'/)
  assert.doesNotMatch(code, /<button[^>]*cthist__toggle/)
  const doors = code.match(/<Door layout="block" className="cthist__toggle"/g) ?? []
  assert.equal(doors.length, 2, 'Show all, and Show fewer')
  const css = read('26e-contract-history.css')
  const toggle = ruleBody(css, '.cthist__toggle')
  for (const prop of ['border', 'border-radius', 'background', 'color', 'font-family', 'font-size', 'cursor', 'appearance']) {
    assert.equal(decl(toggle, prop), undefined, `.cthist__toggle sets no ${prop}: the Door draws it`)
  }
  assert.equal(ruleBody(css, '.cthist__toggle:hover'), null)
  assert.equal(ruleBody(css, '.cthist__toggle:focus-visible'), null)
})

test('C2: the two dossier cards are ledgers and keep their 3px accent rule', () => {
  for (const sel of ['.levelprog', '.prospectcard']) {
    assert.equal(decl(ruleBody(read('31d-prospect-card.css'), sel), 'border-top'), '3px solid var(--accent-primary)', sel)
  }
})

// The tile was a PlayerLink <button>; it is a Card link now (as="a"), a real
// anchor, so a middle-click opens a tab. It keeps the desktop hover card that
// PlayerLink gave it, and it takes its path and that card from the same hook
// PlayerLink uses, so a player URL is built in one place. A row with no
// personId is a name, not a link, as it was under PlayerLink.
test('C2: a similar-player tile is a Card link that keeps the hover card', () => {
  const code = src('components/playercard/SimilarPlayerGrid.jsx')
  const tiles = cardTags(code).filter((attrs) => namesClass(attrs, 'simlike__link'))
  assert.ok(tiles.some((attrs) => /as="a"/.test(attrs)), 'a Card link carries .simlike__link')
  assert.ok(tiles.some((attrs) => /as="div"/.test(attrs)), 'with no id, the tile is a plain Card, not a link')
  assert.match(code, /if \(!path\)/, 'the tile checks for a missing path before it renders a link')
  assert.doesNotMatch(code, /<PlayerLink[^>]*simlike__link/)
  assert.match(code, /import \{ usePlayerLink \} from '\.\.\/player\/PlayerLink\.jsx'/)
  assert.match(code, /usePlayerLink\(/)
  assert.doesNotMatch(code, /playerPath\(/, 'the tile builds no player URL of its own')
  for (const body of bodiesOf(read('51-similar-players.css'), '.simlike__link:hover')) {
    assert.equal(decl(body, 'background'), undefined, 'the interactive Card owns the hover tint')
  }
})

// src/lib is pure data and pure functions, no React (src/lib/CLAUDE.md). The
// hover store is the plain external store; the trigger's hook that writes to it
// lives with PlayerLink, in the component layer.
test('the player hover store imports no React and no hook', () => {
  const code = src('lib/playerHoverStore.js')
  assert.doesNotMatch(code, /from ['"]react['"]/)
  assert.doesNotMatch(code, /from ['"][\w./]*\/hooks\//)
  assert.doesNotMatch(code, /export function use[A-Z]/)
})

// The ball-flight card floats over the feed, as a popover or a sheet, so it
// keeps the raised shadow a floating layer wears. Card owns its edge.
test('C2: the ball-flight card keeps its raised shadow', () => {
  assert.equal(decl(ruleBody(read('69-hit-chart.css'), '.bflight'), 'box-shadow'), 'var(--shadow-raised)')
})

// Narrow, ONE card holds every award table, divided by hairlines. From 740px
// the tables pair off and each table is its own card, so the outer block is
// only the grid. Card draws the frame in both cases, and the CSS never strips
// one: AwardsLedger picks the framed element from the same WIDE_QUERY.
test('C2: the awards ledger frames the whole ledger narrow and each table wide', () => {
  const code = src('components/player/AwardsLedger.jsx')
  const tags = cardTags(code)
  assert.ok(tags.some((attrs) => namesClass(attrs, 'awards') && /body="flush"/.test(attrs)), 'the narrow ledger is a Card')
  assert.ok(tags.some((attrs) => namesClass(attrs, 'awardblk') && /body="flush"/.test(attrs)), 'a wide table is a Card')
  for (const attrs of tags) assert.doesNotMatch(attrs, /frame=/, 'both are sheets')
  const css = read('67-awards-ledger.css')
  for (const sel of ['.awards', '.awards--preview', '.awardblk']) {
    for (const body of bodiesOf(css, sel)) assert.deepEqual(frameDecls(body), [], `${sel} draws or strips no frame`)
  }
})

// The level card's stylesheet was loaded only by ProspectCard.jsx, so on a
// player's History tab (where the level card renders and the prospect card
// does not) a direct load drew the card with none of its own rules: no frame,
// no head, no path. On Card it would have drawn the frame and still none of
// the rest. The card now loads the partial it is drawn by.
test('C2: the level card loads its own stylesheet', () => {
  assert.match(src('components/player/LevelProgressionCard.jsx'), /^import '\.\.\/\.\.\/styles\/31d-prospect-card\.css'$/m)
})

// ---- 14. slice C4: the innings viewer and the game HUD ----

// The thirteen innings-view and HUD blocks that drew their own copy of the
// card. SPOILER SCOPE: each one is a box move and nothing else. The Card IS
// the block (it carries the block's class), and the namespace rule keeps the
// block's margin, its own inset and its layout. Every Card here takes
// body="flush": each block has its own padding, or none, and the padded body's
// is neither, so a padded body would move the layout (C2 did the same). Each
// band head stays the Card's first child, exactly as H1b left it.
//
// Two renames ride with the slice (ADR-0084 ledger): the entering-lineup card
// .lineupcard is .entering, and the wide ABS frame .abscard is .absframe (not
// .abs, which is the ABS block inside it).
const C4 = [
  // The whole .half rule was the frame, so it is gone (`gone`).
  { css: '11-innings.css', sel: '.half', jsx: ['components/inning/HalfInning.jsx'], ns: 'half', gone: true },
  { css: '12-sealbox.css', sel: '.statbox', jsx: ['components/gamehud/StatBox.jsx'], ns: 'statbox' },
  { css: '12-sealbox.css', sel: '.dueup', jsx: ['components/playbyplay/DueUpNextCard.jsx'], ns: 'dueup' },
  { css: '12-sealbox.css', sel: '.entering', jsx: ['components/inning/EnteringReference.jsx'], ns: 'entering' },
  { css: '12-sealbox.css', sel: '.halfdefense', jsx: ['components/inning/EnteringReference.jsx'], ns: 'halfdefense' },
  // The focus-mode umpire drawer wears the same drawer (UmpireTendenciesFold).
  {
    css: '13-play-by-play.css',
    sel: '.roster',
    jsx: ['components/inning/RosterPanel.jsx', 'components/umpire/UmpireTendenciesFold.jsx'],
    ns: 'roster',
  },
  // The Card IS the scroller: its own overflow-x wins over the Card's clip.
  { css: '20-charts.css', sel: '.rolling__scroll', jsx: ['components/gamehud/RollingLine.jsx'], ns: 'rolling__scroll' },
  { css: '20-charts.css', sel: '.winprob', jsx: ['components/charts/WinProbChart.jsx'], ns: 'winprob' },
  { css: '20-charts.css', sel: '.marginnotes', jsx: ['components/inning/MarginNotes.jsx'], ns: 'marginnotes' },
  // ADR-0009: the table is gated by revealedThrough in the caller, not here.
  { css: '20-charts.css', sel: '.pitchers', jsx: ['components/inning/PitchersSection.jsx'], ns: 'pitchers' },
  // The animation lab draws the real tally, so it wears the real frame too.
  { css: 'focus/console.css', sel: '.halftally', jsx: ['components/gamehud/HalfTally.jsx', 'screens/AnimationLab.jsx'], ns: 'halftally' },
  { css: 'focus/console.css', sel: '.betweeninnings', jsx: ['components/gamehud/BetweenInnings.jsx'], ns: 'betweeninnings', as: 'button' },
  { css: '25-wide-layout.css', sel: '.absframe', jsx: ['components/gamehud/StatBox.jsx'], ns: 'absframe' },
]
const bareC4 = (ns) =>
  new RegExp(`<(div|section|li|article|button)\\s+(type="button"\\s+)?(key=\\{[^}]+\\}\\s+)?className=\\{?["'\`]${ns}(?![\\w-])`)

test('C4: no innings-view or HUD block draws a second frame over its Card', () => {
  for (const { css, sel, gone } of C4) {
    const bodies = bodiesOf(read(css), sel)
    if (gone) assert.equal(bodies.length, 0, `${css}: ${sel} was only a frame, so it has no rule`)
    else assert.ok(bodies.length > 0, `${css}: a ${sel} rule`)
    for (const body of bodies) assert.deepEqual(frameDecls(body), [], `${css}: ${sel} still draws its own frame`)
  }
})

test('C4: every innings-view and HUD block renders on Card, a sheet with a flush body', () => {
  for (const { jsx, ns, as } of C4) {
    for (const rel of jsx) {
      const code = src(rel)
      assert.match(code, /import \{ Card \} from ["'][\w./]+\/ui\/frame\/Card\.jsx["']/, `${rel} imports Card`)
      const tags = cardTags(code).filter((attrs) => namesClass(attrs, ns))
      assert.ok(tags.length > 0, `${rel}: .${ns} renders on a Card`)
      for (const attrs of tags) {
        assert.match(attrs, /body="flush"/, `${rel}: .${ns}'s Card keeps the block's own inset`)
        assert.doesNotMatch(attrs, /frame=/, `${rel}: .${ns} is a sheet (the default)`)
        if (as) assert.match(attrs, new RegExp(`as="${as}"`), `${rel}: .${ns} is a Card ${as}`)
        assert.doesNotMatch(attrs, /head=/, `${rel}: .${ns} keeps its band head as its first child, as H1b left it`)
      }
      assert.doesNotMatch(code, bareC4(ns), `${rel}: .${ns} is on a bare element`)
    }
  }
})

// Card owns no margin, and a flush body adds no padding, so each block keeps
// the space and the inset it had, in its own namespace rule.
test('C4: each block keeps its own margin and inset', () => {
  const kept = [
    ['12-sealbox.css', '.entering', 'margin', '12px 14px 0'],
    ['12-sealbox.css', '.halfdefense', 'margin', '12px 14px 0'],
    ['12-sealbox.css', '.statbox', 'min-width', '0'],
    ['12-sealbox.css', '.dueup', 'padding', 'var(--space-3) var(--space-3h)'],
    ['13-play-by-play.css', '.roster', 'margin-top', '10px'],
    ['20-charts.css', '.winprob', 'margin-bottom', 'var(--space-4)'],
    ['20-charts.css', '.winprob', 'padding', 'var(--space-3) var(--space-3h) var(--space-2h)'],
    ['20-charts.css', '.marginnotes', 'margin-top', 'var(--space-4)'],
    ['20-charts.css', '.marginnotes', 'margin-bottom', 'var(--space-3)'],
    ['20-charts.css', '.marginnotes', 'padding', 'var(--space-3) var(--space-3h) var(--space-2)'],
    ['20-charts.css', '.pitchers', 'margin-top', 'var(--space-4)'],
    ['20-charts.css', '.pitchers', 'padding', 'var(--space-3) var(--space-3h) var(--space-2)'],
    ['focus/console.css', '.halftally', 'margin', '0'],
    ['focus/console.css', '.halftally', 'min-width', '0'],
    ['focus/console.css', '.betweeninnings', 'padding', 'var(--space-3)'],
  ]
  for (const [css, sel, prop, value] of kept) {
    assert.equal(decl(ruleBody(read(css), sel) ?? '', prop), value, `${css}: ${sel} keeps ${prop}: ${value}`)
  }
})

// The running line scrolls sideways. The Card is the scroller, so its own
// overflow-x (a later partial) wins over the Card's clip on that axis.
test('C4: the running line is still a horizontal scroller', () => {
  const body = ruleBody(read('20-charts.css'), '.rolling__scroll')
  assert.equal(decl(body, 'overflow-x'), 'auto')
  assert.equal(decl(body, '-webkit-overflow-scrolling'), 'touch')
})

// The wide ABS frame shows only from 740px (StatBox's inline copy is the
// phone's). Card sets no display, so the two namespace rules still decide it.
test('C4: the ABS frame is hidden on a phone and shown from 740px', () => {
  assert.equal(decl(ruleBody(read('12-sealbox.css'), '.absframe'), 'display'), 'none')
  const wide = read('25-wide-layout.css').match(/@media \(min-width: 740px\) \{[^@]*?\n\s+\.absframe \{([^}]*)\}/)
  assert.ok(wide, '25-wide-layout.css: an .absframe rule inside the 740px query')
  assert.equal(decl(wide[1], 'display'), 'block')
})

// Strict, comments too: a comment that names a retired class sends the next
// reader to a rule that does not exist. The box score's .bs__abscard is a
// different class and stays.
const RETIRED_C4 = /(^|[^\w-])(lineupcard|abscard)(?![a-z0-9-])/
test('C4: .lineupcard and .abscard are gone, from stylesheets, markup, comments and the seal guard', () => {
  const css = files(STYLES, ['.css']).filter((rel) => RETIRED_C4.test(readFileSync(join(STYLES, rel), 'utf8')))
  const code = files(SRC, ['.jsx', '.js', '.md'])
    .filter((rel) => !rel.startsWith('styles/'))
    .filter((rel) => RETIRED_C4.test(readFileSync(join(SRC, rel), 'utf8')))
  const guard = readFileSync(join(SRC, '..', 'scripts', 'check-seal-scope.mjs'), 'utf8')
  assert.deepEqual([...css, ...code], [])
  assert.doesNotMatch(guard, RETIRED_C4)
})

// The box score draws the same .halfdefense markup (BoxDefense, inside the
// reveal render) with NO outer card: its title and diamond join into one
// shape of their own. So BoxScore.jsx is not changed, and the box score's rule
// keeps that copy flush in its column.
test('C4: the box score defence stays unframed, and BoxScore.jsx takes no Card for it', () => {
  const code = src('screens/BoxScore.jsx')
  assert.match(code, /<section\s+className=\{`halfdefense bs__defensecard /)
  assert.equal(cardTags(code).filter((attrs) => namesClass(attrs, 'halfdefense')).length, 0)
  const body = ruleBody(read('12-sealbox.css'), '.bs__defensecard.halfdefense')
  assert.equal(decl(body, 'margin'), '0')
  for (const prop of ['border', 'border-radius', 'background', 'box-shadow']) {
    assert.equal(decl(body, prop), undefined, `.bs__defensecard.halfdefense strips no ${prop}: .halfdefense draws none now`)
  }
})

// Focus mode drops the half's paper while a staged notice is all it holds,
// so the notice is not a card inside a card. That rule outranks Card's frame
// on specificity, so it must still name the three properties Card draws.
test('C4: focus mode still drops the half sheet around a lone staged notice', () => {
  const css = read('focus/console.css')
  const at = css.indexOf('.half:has(.pitchernotice--pbp):not(:has(.statgrid))')
  assert.ok(at > 0)
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
  for (const prop of ['background', 'border', 'box-shadow']) assert.equal(decl(body, prop), 'none', prop)
})

// THE SEAL PIN. Written before this slice changed a line: for each file the
// slice touches, the reveal-only modules it imports (src/api/spoiler-manifest
// .json; a "mixed" module counts when a sealed export is imported), and how
// many SealBoxes and revealedThrough reads it holds, as measured on
// origin/main. A frame move changes none of these. If this fails, the slice
// moved a seal: stop and ask, never update the literal to match.
const C4_SEAL = {
  'components/inning/HalfInning.jsx': { reveal: ['boxscore.js', 'highlights.js', 'hitchart.js', 'playbyplay.js'], sealBoxes: 1, revealedThrough: 12 },
  'components/gamehud/StatBox.jsx': { reveal: ['boxscore.js', 'challenges.js', 'derive.js', 'linescore.js', 'umpireFavor.js'], sealBoxes: 2, revealedThrough: 0 },
  'components/playbyplay/DueUpNextCard.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 2 },
  'components/inning/EnteringReference.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 9 },
  'components/inning/RosterPanel.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 2 },
  'components/umpire/UmpireTendenciesFold.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/gamehud/RollingLine.jsx': { reveal: ['linescore.js'], sealBoxes: 0, revealedThrough: 7 },
  'components/charts/WinProbChart.jsx': { reveal: ['winprob.js'], sealBoxes: 0, revealedThrough: 0 },
  'components/inning/MarginNotes.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/inning/PitchersSection.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/gamehud/HalfTally.jsx': { reveal: ['derive.js', 'linescore.js'], sealBoxes: 1, revealedThrough: 0 },
  'components/gamehud/BetweenInnings.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 3 },
  'screens/BoxScore.jsx': { reveal: ['boxscore.js', 'challenges.js'], sealBoxes: 1, revealedThrough: 0 },
}
const SPOILER_MANIFEST = JSON.parse(readFileSync(join(SRC, 'api', 'spoiler-manifest.json'), 'utf8')).modules

function revealOnlyImports(rel) {
  const code = src(rel)
  const found = new Set()
  for (const m of code.matchAll(/^import\s+([^'"]*?)\s+from\s+['"](\.[^'"]+)['"]/gm)) {
    const target = join(dirname(join(SRC, rel)), m[2])
    const fromApi = relative(join(SRC, 'api'), target).replaceAll('\\', '/')
    const apiRel = fromApi.startsWith('..') ? null : fromApi
    const entry = apiRel && SPOILER_MANIFEST[apiRel]
    if (!entry) continue
    const names = (m[1].match(/\{([^}]*)\}/)?.[1] ?? '').split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)
    if (entry.class === 'reveal-only') found.add(apiRel)
    else if (entry.class === 'mixed' && names.some((n) => entry.revealOnlyExports.includes(n))) found.add(apiRel)
  }
  return [...found].sort()
}

test('C4: the seal pin — no reveal-only import, SealBox or revealedThrough read moved', () => {
  for (const [rel, want] of Object.entries(C4_SEAL)) {
    const code = src(rel)
    assert.deepEqual(revealOnlyImports(rel), want.reveal, `${rel}: its reveal-only imports changed`)
    assert.equal((code.match(/<SealBox\b/g) ?? []).length, want.sealBoxes, `${rel}: a SealBox was added or removed`)
    assert.equal((code.match(/revealedThrough/g) ?? []).length, want.revealedThrough, `${rel}: a revealedThrough read moved`)
  }
})

// ---- 15. slice C3: the pre-game cards ----

// The pre-game blocks that drew their own copy of the card: the metric card
// (five modules, the foul boards among them), the batting order, the opposing
// defence and the starting pitcher (one rule for three blocks), a former
// teammate tile, the defence diamond and the umpire crew. Each one renders
// through Card now, with body="flush": each keeps its own padding, which is not
// the padded body's, so its layout does not move. `wrap` is the C2 mode: the
// Card wraps the umpire grid, which keeps its class and its gap rules. No C3
// block opts out of the Card's clip: nothing in them reaches past the edge.
const C3 = [
  {
    css: '44-pre-game-cards.css',
    sel: '.metric',
    jsx: [
      'components/game/GamePhotosStrip.jsx',
      'components/teamstats/BullpenBoard.jsx',
      'components/teamstats/SeasonSeriesStrip.jsx',
      'screens/FoulTrackerPage.jsx',
      'screens/TeamInfo.jsx',
    ],
    ns: 'metric',
    head: true,
  },
  { css: '44-pre-game-cards.css', sel: '.lineup', jsx: ['screens/TeamInfo.jsx'], ns: 'lineup', head: true },
  { css: '44-pre-game-cards.css', sel: '.opp', jsx: ['screens/TeamInfo.jsx'], ns: 'opp', head: true },
  { css: '44-pre-game-cards.css', sel: '.starter', jsx: ['screens/TeamInfo.jsx'], ns: 'starter', head: true },
  { css: '10-lineup.css', sel: '.teammate', jsx: ['screens/TeamInfo.jsx'], ns: 'teammate', as: 'li' },
  { css: '10-lineup.css', sel: '.defdiamond', jsx: ['components/scoring/DefenseDiamond.jsx'], ns: 'defdiamond', as: 'div', keep: ['background'] },
  {
    css: '09-team-info.css',
    sel: '.umps__list',
    jsx: ['components/umpire/UmpiresCard.jsx', 'components/inning/focus/ExtrasFacts.jsx'],
    ns: 'umps__list',
    mode: 'wrap',
    as: 'div',
    keep: ['background'],
  },
]
// Every rule whose selector LIST names `sel`: `.lineup, .opp, .starter` is one
// rule for three blocks.
const bodiesNaming = (css, sel) =>
  rules(css)
    .filter(([s]) => s.split(',').map((x) => x.trim()).includes(sel))
    .map(([, body]) => body)
const importOrder = () =>
  [...readFileSync(join(SRC, 'index.css'), 'utf8').matchAll(/@import '\.\/styles\/([^']+)';/g)].map((m) => m[1])

test('C3: no pre-game block draws a second frame over its Card', () => {
  for (const { css, sel, keep = [] } of C3) {
    for (const body of bodiesNaming(read(css), sel)) {
      assert.deepEqual(frameDecls(body, keep), [], `${css}: ${sel} still draws its own frame`)
    }
  }
  // The batting order's list was a frame inside the frame. It is the lineup
  // Card's flush body now, so it draws nothing and nothing strips it.
  for (const body of bodiesNaming(read('10-lineup.css'), '.lineup__list')) {
    assert.deepEqual(frameDecls(body), [], '.lineup__list is a flush body, not a second card')
  }
  assert.equal(ruleBody(read('44-pre-game-cards.css'), '.lineup .lineup__list'), null, 'no rule strips a frame the list no longer draws')
  // The foul boards clipped their bled tables with a clip of their own. The
  // Card clips them now.
  for (const body of bodiesNaming(read('43-foul-tracker.css'), '.foulboard-block')) {
    assert.deepEqual(frameDecls(body), [], '.foulboard-block leaves the clip to the Card')
  }
})

test('C3: every pre-game block renders on Card, with its frame, its head and a flush body', () => {
  for (const { jsx, ns, mode = 'card', head = false, as } of C3) {
    for (const rel of jsx) {
      const code = src(rel)
      assert.match(code, /import \{ Card \} from ["'](?:[\w./]+\/ui\/frame|\.)\/Card\.jsx["']/, `${rel} imports Card`)
      const tags = mode === 'wrap' ? wrappingTags(code, ns) : cardTags(code).filter((attrs) => namesClass(attrs, ns))
      assert.ok(tags.length > 0, `${rel}: .${ns} renders ${mode === 'wrap' ? 'inside' : 'on'} a Card`)
      for (const attrs of tags) {
        assert.match(attrs, /body="flush"/, `${rel}: .${ns}'s Card keeps the block's own padding`)
        assert.doesNotMatch(attrs, /frame=/, `${rel}: .${ns} is a sheet (the default)`)
        if (head) assert.match(attrs, /head=\{/, `${rel}: .${ns}'s band is the Card's head`)
        else assert.doesNotMatch(attrs, /head=/, `${rel}: .${ns} has no head`)
        if (as) assert.match(attrs, new RegExp(`as="${as}"`), `${rel}: .${ns} is a <${as}>, as before`)
      }
      if (mode === 'card') assert.doesNotMatch(code, bareUse(ns), `${rel}: .${ns} is on a bare element`)
      if (mode === 'wrap') {
        const uses = code.match(new RegExp(`className=\\{?["'\`]${ns}(?![\\w-])`, 'g')) ?? []
        assert.equal(uses.length, tags.length, `${rel}: every .${ns} sits inside a Card`)
      }
    }
  }
})

// The umpire crew is a gap-rule grid: the rules between the umpires are the
// grid's own --border-rule ground in 1px gaps. The Card paints card paper, so
// that ground stays on the grid inside it, and the grid draws no edge.
test('C3: the umpire grid keeps its rules inside the Card', () => {
  const css = read('09-team-info.css')
  const body = ruleBody(css, '.umps__list')
  assert.ok(body, 'a .umps__list rule')
  assert.equal(decl(body, 'display'), 'grid')
  assert.equal(decl(body, 'grid-template-columns'), '1fr 1fr')
  assert.equal(decl(body, 'gap'), '1px')
  assert.equal(decl(body, 'background'), 'var(--border-rule)')
  assert.deepEqual(frameDecls(body, ['background']), [], '.umps__list draws no frame of its own')
  assert.equal(decl(ruleBody(css, '.umps__list li'), 'background'), 'var(--surface-card)')
  assert.equal(decl(ruleBody(css, '.umps__list li:last-child:nth-child(odd)'), 'grid-column'), '1 / -1')
})

// Where a host reshapes the diamond, its rule must still beat the Card's frame:
// two classes against the one of .card, in a partial that loads after
// system/card.css. The box score joins the diamond to the title above it; the
// reference panel and the opposing-defence card draw the frame themselves.
test('C3: the rules that reshape the diamond inside a host still win over the Card', () => {
  const imports = importOrder()
  const card = imports.indexOf('system/card.css')
  const hosts = [
    ['12-sealbox.css', '.bs__defensecard .defdiamond', { 'border-top': 'none', 'border-radius': '0 0 var(--radius-md) var(--radius-md)' }],
    ['12-sealbox.css', '.refpanel__body .defdiamond', { border: 'none', 'box-shadow': 'none', background: 'var(--field-ground)' }],
    ['44-pre-game-cards.css', '.opp .defdiamond', { border: '0', 'border-radius': '0' }],
  ]
  for (const [rel, sel, want] of hosts) {
    const body = ruleBody(read(rel), sel)
    assert.ok(body, `${rel}: ${sel}`)
    for (const [prop, value] of Object.entries(want)) assert.equal(decl(body, prop), value, `${sel} ${prop}`)
    assert.ok((sel.match(/\./g) ?? []).length > 1, `${sel} outranks .card`)
    assert.ok(imports.indexOf(rel) > card, `${rel} loads after system/card.css`)
  }
})

// Strict, comments too: a comment that names a retired class sends the next
// reader to a rule that does not exist.
const RETIRED_C3 = /(^|[^\w-])(metriccard|startercard|teammatecard)(?![\w])/

test('C3: .metriccard, .startercard and .teammatecard are gone, from stylesheets, markup and comments', () => {
  const css = files(STYLES, ['.css']).filter((rel) => RETIRED_C3.test(readFileSync(join(STYLES, rel), 'utf8')))
  const code = files(SRC, ['.jsx', '.js', '.md'])
    .filter((rel) => !rel.startsWith('styles/'))
    .filter((rel) => RETIRED_C3.test(readFileSync(join(SRC, rel), 'utf8')))
  assert.deepEqual([...css, ...code], [])
})

// Card owns no margin. Each block keeps its own space and its own layout in a
// namespace rule that loads after system/card.css, so it wins on order.
test('C3: each block keeps its own space and layout, from a rule that loads after card.css', () => {
  const imports = importOrder()
  const card = imports.indexOf('system/card.css')
  for (const rel of ['09-team-info.css', '10-lineup.css', '44-pre-game-cards.css']) {
    assert.ok(imports.indexOf(rel) > card, `${rel} loads after system/card.css`)
  }
  const pre = read('44-pre-game-cards.css')
  assert.equal(decl(ruleBody(pre, '.metric') ?? '', 'margin-top'), 'var(--space-4)')
  assert.equal(decl(bodiesNaming(pre, '.starter')[0] ?? '', 'margin-top'), 'var(--space-4)', '.lineup, .opp and .starter keep their 16px')
  const lineup = read('10-lineup.css')
  const mate = ruleBody(lineup, '.teammate') ?? ''
  assert.equal(decl(mate, 'margin-bottom'), 'var(--space-3)')
  assert.equal(decl(mate, 'break-inside'), 'avoid', 'a teammate tile never splits across the masonry columns')
  assert.equal(decl(mate, 'display'), 'grid')
  assert.equal(decl(ruleBody(lineup, '.defdiamond'), 'padding'), 'var(--space-3) var(--space-2h) var(--space-2)')
  // These two cards carry field artwork through the DH row; Card still owns
  // their border, radius and shadow. Pin the requested ground, not any override.
  assert.equal(decl(ruleBody(lineup, '.defdiamond'), 'background'), 'var(--field-ground)')
  assert.equal(decl(ruleBody(read('27-player-position-innings.css'), '.posinn__diamond'), 'background'), 'var(--field-ground)')
})

// The animation lab draws the lineup strip with the real recipe, so it wraps
// the list in the same flush Card the batting order uses.
test('C3: the animation lab draws the batting order on the same Card', () => {
  assert.match(src('screens/animlab/motionDemos.jsx'), /<Card as="div" body="flush">\s*<ol className="lineup__list">/)
})
