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
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const STYLES = join(SRC, 'styles')

const read = (rel) => stripComments(readFileSync(join(STYLES, rel), 'utf8'))

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
  { css: '27-player-position-innings.css', sel: '.posinn__diamond', jsx: ['components/player/PositionInnings.jsx'], ns: 'posinn__diamond' },
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
  { css: 'charts/winprob.css', sel: '.winprob', jsx: ['components/charts/WinProbChart.jsx'], ns: 'winprob' },
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
    ['charts/winprob.css', '.winprob', 'margin-bottom', 'var(--space-4)'],
    ['charts/winprob.css', '.winprob', 'padding', 'var(--space-3) var(--space-3h) var(--space-2h)'],
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
      'components/team/FormerTeammates.jsx',
      'screens/FoulTrackerPage.jsx',
    ],
    ns: 'metric',
    head: true,
  },
  { css: '44-pre-game-cards.css', sel: '.lineup', jsx: ['screens/TeamInfo.jsx'], ns: 'lineup', head: true },
  { css: '44-pre-game-cards.css', sel: '.opp', jsx: ['screens/TeamInfo.jsx'], ns: 'opp', head: true },
  { css: '44-pre-game-cards.css', sel: '.starter', jsx: ['screens/TeamInfo.jsx'], ns: 'starter', head: true },
  { css: '10-lineup.css', sel: '.teammate', jsx: ['components/team/FormerTeammates.jsx'], ns: 'teammate', as: 'li' },
  { css: '10-lineup.css', sel: '.defdiamond', jsx: ['components/scoring/DefenseDiamond.jsx'], ns: 'defdiamond', as: 'div' },
  {
    css: '09-team-info.css',
    sel: '.umps__list',
    jsx: ['components/inning/focus/ExtrasFacts.jsx'],
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
    ['12-sealbox.css', '.refpanel__body .defdiamond', { border: 'none', 'box-shadow': 'none', background: 'none' }],
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
})

// The animation lab draws the lineup strip with the real recipe, so it wraps
// the list in the same flush Card the batting order uses.
test('C3: the animation lab draws the batting order on the same Card', () => {
  assert.match(src('screens/animlab/motionDemos.jsx'), /<Card as="div" body="flush">\s*<ol className="lineup__list">/)
})

// ---- slice C5: the box score ----

// The fifteen box-score blocks that drew their own copy of the card, and the
// performer tile (.playercard, now .playerline) that the box score shares
// with the slate, the innings view and /awards. SPOILER SCOPE: twelve of them
// render inside the box score's SealBox reveal render, so each one is a box
// move and nothing else. The Card IS the block (it carries the block's
// class), and the namespace rule keeps the block's margin, its own inset and
// its layout. Every Card takes body="flush": each block has its own inset
// (12px 14px and the like), and the padded body's is 12px 16px 16px, so a
// padded body would move the layout. Each band head stays the Card's first
// child, as H1b left it, and .gamestory keeps its own large title (Gary,
// 2026-09-29: the big card names wait on the design lab).
//
// Q3: the six sheets that sat on page paper (--paper-1) take the Card's paper.
// The .bs__fill gap-rule grid IS its Card, not wrapped in one: the phone order
// (48-stamp-strip.css) ranks it as a direct child of its club's column, so it
// keeps its class on the outer box, and its --border-rule ground (`keep`).
const C5 = [
  { css: '21-box-score.css', sel: '.gamestory', jsx: ['components/game/GameStoryCard.jsx'], ns: 'gamestory' },
  { css: '21-box-score.css', sel: '.bs__team', jsx: ['screens/BoxScore.jsx'], ns: 'bs__team' },
  { css: '21-box-score.css', sel: '.bs__decisions', jsx: ['screens/BoxScore.jsx'], ns: 'bs__decisions', as: 'div' },
  { css: '21-box-score.css', sel: '.bs__potg', jsx: ['screens/BoxScore.jsx'], ns: 'bs__potg', as: 'div' },
  { css: '21-box-score.css', sel: '.bs__insights', jsx: ['screens/BoxScore.jsx'], ns: 'bs__insights' },
  { css: '21-box-score.css', sel: '.bs__statcastCard', jsx: ['screens/BoxScore.jsx'], ns: 'bs__statcastCard' },
  // A note tile keeps its soft edge and inset shadow over the ledger frame
  // (Gary, 2026-09-29): that is its look, not a second frame.
  { css: '21-box-score.css', sel: '.bs__noteCard', jsx: ['screens/BoxScore.jsx'], ns: 'bs__noteCard', frame: 'ledger', as: 'div', keep: ['box-shadow'] },
  { css: '21a-box-score-stars.css', sel: '.bs__stars', jsx: ['screens/BoxScore.jsx'], ns: 'bs__stars', as: 'div' },
  // Boxed only from 740px: its phone rules strip the frame (test below).
  { css: '21a-box-score-stars.css', sel: '.stars3__card', jsx: ['screens/BoxScore.jsx'], ns: 'stars3__card', frame: 'ledger', as: 'li', phoneOnly: true },
  { css: '21b-box-score-tally.css', sel: '.bs__tally', jsx: ['screens/boxscore/InningTally.jsx'], ns: 'bs__tally', as: 'div' },
  // No band head to round, so the tile opts out of the Card's clip, which
  // cut the name link's focus ring in the tight award tiles (test below).
  {
    css: '22-box-score-tables.css',
    sel: '.playerline',
    jsx: ['components/player/PerformerCard.jsx', 'screens/AwardsHistoryPage.jsx'],
    ns: 'playerline',
    frame: 'ledger',
    as: 'li',
    keep: ['overflow'],
  },
  { css: '23-box-score-detail.css', sel: '.bs__info', jsx: ['screens/BoxScore.jsx'], ns: 'bs__info', as: 'div' },
  { css: '23-box-score-detail.css', sel: '.bs__totalsCard', jsx: ['screens/BoxScore.jsx'], ns: 'bs__totalsCard', as: 'div' },
  { css: '23-box-score-detail.css', sel: '.bs__board', jsx: ['screens/BoxScore.jsx'], ns: 'bs__board', as: 'div' },
  { css: '23-box-score-detail.css', sel: '.bs__fill', jsx: ['screens/BoxScore.jsx'], ns: 'bs__fill', as: 'div', keep: ['background'] },
]

// Every rule in a stylesheet with the @media head it sits under ('' for none).
function rulesInMedia(css) {
  const found = []
  let at = 0
  for (;;) {
    const open = css.indexOf('{', at)
    if (open === -1) return found
    const head = css.slice(at, open).trim()
    if (head.startsWith('@media')) {
      let depth = 1
      let end = open + 1
      while (depth > 0 && end < css.length) {
        if (css[end] === '{') depth += 1
        else if (css[end] === '}') depth -= 1
        end += 1
      }
      for (const [sel, body] of rules(css.slice(open + 1, end - 1))) found.push([head, sel, body])
      at = end
    } else {
      const close = css.indexOf('}', open)
      found.push(['', head, css.slice(open + 1, close)])
      at = close + 1
    }
  }
}
const PHONE_QUERY = '@media (max-width: 739.98px)'

test('C5: no box-score block draws a second frame over its Card, inside media queries too', () => {
  for (const { css, sel, keep = [], phoneOnly } of C5) {
    const found = rulesInMedia(read(css)).filter(([, s]) => s === sel)
    assert.ok(found.length > 0, `${css}: a ${sel} rule`)
    for (const [media, , body] of found) {
      if (phoneOnly && media === PHONE_QUERY) continue
      assert.deepEqual(frameDecls(body, keep), [], `${css}: ${sel} ${media} still draws its own frame`)
    }
  }
})

test('C5: every box-score block renders on Card, with its frame and a flush body', () => {
  for (const { jsx, ns, frame, as, mode = 'card' } of C5) {
    for (const rel of jsx) {
      const code = src(rel)
      assert.match(code, /import \{ Card \} from ["'][\w./]+\/ui\/frame\/Card\.jsx["']/, `${rel} imports Card`)
      const tags = mode === 'wrap' ? wrappingTags(code, ns) : cardTags(code).filter((attrs) => namesClass(attrs, ns))
      assert.ok(tags.length > 0, `${rel}: .${ns} renders ${mode === 'wrap' ? 'inside' : 'on'} a Card`)
      for (const attrs of tags) {
        assert.match(attrs, /body="flush"/, `${rel}: .${ns}'s Card keeps the block's own inset`)
        if (frame) assert.match(attrs, new RegExp(`frame="${frame}"`), `${rel}: .${ns} is a ${frame}`)
        else assert.doesNotMatch(attrs, /frame=/, `${rel}: .${ns} is a sheet (the default)`)
        if (as) assert.match(attrs, new RegExp(`as="${as}"`), `${rel}: .${ns} is a <${as}>, as before`)
        else assert.doesNotMatch(attrs, /as=/, `${rel}: .${ns} is a <section>, as before`)
        assert.doesNotMatch(attrs, /head=/, `${rel}: .${ns} keeps its head as its first child`)
      }
      if (mode === 'card') assert.doesNotMatch(code, bareUse(ns), `${rel}: .${ns} is on a bare element`)
      if (mode === 'wrap') {
        const uses = code.match(new RegExp(`className=\\{?["'\`]${ns}(?![\\w-])`, 'g')) ?? []
        assert.equal(uses.length, tags.length, `${rel}: every .${ns} sits inside a Card`)
      }
    }
  }
})

// Card owns no margin, and a flush body adds no padding, so each block keeps
// the space and the inset it had, in its own namespace rule, which loads
// after system/card.css.
test('C5: each block keeps its own margin and inset, from a rule that loads after card.css', () => {
  const imports = importOrder()
  const card = imports.indexOf('system/card.css')
  for (const rel of new Set(C5.map((c) => c.css))) assert.ok(imports.indexOf(rel) > card, `${rel} loads after system/card.css`)
  const kept = [
    ['21-box-score.css', '.gamestory', 'margin-top', 'var(--space-4)'],
    ['21-box-score.css', '.bs__team', 'padding', 'var(--space-3) var(--space-3h) var(--space-2h)'],
    ['21-box-score.css', '.bs__decisions', 'padding', 'var(--space-3) var(--space-3h)'],
    ['21-box-score.css', '.bs__decisions', 'display', 'flex'],
    ['21-box-score.css', '.bs__potg', 'padding', 'var(--space-3) var(--space-3h)'],
    ['21-box-score.css', '.bs__potg', 'margin-bottom', '10px'],
    ['21-box-score.css', '.bs__insights', 'padding', 'var(--space-3) var(--space-3h)'],
    ['21-box-score.css', '.bs__insights', 'margin-top', 'var(--space-3)'],
    ['21-box-score.css', '.bs__statcastCard', 'padding', 'var(--space-3) var(--space-3h)'],
    ['21-box-score.css', '.bs__noteCard', 'padding', 'var(--space-2)'],
    ['21-box-score.css', '.bs__noteCard', 'margin-bottom', '8px'],
    ['21a-box-score-stars.css', '.bs__stars', 'padding', 'var(--space-3) var(--space-3h)'],
    ['21a-box-score-stars.css', '.stars3__card', 'padding', 'var(--space-2) 2px'],
    ['21b-box-score-tally.css', '.bs__tally', 'margin-top', 'var(--space-3)'],
    ['22-box-score-tables.css', '.playerline', 'padding', 'var(--space-2)'],
    ['22-box-score-tables.css', '.playerline', 'display', 'flex'],
    ['23-box-score-detail.css', '.bs__info', 'padding', 'var(--space-3) var(--space-3h)'],
    ['23-box-score-detail.css', '.bs__totalsCard', 'padding', 'var(--space-2h) var(--space-3h) var(--space-3)'],
    ['23-box-score-detail.css', '.bs__board', 'padding', 'var(--space-2h) var(--space-3h) var(--space-3)'],
  ]
  for (const [css, sel, prop, value] of kept) {
    assert.equal(decl(ruleBody(read(css), sel) ?? '', prop), value, `${css}: ${sel} keeps ${prop}: ${value}`)
  }
})

// A note tile is one tile in a CSS-columns waterfall: it must never split
// across two columns.
test('C5: a note tile still never breaks across the waterfall columns', () => {
  const css = read('21-box-score.css')
  assert.equal(decl(ruleBody(css, '.bs__noteCard'), 'break-inside'), 'avoid')
  assert.equal(decl(ruleBody(css, '.bs__noteGrid'), 'column-width'), '240px')
})

// Gary kept the note tile's old edge (2026-09-29): the soft hairline and the
// inset shadow, over the ledger Card's radius and paper. 21-box-score.css
// loads after system/card.css, so the tile's rule wins on order.
test('C5: a note tile keeps its soft edge and inset shadow', () => {
  const body = ruleBody(read('21-box-score.css'), '.bs__noteCard')
  assert.equal(decl(body, 'border-color'), 'var(--border-hairline)')
  assert.equal(decl(body, 'box-shadow'), 'var(--inset-cell)')
  const imports = importOrder()
  assert.ok(imports.indexOf('21-box-score.css') > imports.indexOf('system/card.css'))
})

// The scorebook's fill-in boxes are a gap-rule grid: the rules between the
// boxes are the grid's own --border-rule ground in 1px gaps. The Card paints
// the edge and the corners. The grid stays its column's direct child, so the
// phone order still ranks it after the stamp, the totals and the story.
test('C5: the fill-in grid keeps its rules and its place in the phone order', () => {
  const body = ruleBody(read('23-box-score-detail.css'), '.bs__fill')
  assert.equal(decl(body, 'display'), 'grid')
  assert.equal(decl(body, 'grid-template-columns'), '1fr 1fr')
  assert.equal(decl(body, 'gap'), '1px')
  assert.equal(decl(body, 'background'), 'var(--border-rule)')
  assert.equal(decl(ruleBody(read('23-box-score-detail.css'), '.bs__field'), 'background'), 'var(--surface-card)')
  const order = read('48-stamp-strip.css')
  assert.match(order, /\.bs \.bs__col--away > \.bs__fill \{ order: 9; \}/)
  assert.match(order, /\.bs \.bs__col--home > \.bs__fill \{ order: 13; \}/)
  assert.match(src('screens/BoxScore.jsx'), /\n {4}<Card as="div" body="flush" className="bs__fill">\n/)
})

// The three-stars tile is a plain list row on a phone (a soft rule above it)
// and a boxed tile from 740px. Card draws its frame at every width, so the
// phone query strips it, and the wide query draws none of its own.
test('C5: a three-stars tile is a list row below 740px and a ledger tile from 740px', () => {
  const found = rulesInMedia(read('21a-box-score-stars.css')).filter(([, s]) => s === '.stars3__card')
  const phone = found.filter(([media]) => media === PHONE_QUERY).map(([, , body]) => body)
  const strip = phone.find((body) => decl(body, 'border-radius') !== undefined)
  assert.ok(strip, 'a phone rule strips the Card frame')
  assert.equal(decl(strip, 'border'), 'none')
  assert.equal(decl(strip, 'border-top'), 'var(--bw-hair) solid var(--rule-soft)')
  assert.equal(decl(strip, 'border-radius'), '0')
  assert.equal(decl(strip, 'background'), 'none')
  assert.equal(decl(strip, 'overflow'), 'visible', "the row's 2px side inset must not clip the name link's focus ring")
  const wide = found.filter(([media]) => media === '@media (min-width: 740px)').map(([, , body]) => body)
  assert.equal(wide.length, 1)
  assert.equal(decl(wide[0], 'padding'), 'var(--space-3)')
  assert.deepEqual(frameDecls(wide[0]), [], 'from 740px the Card draws the frame')
})

// Card clips its edge so a band head follows its corners. The performer tile
// has no head, and in the tight award tiles the clip cut the name link's
// focus ring by up to 4px (measured at 320px), so the tile does not clip.
test('C5: the performer tile does not clip the focus ring of its name link', () => {
  assert.equal(decl(ruleBody(read('22-box-score-tables.css'), '.playerline'), 'overflow'), 'visible')
  const imports = importOrder()
  assert.ok(imports.indexOf('22-box-score-tables.css') > imports.indexOf('system/card.css'), 'the tile wins over .card on order')
})

// GameStoryCard fetches MLB.com coverage and shows nothing without it. The
// early return stays above the Card, so no empty frame ever says a story
// exists, and the big "Coverage" title stays the Card's first child.
test('C5: the coverage card keeps its large title and returns null before the Card', () => {
  const code = src('components/game/GameStoryCard.jsx')
  const empty = code.indexOf('if (stories.length === 0) return null')
  assert.ok(empty > 0)
  assert.ok(empty < code.indexOf('<Card'), 'the early return sits above the Card')
  assert.match(code, /<Card body="flush" className="gamestory">\s*<div className="gamestory__head">\s*<h3 className="gamestory__title">Coverage<\/h3>/)
  assert.equal(decl(ruleBody(read('21-box-score.css'), '.gamestory__title'), 'font-size'), 'var(--fs-ui)')
})

// The same for every box-score block that can be empty: an empty frame would
// show that a star, a note or a decision exists.
test('C5: every box-score block that can be empty returns null before its Card', () => {
  const code = src('screens/BoxScore.jsx')
  for (const name of ['StatcastLeadersCard', 'InsightsCard', 'Decisions', 'PlayOfTheGame', 'ThreeStars', 'GameInfo']) {
    const from = code.indexOf(`\nfunction ${name}(`)
    assert.ok(from > 0, name)
    const next = code.indexOf('\nfunction ', from + 1)
    const body = code.slice(from, next === -1 ? undefined : next)
    const empty = body.indexOf('return null')
    assert.ok(empty > 0, `${name} returns null when empty`)
    assert.ok(empty < body.indexOf('<Card'), `${name}: the early return sits above the Card`)
  }
})

// The rename (ADR-0084 ledger): .playercard is .playerline. Strict, comments
// and e2e too. The folder components/playercard/ keeps its name, so a path
// (a / before or after) does not count.
const RETIRED_C5 = /(?<![/A-Za-z0-9_-])playercard(?![a-z0-9/-])/
test('C5: .playercard is gone, from stylesheets, markup, comments and e2e', () => {
  const E2E = join(SRC, '..', 'e2e')
  const found = [
    ...files(SRC, ['.css', '.jsx', '.js', '.md']).filter((rel) => RETIRED_C5.test(readFileSync(join(SRC, rel), 'utf8'))),
    ...files(E2E, ['.js', '.mjs']).filter((rel) => RETIRED_C5.test(readFileSync(join(E2E, rel), 'utf8'))).map((rel) => `e2e/${rel}`),
  ]
  assert.deepEqual(found, [])
})

// Two hosts draw the tile with no frame of their own: the innings view's
// Statcast row (.halfcast) and the slate result card's performer slot. Their
// two-class rules outrank .card, in partials that load after system/card.css.
test('C5: the two hosts that draw the tile unframed still drop its frame', () => {
  const imports = importOrder()
  const card = imports.indexOf('system/card.css')
  const hosts = [
    ['12-sealbox.css', '.halfcast .playerline', { border: 'none', 'border-radius': '0', background: 'none', padding: '0' }],
    ['22-box-score-tables.css', '.flipback__perfcard .playerline', { border: 'none', background: 'none', padding: '0' }],
  ]
  for (const [rel, sel, want] of hosts) {
    const body = ruleBody(read(rel), sel)
    assert.ok(body, `${rel}: ${sel}`)
    for (const [prop, value] of Object.entries(want)) assert.equal(decl(body, prop), value, `${sel} ${prop}`)
    assert.ok(imports.indexOf(rel) > card, `${rel} loads after system/card.css`)
  }
})

// The design lab draws the real tile, so it wears the real frame too (Q5:
// the lab keeps its look).
test('C5: the design lab draws the performer tile on the ledger frame', () => {
  assert.match(src('screens/designlab/catalog.js'), /cls: 'card card--ledger playerline'/)
  assert.match(src('screens/designlab/components.jsx'), /className="card card--ledger playerline"/)
})

// THE SEAL PIN. Written before this slice changed a line, from origin/main
// 4f8b7c567: for each file the slice touches, the reveal-only modules it
// imports (src/api/spoiler-manifest.json; a "mixed" module counts when a
// sealed export is imported), and how many SealBoxes and revealedThrough
// reads it holds. A frame move changes none of these. If this fails, the
// slice moved a seal: stop and ask, never update the literal to match.
const C5_SEAL = {
  'screens/BoxScore.jsx': { reveal: ['boxscore.js', 'challenges.js'], sealBoxes: 1, revealedThrough: 0 },
  'components/game/GameStoryCard.jsx': { reveal: ['gameStory.js'], sealBoxes: 0, revealedThrough: 0 },
  'screens/boxscore/InningTally.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/player/PerformerCard.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'screens/AwardsHistoryPage.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/gamehud/StatBox.jsx': { reveal: ['boxscore.js', 'challenges.js', 'derive.js', 'linescore.js', 'umpireFavor.js'], sealBoxes: 2, revealedThrough: 0 },
  'components/game/GameResultFace.jsx': { reveal: ['boxscore.js'], sealBoxes: 0, revealedThrough: 0 },
}

test('C5: the seal pin — no reveal-only import, SealBox or revealedThrough read moved', () => {
  for (const [rel, want] of Object.entries(C5_SEAL)) {
    const code = src(rel)
    assert.deepEqual(revealOnlyImports(rel), want.reveal, `${rel}: its reveal-only imports changed`)
    assert.equal((code.match(/<SealBox\b/g) ?? []).length, want.sealBoxes, `${rel}: a SealBox was added or removed`)
    assert.equal((code.match(/revealedThrough/g) ?? []).length, want.revealedThrough, `${rel}: a revealedThrough read moved`)
  }
})


// ---- slice C6a: postseason and All-Star pages ----

// The twelve postseason and All-Star blocks that drew their own copy of the
// card. The series pages show game results, so this slice is a box move and
// nothing else: no fetch, gate, date check or text moves (the seal pin below).
// The Card IS the block (it carries the block's class), or, for the two lists,
// wraps it (`wrap`: Card is a div, since Card has no <ul>). Every Card takes
// body="flush": each block has its own inset, which is not the padded body's,
// so a padded body would move the layout. Each head stays the Card's first
// child, where H1b and H2 left it.
//
// The seed tile is a Card button on the history page and a Card div on the race
// page, whose tiles hold team links (a link inside a button card is invalid).
const C6A = [
  { css: '34-postseason.css', sel: '.seed', jsx: ['screens/PostseasonHistoryPage.jsx', 'screens/PostseasonRacePage.jsx'], ns: 'seed', frame: 'ledger', keep: ['overflow'] },
  { css: '35-postseason-series.css', sel: '.psseries__result', jsx: ['screens/PostseasonSeriesPage.jsx', 'screens/postseason-live/LiveSeriesPage.jsx'], ns: 'psseries__result' },
  { css: '35-postseason-series.css', sel: '.psseries__log', jsx: ['screens/PostseasonSeriesPage.jsx', 'screens/postseason-live/LiveSeriesPage.jsx'], ns: 'psseries__log', as: 'div', gone: true },
  { css: '35-postseason-series.css', sel: '.psseries__lboard', jsx: ['components/postseason/SeriesParts.jsx'], ns: 'psseries__lboard' },
  { css: '35-postseason-series.css', sel: '.psseries__rostercard', jsx: ['components/postseason/SeriesParts.jsx'], ns: 'psseries__rostercard' },
  { css: '35-postseason-series.css', sel: '.psseries__upcominglist', jsx: ['screens/postseason-live/LiveSeriesPage.jsx'], ns: 'psseries__upcominglist', mode: 'wrap', as: 'div' },
  { css: '36-postseason-leaders.css', sel: '.psleaders__teamboard', jsx: ['screens/PostseasonLeadersPage.jsx'], ns: 'psleaders__teamboard' },
  { css: '37-all-star-rosters.css', sel: '.allstarrosters__year', jsx: ['screens/AllStarRostersPage.jsx'], ns: 'allstarrosters__year' },
  { css: '37-all-star-rosters.css', sel: '.allstarrosters__rows', jsx: ['screens/AllStarRostersPage.jsx'], ns: 'allstarrosters__rows', mode: 'wrap', as: 'div' },
  { css: '37-all-star-rosters.css', sel: '.allstargame', jsx: ['components/allstar/AllStarGameResult.jsx'], ns: 'allstargame', as: 'div' },
  { css: '42-first-scorebook.css', sel: '.allstarlegacy__leadercard', jsx: ['screens/AllStarLegacyPage.jsx'], ns: 'allstarlegacy__leadercard', as: 'article' },
  { css: '42-first-scorebook.css', sel: '.allstarlegacy__teamcard', jsx: ['screens/AllStarLegacyPage.jsx'], ns: 'allstarlegacy__teamcard' },
]

test('C6a: no postseason or All-Star block draws a second frame over its Card, media queries too', () => {
  for (const { css, sel, keep = [], gone } of C6A) {
    const bodies = bodiesNaming(read(css), sel)
    // The whole .psseries__log rule was the frame, so it is gone (`gone`).
    if (gone) assert.equal(bodies.length, 0, `${css}: ${sel} was only a frame, so it has no rule`)
    else assert.ok(bodies.length > 0, `${css}: a ${sel} rule`)
    for (const body of bodies) assert.deepEqual(frameDecls(body, keep), [], `${css}: ${sel} still draws its own frame`)
  }
  // The bye tile keeps its dashed edge and its transparent ground: dashed means
  // "not a card" (census finding 7), and it is why the rule is the exception.
  const bye = ruleBody(read('34-postseason.css'), '.seed--bye')
  assert.equal(decl(bye, 'border-style'), 'dashed')
  assert.equal(decl(bye, 'background'), 'transparent')
  assert.equal(decl(bye, 'opacity'), '0.6')
  assert.deepEqual(frameDecls(bye, ['background']), [], '.seed--bye draws only its dashed, transparent look')
})

test('C6a: every postseason and All-Star block renders on Card, with its frame and a flush body', () => {
  for (const { jsx, ns, mode = 'card', frame = 'sheet', as } of C6A) {
    for (const rel of jsx) {
      const code = src(rel)
      assert.match(code, /import \{ Card \} from ["'](?:[\w./]+\/ui\/frame|\.)\/Card\.jsx["']/, `${rel} imports Card`)
      const tags = mode === 'wrap' ? wrappingTags(code, ns) : cardTags(code).filter((attrs) => namesClass(attrs, ns))
      assert.ok(tags.length > 0, `${rel}: .${ns} renders ${mode === 'wrap' ? 'inside' : 'on'} a Card`)
      for (const attrs of tags) {
        assert.match(attrs, /body="flush"/, `${rel}: .${ns}'s Card keeps the block's own inset`)
        if (frame === 'sheet') assert.doesNotMatch(attrs, /frame=/, `${rel}: .${ns} is a sheet (the default)`)
        else assert.match(attrs, new RegExp(`frame="${frame}"`), `${rel}: .${ns} is a ${frame}`)
        if (as) assert.match(attrs, new RegExp(`as="${as}"`), `${rel}: .${ns} is a Card ${as}`)
        assert.doesNotMatch(attrs, /head=/, `${rel}: .${ns} keeps its head as the first child, where it was`)
      }
      if (mode === 'card') assert.doesNotMatch(code, bareUse(ns), `${rel}: .${ns} is on a bare element`)
      if (mode === 'wrap') {
        const uses = code.match(new RegExp(`className=\\{?["'\`]${ns}(?![\\w-])`, 'g')) ?? []
        assert.equal(uses.length, tags.length, `${rel}: every .${ns} sits inside a Card`)
      }
    }
  }
})

// The seed tile is a Card button only where it is a tap target of its own. On
// the race page it holds team links, so it is a Card div.
test('C6a: the seed tile is a Card button on the history page and a Card div on the race page', () => {
  const history = cardTags(src('screens/PostseasonHistoryPage.jsx')).filter((a) => namesClass(a, 'seed'))
  assert.equal(history.length, 2, 'the bye tile and the matchup tile')
  assert.equal(history.filter((a) => /as="button"/.test(a)).length, 1, 'one button tile')
  assert.equal(history.filter((a) => /as="div"/.test(a)).length, 1, 'the bye tile is a div')
  assert.match(history.find((a) => /as="button"/.test(a)), /onClick=/, 'the button tile is the one that opens a series')
  const race = cardTags(src('screens/PostseasonRacePage.jsx')).filter((a) => namesClass(a, 'seed'))
  assert.equal(race.length, 3, 'matchup, division series and TBD tiles')
  for (const attrs of race) assert.match(attrs, /as="div"/, 'a race tile holds links, so it is not a button')
})

// Card owns no margin, and a flush body adds no padding, so each block keeps
// the space, the inset and the layout it had, in its own namespace rule.
test('C6a: each block keeps its own margin, inset and layout', () => {
  const kept = [
    ['34-postseason.css', '.seed', 'padding', 'var(--space-1) var(--space-2)'],
    ['34-postseason.css', '.seed', 'display', 'flex'],
    ['34-postseason.css', '.seed', 'position', 'relative'],
    ['35-postseason-series.css', '.psseries__result', 'margin', 'var(--space-3) 0'],
    ['35-postseason-series.css', '.psseries__lboard', 'padding', 'var(--space-3)'],
    ['35-postseason-series.css', '.psseries__rostercard', 'padding', 'var(--space-3)'],
    ['35-postseason-series.css', '.psseries__upcominglist', 'list-style', 'none'],
    ['35-postseason-series.css', '.psseries__upcominglist', 'margin', '0'],
    ['35-postseason-series.css', '.psseries__upcominglist', 'padding', '0'],
    ['36-postseason-leaders.css', '.psleaders__teamboard', 'padding', 'var(--space-3)'],
    ['37-all-star-rosters.css', '.allstarrosters__year', 'padding', 'var(--space-2) var(--space-3)'],
    ['37-all-star-rosters.css', '.allstarrosters__year', 'display', 'flex'],
    ['37-all-star-rosters.css', '.allstarrosters__rows', 'list-style', 'none'],
    ['37-all-star-rosters.css', '.allstarrosters__rows', 'margin', '0'],
    ['37-all-star-rosters.css', '.allstarrosters__rows', 'padding', '0'],
    ['37-all-star-rosters.css', '.allstargame', 'padding', 'var(--space-2) var(--space-3)'],
    ['37-all-star-rosters.css', '.allstargame', 'width', '100%'],
    ['42-first-scorebook.css', '.allstarlegacy__leadercard', 'padding', 'var(--space-3)'],
    ['42-first-scorebook.css', '.allstarlegacy__leadercard', 'display', 'flex'],
    ['42-first-scorebook.css', '.allstarlegacy__teamcard', 'padding', 'var(--space-3)'],
  ]
  for (const [css, sel, prop, value] of kept) {
    assert.equal(decl(ruleBody(read(css), sel) ?? '', prop), value, `${css}: ${sel} keeps ${prop}: ${value}`)
  }
  const imports = importOrder()
  const card = imports.indexOf('system/card.css')
  // These partials load with their screen (index.css names none of them), so
  // they come after index.css and the Card; if one moves into index.css, it must
  // sit after system/card.css.
  for (const rel of new Set(C6A.map((c) => c.css))) {
    const at = imports.indexOf(rel)
    assert.ok(at === -1 || at > card, `${rel} loads after system/card.css`)
  }
  assert.match(src('main.jsx'), /^import '\.\/index\.css'$/m, 'index.css (and so the Card) loads with the app shell')
})

// The bracket connector lines stick out of the seed tile (right: -13px, left:
// -13px, left: 100%). Card clips its edge, so the seed tile opts out, and the
// tile has no head for a clip to serve.
test('C6a: the seed tile does not clip, so the bracket connectors still show', () => {
  const body = ruleBody(read('34-postseason.css'), '.seed')
  assert.equal(decl(body, 'overflow'), 'visible')
  for (const [css, sel] of [['34-postseason.css', '.psbracket__col--al .seed::after'], ['70-postseason-race.css', '.psrace__round--wc .seed::after']]) {
    assert.ok(read(css).includes(sel), `${css}: ${sel} still draws a connector`)
  }
})

// The seed tile's own 2px ring is Card's now (both are the heavy rule in the
// focus colour), so no rule of its own is left.
test('C6a: the seed tile takes the Card focus ring', () => {
  assert.equal(ruleBody(read('34-postseason.css'), '.seed:focus-visible'), null)
})

// The two lists are lists inside a flush Card; the Card is a div.
test('C6a: the upcoming games and the roster rows are <ul>s inside a flush Card div', () => {
  for (const [rel, ns] of [
    ['screens/postseason-live/LiveSeriesPage.jsx', 'psseries__upcominglist'],
    ['screens/AllStarRostersPage.jsx', 'allstarrosters__rows'],
  ]) {
    const code = src(rel)
    assert.match(code, new RegExp(`<Card as="div" body="flush">\\s*<ul className="${ns}">`), `${rel}: .${ns}`)
  }
})

// Strict, comments too: a comment that names a retired class sends the next
// reader to a rule that does not exist. docs/design-system-naming.md keeps the
// old name, since the ledger records it.
const RETIRED_C6A = /(^|[^\w-])seedcard(?![a-z0-9])/
test('C6a: .seedcard is gone from stylesheets, markup, comments, e2e, scripts and the lab', () => {
  const ROOT = join(SRC, '..')
  const inSrc = files(SRC, ['.css', '.jsx', '.js', '.md']).filter((rel) => RETIRED_C6A.test(readFileSync(join(SRC, rel), 'utf8')))
  const inE2e = files(join(ROOT, 'e2e'), ['.js', '.mjs']).filter((rel) => RETIRED_C6A.test(readFileSync(join(ROOT, 'e2e', rel), 'utf8')))
  const inScripts = files(join(ROOT, 'scripts'), ['.js', '.mjs']).filter((rel) => RETIRED_C6A.test(readFileSync(join(ROOT, 'scripts', rel), 'utf8')))
  assert.deepEqual([...inSrc, ...inE2e, ...inScripts], [])
})

// THE SEAL PIN. Measured on origin/main before this slice changed a line: for
// each file the slice touches, the reveal-only modules it imports, and how many
// SealBoxes and revealedThrough reads it holds. A frame move changes none of
// these; the series pages name a game and show its result, never today's score
// (LiveSeriesPage) and never earlier than the date gate lets it. If this fails,
// the slice moved a seal: stop and ask, never update the literal to match.
const C6A_SEAL = {
  'screens/PostseasonHistoryPage.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'screens/PostseasonRacePage.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'screens/PostseasonSeriesPage.jsx': { reveal: ['boxscore.js'], sealBoxes: 0, revealedThrough: 0 },
  'screens/postseason-live/LiveSeriesPage.jsx': { reveal: ['boxscore.js'], sealBoxes: 0, revealedThrough: 0 },
  'components/postseason/SeriesParts.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'screens/PostseasonLeadersPage.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'screens/AllStarRostersPage.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/allstar/AllStarGameResult.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'screens/AllStarLegacyPage.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
}

test('C6a: the seal pin — no reveal-only import, SealBox or revealedThrough read moved', () => {
  for (const [rel, want] of Object.entries(C6A_SEAL)) {
    const code = src(rel)
    assert.deepEqual(revealOnlyImports(rel), want.reveal, `${rel}: its reveal-only imports changed`)
    assert.equal((code.match(/<SealBox\b/g) ?? []).length, want.sealBoxes, `${rel}: a SealBox was added or removed`)
    assert.equal((code.match(/revealedThrough/g) ?? []).length, want.revealedThrough, `${rel}: a revealedThrough read moved`)
  }
})


// ---- slice C6b: people, records and reference pages ----

// Fourteen blocks on the people, records and reference pages that drew their
// own copy of the card. These pages open live (ADR-0034); one block, .umptend,
// also renders in three game screens (the lineup page's top zone, the plate
// accuracy modal and the focus-mode Extras drawer), so for it the slice moves
// the box and nothing else. Each block renders through Card with body="flush":
// each keeps its own padding, which is not the padded body's, so its layout does
// not move (C2 and C4 did the same). Each band or label head stays the Card's
// first child, as it was. Modes:
//   card  the Card IS the block and carries its class.
//   wrap  the Card wraps the block's <ul>, which keeps its class and row rules
//         (Card has no <ul>).
// `gone` means the block's whole rule was the frame, so it has no rule left.
// `frame` is the ledger where the census says so (radius-sm, no shadow).
const C6B = [
  { css: '31-wild-card.css', sel: '.rehabcard', jsx: ['screens/RehabPage.jsx'], ns: 'rehabcard', as: 'article' },
  { css: '31c-prospect-filters.css', sel: '.prospects__filterdeck', jsx: ['screens/ProspectsPage.jsx'], ns: 'prospects__filterdeck' },
  { css: '32-milestone-watch.css', sel: '.milestonewatch-page__card', jsx: ['screens/MilestoneWatchPage.jsx'], ns: 'milestonewatch-page__card', as: 'article' },
  { css: '38-umpire-pages.css', sel: '.umpage__card', jsx: ['screens/UmpirePage.jsx'], ns: 'umpage__card' },
  { css: '38-umpire-pages.css', sel: '.umpage__list', jsx: ['screens/UmpirePage.jsx'], ns: 'umpage__list', mode: 'wrap', as: 'div' },
  { css: '39-manager-page.css', sel: '.mgrpage__card', jsx: ['screens/ManagerPage.jsx'], ns: 'mgrpage__card' },
  { css: '47-trade-deadline.css', sel: '.trade', jsx: ['components/transactions/TradeCard.jsx'], ns: 'trade', as: 'article' },
  { css: '53-umpire-tendencies.css', sel: '.umptend', jsx: ['components/umpire/UmpireTendencies.jsx'], ns: 'umptend', gone: true },
  { css: '59-more-directory.css', sel: '.moredir__card', jsx: ['screens/MorePage.jsx'], ns: 'moredir__card', frame: 'ledger' },
  { css: '65-about-page.css', sel: '.aboutrule', jsx: ['screens/AboutPage.jsx'], ns: 'aboutrule', as: 'article', frame: 'ledger', gone: true },
  // A link card: the whole tile is the tap target. It keeps its own heavy top edge.
  { css: '66-situational-records.css', sel: '.trrank__tile', jsx: ['screens/SituationalRecordsPage.jsx'], ns: 'trrank__tile', as: 'a' },
  { css: 'situational-records/66a-detail.css', sel: '.trrank__podiumcard', jsx: ['screens/SituationalRecordsPage.jsx'], ns: 'trrank__podiumcard', as: 'div' },
  { css: '71-salaries-league.css', sel: '.payboard', jsx: ['components/salaries/SalaryBoard.jsx'], ns: 'payboard', gone: true },
  { css: '76-workload-marks.css', sel: '.penpage__grid', jsx: ['screens/around-the-game/BullpenPage.jsx'], ns: 'penpage__grid', as: 'div', frame: 'ledger' },
]
// Every plain element (not a Card) whose opening tag names the class.
const bareTags = (code, ns) =>
  [...code.matchAll(/<(?:div|section|li|article|aside|ul|ol|dl|a|button)\b([^>]*)>/g)].map((m) => m[1]).filter((attrs) => namesClass(attrs, ns))

test('C6b: no people, records or reference block draws a second frame over its Card', () => {
  for (const { css, sel, gone } of C6B) {
    const bodies = bodiesOf(read(css), sel)
    if (gone) assert.equal(bodies.length, 0, `${css}: ${sel} was only a frame, so it has no rule`)
    else assert.ok(bodies.length > 0, `${css}: a ${sel} rule`)
    for (const body of bodies) assert.deepEqual(frameDecls(body), [], `${css}: ${sel} still draws its own frame`)
  }
})

test('C6b: every block renders on Card, with its frame, no head prop and a flush body', () => {
  for (const { jsx, ns, mode = 'card', as, frame } of C6B) {
    for (const rel of jsx) {
      const code = src(rel)
      assert.match(code, /import \{ Card \} from ["'][\w./]+\/ui\/frame\/Card\.jsx["']/, `${rel} imports Card`)
      const tags = mode === 'wrap' ? wrappingTags(code, ns) : cardTags(code).filter((attrs) => namesClass(attrs, ns))
      assert.ok(tags.length > 0, `${rel}: .${ns} renders ${mode === 'wrap' ? 'inside' : 'on'} a Card`)
      for (const attrs of tags) {
        assert.match(attrs, /body="flush"/, `${rel}: .${ns}'s Card keeps the block's own inset`)
        if (frame) assert.match(attrs, new RegExp(`frame="${frame}"`), `${rel}: .${ns} is a ${frame}`)
        else assert.doesNotMatch(attrs, /frame=/, `${rel}: .${ns} is a sheet (the default)`)
        if (as) assert.match(attrs, new RegExp(`as="${as}"`), `${rel}: .${ns} is a Card ${as}`)
        assert.doesNotMatch(attrs, /head=/, `${rel}: .${ns} keeps its head as the Card's first child, as before`)
      }
      if (mode === 'card') {
        assert.deepEqual(bareTags(code, ns), [], `${rel}: .${ns} is on a bare element`)
      } else {
        // The list stays a <ul> inside the Card, and every one sits in one.
        const uses = code.match(new RegExp(`className=\\{?["'\`]${ns}(?![\\w-])`, 'g')) ?? []
        assert.equal(uses.length, tags.length, `${rel}: every .${ns} sits inside a Card`)
        assert.match(code, new RegExp(`<ul\\s+className="${ns}"`), `${rel}: .${ns} is still a list`)
      }
    }
  }
})

// Card owns no margin, and a flush body adds no padding, so each block keeps
// the space, the inset and the edge that is its own, in a namespace rule.
test('C6b: each block keeps its own margin, inset and own edge', () => {
  const kept = [
    ['31-wild-card.css', '.rehabcard', 'padding', 'var(--space-3) var(--space-3) var(--space-4)'],
    ['31c-prospect-filters.css', '.prospects__filterdeck', 'margin', 'var(--space-3) 0'],
    ['31c-prospect-filters.css', '.prospects__filterdeck', 'padding', 'var(--space-3)'],
    ['31c-prospect-filters.css', '.prospects__filterdeck', 'border-top', 'var(--bw-heavy) solid var(--accent-primary)'],
    ['32-milestone-watch.css', '.milestonewatch-page__card', 'padding', 'var(--space-3)'],
    ['38-umpire-pages.css', '.umpage__card', 'padding', 'var(--space-3)'],
    ['38-umpire-pages.css', '.umpage__list', 'list-style', 'none'],
    ['38-umpire-pages.css', '.umpage__list', 'margin', '0'],
    ['38-umpire-pages.css', '.umpage__list', 'padding', '0'],
    ['39-manager-page.css', '.mgrpage__card', 'padding', 'var(--space-3)'],
    ['39-manager-page.css', '.mgrpage__card', 'margin-bottom', '12px'],
    ['47-trade-deadline.css', '.trade', 'padding', 'var(--space-3) var(--space-4)'],
    ['59-more-directory.css', '.moredir__card', 'padding', 'var(--space-3)'],
    ['66-situational-records.css', '.trrank__tile', 'display', 'flex'],
    ['66-situational-records.css', '.trrank__tile', 'min-width', '0'],
    ['66-situational-records.css', '.trrank__tile', 'border-top', 'var(--bw-heavy) solid var(--trrank-edge)'],
    ['situational-records/66a-detail.css', '.trrank__podiumcard', 'padding', 'var(--space-3) var(--space-2)'],
    ['76-workload-marks.css', '.penpage__grid', 'padding', 'var(--space-4)'],
  ]
  for (const [css, sel, prop, value] of kept) {
    assert.equal(decl(ruleBody(read(css), sel) ?? '', prop), value, `${css}: ${sel} keeps ${prop}: ${value}`)
  }
})

// The record tile lifts and raises its shadow under a mouse. Card's hover tint
// sets border-color on all four sides, so the tile's own rule (same weight,
// loads later) puts its heavy top edge back on hover.
test('C6b: the record tile keeps its lift and its top edge on hover', () => {
  const css = read('66-situational-records.css')
  const hover = bodiesOf(css, '.trrank__tile:hover')[0] ?? ''
  assert.equal(decl(hover, 'transform'), 'translateY(-2px)')
  assert.equal(decl(hover, 'box-shadow'), 'var(--shadow-raised)')
  assert.equal(decl(hover, 'border-top-color'), 'var(--trrank-edge)')
  const base = ruleBody(css, '.trrank__tile') ?? ''
  assert.match(decl(base, 'transition') ?? '', /border-color[^,]*,\s*background-color/, 'the hover tint eases in, as it does on every Card link')
})

// The tendencies card renders in four hosts. Three shed its frame (the umpire
// modal, and the Extras drawer, whose own chrome frames it) or place it (the
// lineup page's top zone). Each host rule names two classes, so it beats .card
// on weight, and each partial loads after card.css. The card's band stays the
// house navy on a themed page (ADR-0030): it keeps its `house` switch.
test('C6b: the umpire tendencies card keeps its house band and its four hosts', () => {
  assert.match(src('components/umpire/UmpireTendencies.jsx'), /<SectionHead\b[^>]*\bhouse\b/, 'the band is the house band')
  const css = read('53-umpire-tendencies.css')
  const shed = { border: '0', 'border-radius': '0', 'box-shadow': 'none' }
  for (const sel of ['.umpmodal .umptend', '.umptendfold .umptend']) {
    const body = ruleBody(css, sel)
    assert.ok(body, `53-umpire-tendencies.css: ${sel}`)
    for (const [prop, value] of Object.entries(shed)) assert.equal(decl(body, prop), value, `${sel} sheds ${prop}`)
    assert.ok((sel.match(/\./g) ?? []).length > 1, `${sel} outranks .card`)
  }
  assert.equal(decl(ruleBody(css, '.umptendfold .umptend__bar') ?? '', 'display'), 'none')
  assert.equal(decl(ruleBody(css, '.teaminfo__topzone > .umptend') ?? '', 'margin-top'), '14px')
  assert.ok(css.includes('.teaminfo__topzone:has(> .umptend) > .umptend'), 'the wide zone still top-aligns the card')
  assert.ok(css.includes('.teaminfo__topzone:has(> .umptend) {'), 'the wide zone still splits on the card')
  // The three game screens still host the card under those class names.
  assert.match(src('components/umpire/UmpireAccuracyModal.jsx'), /umpmodal/)
  assert.match(src('components/umpire/UmpireTendenciesFold.jsx'), /umptendfold/)
  assert.match(src('screens/TeamInfo.jsx'), /teaminfo__topzone/)
})

// The card is the box and nothing else: the tendencies card adds no reveal-only
// import (ADR-0001). Written before the change, so it pins what was there.
test('C6b: the umpire tendencies card adds no reveal-only import', () => {
  const code = src('components/umpire/UmpireTendencies.jsx')
  assert.doesNotMatch(code, /from ['"][./]+\/api\/(linescore|derive)\.js['"]/)
  assert.doesNotMatch(code, /<SealBox|revealedThrough/)
})

// The ADR-0084 rename. Strict, comments too: a comment that names the retired
// class sends the next reader to a rule that does not exist. The naming ledger
// (docs/) keeps the old name on purpose.
const RETIRED_C6B = /(^|[^\w-])tradecard(?![a-z0-9-])/
test('C6b: .tradecard is .trade, gone from stylesheets, markup, comments and the lab', () => {
  const css = files(STYLES, ['.css']).filter((rel) => RETIRED_C6B.test(readFileSync(join(STYLES, rel), 'utf8')))
  const code = files(SRC, ['.jsx', '.js', '.md'])
    .filter((rel) => !rel.startsWith('styles/'))
    .filter((rel) => RETIRED_C6B.test(readFileSync(join(SRC, rel), 'utf8')))
  const guard = readFileSync(join(SRC, '..', 'scripts', 'check-seal-scope.mjs'), 'utf8')
  assert.deepEqual([...css, ...code], [])
  assert.doesNotMatch(guard, RETIRED_C6B)
  const lab = src('screens/designlab/catalog.js')
  assert.match(lab, /cls: 'card card--sheet trade'/)
  assert.match(lab, /cls: 'card card--sheet rehabcard'/)
})

// The lab's specimens are drawn from the class list alone, so each keeps the
// shape its Card takes.
test('C6b: the ledger frames stay ledgers, and the ledger keeps the old .tradecard name', () => {
  assert.match(src('screens/AboutPage.jsx'), /<Card as="article" frame="ledger" body="flush"[^>]*className="aboutrule"/)
  assert.match(src('screens/around-the-game/BullpenPage.jsx'), /<Card as="div" frame="ledger" body="flush" className="penpage__grid"/)
  const ledger = readFileSync(join(SRC, '..', 'docs', 'design-system-naming.md'), 'utf8')
  assert.match(ledger, /\| `\.tradecard` \|/)
})


// ---- slice C6c: fouls, offseason and the off-day tile ----

// Nine blocks that drew their own copy of the card, on the /fouls page, the
// offseason pages and the slate's off-day row, plus the "Players who moved up"
// table, which drew no frame at all. These pages open live (ADR-0034), and the
// slice moves a box and nothing else. Each block keeps its own inset, which is
// not the padded body's, so each takes body="flush" (C2 to C6b did the same).
// Each head stays where it was: no head prop, no SectionHead edit. Modes:
//   card  the Card IS the block and carries its class.
//   wrap  the Card wraps the block's <ol>, which keeps its class and row rules
//         (Card has no <ol>). The Card takes the margin the list had.
// `ground` names the inner gap-rule grid that keeps its --border-rule ground:
// the Card paints --surface-card, so the ground lives inside it (C2's
// .factgrid__grid).
const C6C = [
  { css: '06b-offday-cards.css', sel: '.offday__tile', jsx: ['components/team/OffDaySection.jsx'], ns: 'offday__tile', as: 'button' },
  { css: '43-foul-tracker.css', sel: '.foulboard__hero', jsx: ['screens/FoulTrackerPage.jsx'], ns: 'foulboard__hero', as: 'div', keep: ['overflow'] },
  { css: '43-foul-tracker.css', sel: '.foulavg', jsx: ['screens/FoulTrackerPage.jsx'], ns: 'foulavg', as: 'div' },
  { css: '43-foul-tracker.css', sel: '.gamehigh-tiles', jsx: ['screens/FoulTrackerPage.jsx'], ns: 'gamehigh-tiles', as: 'div', frame: 'ledger', ground: '.gamehigh-tiles__grid' },
  { css: '43-foul-tracker.css', sel: '.souvenir-row__tiles', jsx: ['screens/FoulTrackerPage.jsx'], ns: 'souvenir-row__tiles', as: 'div', frame: 'ledger', ground: '.souvenir-row__tilegrid' },
  { css: '78-offseason.css', sel: '.springcount', jsx: ['components/offseason/WinterCalendar.jsx'], ns: 'springcount', as: 'aside', frame: 'ledger' },
  { css: '78-offseason.css', sel: '.pgame__card', jsx: ['components/offseason/PickedGame.jsx'], ns: 'pgame__card', as: 'div' },
  { css: '78-offseason.css', sel: '.srecord', jsx: ['components/offseason/SeasonRecord.jsx'], ns: 'srecord' },
  { css: '78-offseason.css', sel: '.seasonnote__stories', jsx: ['components/offseason/LongAtBats.jsx'], ns: 'seasonnote__stories', mode: 'wrap', box: 'seasonnote__storybox' },
]

test('C6c: no fouls, offseason or off-day block draws a second frame over its Card', () => {
  for (const { css, sel, keep = [] } of C6C) {
    const bodies = bodiesOf(read(css), sel)
    assert.ok(bodies.length > 0, `${css}: a ${sel} rule`)
    for (const body of bodies) assert.deepEqual(frameDecls(body, keep), [], `${css}: ${sel} still draws its own frame`)
  }
  // The hero opts out of the clip, so its long name is cut by the board Card at 320px, as before.
  assert.equal(decl(ruleBody(read('43-foul-tracker.css'), '.foulboard__hero') ?? '', 'overflow'), 'visible')
  // The clip is the Card's now, so the labelled record row no longer asks for it.
  assert.equal(decl(ruleBody(read('78-offseason.css'), '.srecord--labelled') ?? '', 'overflow'), undefined)
})

test('C6c: every block renders on Card, with its frame and a flush body', () => {
  for (const { jsx, ns, mode = 'card', as, frame, box } of C6C) {
    for (const rel of jsx) {
      const code = src(rel)
      assert.match(code, /import \{ Card \} from ["'][\w./]+\/ui\/frame\/Card\.jsx["']/, `${rel} imports Card`)
      const tags =
        mode === 'wrap'
          ? wrappingTags(code, ns)
          : cardTags(code).filter((attrs) => namesClass(attrs, ns))
      assert.ok(tags.length > 0, `${rel}: .${ns} renders ${mode === 'wrap' ? 'inside' : 'on'} a Card`)
      for (const attrs of tags) {
        assert.match(attrs, /body="flush"/, `${rel}: .${ns}'s Card keeps the block's own inset`)
        if (frame) assert.match(attrs, new RegExp(`frame="${frame}"`), `${rel}: .${ns} is a ${frame}`)
        else assert.doesNotMatch(attrs, /frame=/, `${rel}: .${ns} is a sheet (the default)`)
        if (as) assert.match(attrs, new RegExp(`as="${as}"`), `${rel}: .${ns} is a Card ${as}`)
        if (mode === 'wrap') assert.match(attrs, /as="div"/, `${rel}: the list sits in a Card div`)
        if (box) assert.ok(namesClass(attrs, box), `${rel}: the Card carries .${box}`)
        assert.doesNotMatch(attrs, /head=/, `${rel}: .${ns} keeps its head where it was`)
      }
      const bare = bareTags(code, ns)
      if (mode === 'wrap') assert.ok(bare.every((a) => /^\s*className=/.test(a)), `${rel}: the list is a plain <ol>`)
      else assert.deepEqual(bare, [], `${rel}: .${ns} is on a bare element`)
    }
  }
})

// Card owns no margin, and a flush body adds no inset, so each block keeps the
// space and the inset that were its own, in its namespace rule.
test('C6c: each block keeps its own margin and inset', () => {
  const kept = [
    ['06b-offday-cards.css', '.offday__tile', 'padding', 'var(--space-2) var(--space-1h)'],
    ['06b-offday-cards.css', '.offday__tile', 'display', 'flex'],
    ['43-foul-tracker.css', '.foulboard__hero', 'margin-bottom', '10px'],
    ['43-foul-tracker.css', '.foulboard__hero', 'padding', 'var(--space-2h) var(--space-3)'],
    ['43-foul-tracker.css', '.foulavg', 'margin-top', 'var(--space-3)'],
    ['43-foul-tracker.css', '.foulavg', 'padding', 'var(--space-3) var(--space-3h)'],
    ['43-foul-tracker.css', '.sgh-list', 'list-style', 'none'],
    ['43-foul-tracker.css', '.sgh-list', 'margin', '0'],
    ['43-foul-tracker.css', '.sgh-list', 'padding', '0'],
    ['43-foul-tracker.css', '.gamehigh-tiles', 'grid-area', 'tiles'],
    ['43-foul-tracker.css', '.souvenir-row__tiles', 'flex', 'none'],
    ['78-offseason.css', '.springcount', 'margin-top', 'var(--space-6)'],
    ['78-offseason.css', '.springcount', 'padding', 'var(--space-4)'],
    ['78-offseason.css', '.pgame__card', 'padding', 'var(--space-5) var(--space-4)'],
    ['78-offseason.css', '.srecord', 'margin-top', 'var(--space-6)'],
    ['78-offseason.css', '.srecord__body', 'padding', 'var(--space-4)'],
    ['78-offseason.css', '.seasonnote__stories', 'list-style', 'none'],
    ['78-offseason.css', '.seasonnote__stories', 'margin', '0'],
    ['78-offseason.css', '.seasonnote__stories', 'padding', '0'],
    ['78-offseason.css', '.seasonnote__storybox', 'margin-top', 'var(--space-4)'],
  ]
  for (const [css, sel, prop, value] of kept) {
    assert.equal(decl(ruleBody(read(css), sel) ?? '', prop), value, `${css}: ${sel} keeps ${prop}: ${value}`)
  }
})

// .sgh-list is an <ol> that sits in a board's Card, under its masthead. The
// board rule below already bled it to that Card's edge and shed its frame, so
// the list's own frame never drew. The Card is the board's, and a second Card
// round the list would draw a card inside a card: the list takes no Card.
test('C6c: the souvenir lists sit in their board Card and draw no frame of their own', () => {
  const css = read('43-foul-tracker.css')
  for (const sel of ['.sgh-list', '.foulboard-block .sgh-list']) {
    for (const body of bodiesOf(css, sel)) assert.deepEqual(frameDecls(body), [], `${sel} draws no frame`)
  }
  const board = src('screens/FoulTrackerPage.jsx')
  assert.match(board, /<Card className="metric foulboard-block" head=\{head\} body="flush">/)
  assert.equal((board.match(/<Card\b[^>]*>\s*<ol className="sgh-list"/g) ?? []).length, 0)
})

// The two gap-rule grids keep their --border-rule ground: the Card paints
// --surface-card, so the 1px rules between the tiles are the grid's own ground,
// inside the Card.
test('C6c: the two tile grids keep their --border-rule ground inside a ledger Card', () => {
  for (const { css, sel, ground } of C6C.filter((row) => row.ground)) {
    const body = ruleBody(read(css), ground)
    assert.ok(body, `${css}: a ${ground} rule`)
    assert.equal(decl(body, 'background'), 'var(--border-rule)', `${ground} keeps the rule ground`)
    assert.equal(decl(body, 'gap'), '1px', `${ground} keeps its 1px rules`)
    const code = src('screens/FoulTrackerPage.jsx')
    const ns = sel.slice(1)
    const inner = ground.slice(1)
    assert.match(
      code,
      new RegExp(`<Card\\b[^>]*className="${ns}"[^>]*>\\s*<div className="${inner}">`),
      `${ns} holds ${inner} in a Card`,
    )
  }
  const css = read('43-foul-tracker.css')
  assert.ok(css.includes('.gamehigh-tiles__grid .stat'), 'the tile cells keep their reset')
  assert.ok(css.includes('.souvenir-row__tilegrid .stat'), 'the tile cells keep their reset')
})

// The table had no frame. It takes the canonical sheet, which Gary approved on
// #1113. The head stays above the Card, and the pool note and the "more" door
// stay outside it.
test('C6c: the moved-up table sits in a flush sheet Card and its head stays outside', () => {
  const code = src('components/offseason/MovedUp.jsx')
  assert.match(code, /import \{ Card \} from ["']..\/ui\/frame\/Card\.jsx["']/)
  const m = code.match(/<\/SectionHead>\s*<Card\b([^>]*)>\s*<table className="movedup__table">[\s\S]*?<\/table>\s*<\/Card>/)
  assert.ok(m, 'the table is the Card\'s only child, straight after the head')
  assert.match(m[1], /as="div"/)
  assert.doesNotMatch(m[1], /frame=/, 'the table is a sheet (the default)')
  assert.match(m[1], /body="flush"/)
  assert.doesNotMatch(m[1], /head=/)
  assert.ok(namesClass(m[1], 'movedup__card'))
  assert.match(code, /<\/Card>\s*\{\(hidden > 0 \|\| expanded\) && \(/, 'the "more" door is outside the Card')
  const css = read('78-offseason.css')
  assert.equal(decl(ruleBody(css, '.movedup__card') ?? '', 'margin-top'), 'var(--space-2)')
  assert.equal(decl(ruleBody(css, '.movedup__table') ?? '', 'margin-top'), undefined, 'the gap is the Card\'s now')
  // The Card is flush, so the first and last cell of a row keep the inset.
  assert.ok(css.includes('.movedup__table :is(th, td):first-child'))
  assert.ok(css.includes('.movedup__table :is(th, td):last-child'))
  assert.doesNotMatch(css, /PROVISIONAL, in the same way the \.movedup|THE \.movedup ROWS ARE PROVISIONAL/)
})

// The two names Gary keeps until he picks a look (H2, 2026-09-29).
test('C6c: the big card names keep their rules', () => {
  const css = read('78-offseason.css')
  assert.equal(decl(ruleBody(css, '.seasonnote__title') ?? '', 'font-size'), 'var(--fs-title-md)')
  assert.equal(decl(ruleBody(css, '.srecord__title') ?? '', 'font-size'), 'var(--fs-title-sm)')
  assert.match(src('components/offseason/SeasonRecord.jsx'), /<h3 className="srecord__title">Season record<\/h3>/)
  assert.match(src('components/offseason/LongAtBats.jsx'), /<h4 className="seasonnote__title">/)
})

// The ADR-0084 rename. Strict, comments too. The naming ledger (docs/) keeps
// the old name on purpose.
const RETIRED_C6C = /(^|[^\w-])offdaycard(?![a-z0-9-])/
test('C6c: .offdaycard is .offday__tile, gone from stylesheets, markup, comments, e2e, scripts and the lab', () => {
  const root = join(SRC, '..')
  const found = [
    ...files(STYLES, ['.css']).map((rel) => join(STYLES, rel)),
    ...files(SRC, ['.jsx', '.js', '.md']).map((rel) => join(SRC, rel)),
    ...files(join(root, 'e2e'), ['.js', '.mjs']).map((rel) => join(root, 'e2e', rel)),
    ...files(join(root, 'scripts'), ['.js', '.mjs', '.md']).map((rel) => join(root, 'scripts', rel)),
  ].filter((abs) => RETIRED_C6C.test(readFileSync(abs, 'utf8')))
  assert.deepEqual(found.map((abs) => relative(root, abs)), [])
  assert.match(src('screens/designlab/catalog.js'), /cls: 'card card--sheet card--interactive offday__tile'/)
  const ledger = readFileSync(join(root, 'docs', 'design-system-naming.md'), 'utf8')
  assert.match(ledger, /\| `\.offdaycard` \|/)
})

// The parts carry the new namespace, and the tile still holds its club accent:
// the hover tint mixes --offday-accent (ADR-0050), so the Card takes it by
// NAME and the tile's own hover rule still reads it.
test('C6c: the off-day tile is a Card button that keeps its club accent and its parts', () => {
  const code = src('components/team/OffDaySection.jsx')
  const tag = code.match(/<Card\b([^>]*)>/)?.[1] ?? ''
  assert.match(tag, /as="button"/)
  assert.match(tag, /accent="--offday-accent"/)
  assert.match(tag, /onClick=\{onOpen\}/)
  assert.match(tag, /aria-label=/)
  assert.match(tag, /style=\{cardStyle\}/)
  assert.match(code, /'--pin-accent'[\s\S]*'--offday-accent'/)
  assert.match(code, /offday__tile--pinned/)
  assert.match(code, /offday__logobox--pinstripe/)
  for (const part of ['logobox', 'name', 'loc', 'mascot', 'pin']) assert.ok(code.includes(`offday__${part}`), `offday__${part}`)
  const css = read('06b-offday-cards.css')
  assert.ok(css.includes('var(--offday-accent, var(--field))'), 'the hover tint keeps its accent')
  assert.ok(ruleBody(css, '.offday__tile--pinned'), 'the pinned state')
  assert.ok(ruleBody(css, '.offday__logobox.offday__logobox--pinstripe'), 'the pinstripe box')
  // The Card owns the tap target's face and its focus ring.
  const tile = ruleBody(css, '.offday__tile') ?? ''
  for (const prop of ['cursor', 'font', 'color']) assert.equal(decl(tile, prop), undefined, `.offday__tile leaves ${prop} to the Card`)
  assert.equal(decl(ruleBody(css, '.offday__tile:focus-visible') ?? '', 'outline'), undefined)
  // The Card's hover tint eases in again: the tile's transition list names the ground.
  const eases = bodiesOf(css, '.offday__tile').map((b) => decl(b, 'transition') ?? '')
  assert.ok(eases.some((t) => /background-color/.test(t)), 'the hover tint eases in')
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.offday__tile,[\s\S]*?transition: none;/)
})

// ---- slice C7: account, logbook and chrome ----

// Twelve blocks on the site menu, the First Scorebook, the Logbook stats page,
// My Tally's sign-in pitch and the game-preview poster page. The Logbook
// stats page is stamp-adjacent: it counts stamps and draws no stamp art, and
// none of these files is a stamp surface (ADR-0035), so the slice moves boxes
// and nothing else. Each block renders through Card with body="flush": each
// keeps its own padding, which is not the padded body's, so its layout does
// not move. Each head stays the Card's first child, as it was. `button` means
// the tile is a <button> that navigates: the Card is rendered by the link
// helper (ScorebookGameLink, LogbookGameLink) when a caller passes `card`.
// `gone` means the block's whole rule was the frame, so it has no rule left.
const C7 = [
  { css: '08a-site-menu.css', sel: '.sitemenusheet__group', jsx: ['components/chrome/SiteMenu.jsx'], ns: 'sitemenusheet__group', keep: ['overflow'] },
  { css: '42-first-scorebook.css', sel: '.scorebookstory__gamecard', jsx: ['screens/FirstScorebookPage.jsx'], ns: 'scorebookstory__gamecard', button: true, frame: 'ledger' },
  { css: '42-first-scorebook.css', sel: '.scorebookstory__performer', jsx: ['screens/FirstScorebookPage.jsx'], ns: 'scorebookstory__performer', button: true, frame: 'ledger' },
  { css: '42-first-scorebook.css', sel: '.scorebookstory__leaders', jsx: ['screens/FirstScorebookPage.jsx'], ns: 'scorebookstory__leaders', as: 'div', frame: 'ledger', gone: true },
  { css: '42-first-scorebook.css', sel: '.scorebookstory__nugget', jsx: ['screens/FirstScorebookPage.jsx'], ns: 'scorebookstory__nugget', as: 'article', frame: 'ledger' },
  { css: '48a-logbook-stats.css', sel: '.logbookstats__split', jsx: ['screens/LogbookStatsPage.jsx'], ns: 'logbookstats__split', as: 'div', frame: 'ledger' },
  { css: '48a-logbook-stats.css', sel: '.logbookstats__streak', jsx: ['screens/LogbookStatsPage.jsx'], ns: 'logbookstats__streak', as: 'article', frame: 'ledger' },
  { css: '48a-logbook-stats.css', sel: '.logbookstats__record', jsx: ['screens/LogbookStatsPage.jsx'], ns: 'logbookstats__record', as: 'div', frame: 'ledger' },
  { css: '48a-logbook-stats.css', sel: '.logbookstats__performer', jsx: ['screens/logbook/RetrospectiveSections.jsx'], ns: 'logbookstats__performer', button: true, frame: 'ledger' },
  { css: '48a-logbook-stats.css', sel: '.logbookstats__leaders', jsx: ['screens/logbook/RetrospectiveSections.jsx'], ns: 'logbookstats__leaders', as: 'div', frame: 'ledger', gone: true },
  { css: '55-my-tally-account.css', sel: '.mytally__pitch', jsx: ['components/profile/ProfileAccount.jsx'], ns: 'mytally__pitch', as: 'div' },
  { css: '62-game-preview.css', sel: '.posterstudio__panel', jsx: ['screens/GamePreview.jsx'], ns: 'posterstudio__panel', as: 'div' },
]
const C7_FILES = [...new Set(C7.flatMap(({ jsx }) => jsx)), 'screens/logbook/statsShared.jsx']
// The link helpers: the one place a tap tile's Card is drawn.
const C7_HELPERS = [
  { rel: 'screens/FirstScorebookPage.jsx', name: 'ScorebookGameLink' },
  { rel: 'screens/logbook/statsShared.jsx', name: 'LogbookGameLink' },
]

test('C7: no account, logbook or chrome block draws a second frame over its Card, media queries too', () => {
  for (const { css, sel, gone, keep = [] } of C7) {
    const bodies = bodiesOf(read(css), sel)
    if (gone) assert.equal(bodies.length, 0, `${css}: ${sel} was only a frame, so it has no rule`)
    else assert.ok(bodies.length > 0, `${css}: a ${sel} rule`)
    for (const body of bodies) assert.deepEqual(frameDecls(body, keep), [], `${css}: ${sel} still draws its own frame`)
  }
})

// Card clips its edge, and a clipped grid item shrinks to a minimum height of 0.
// The wide site menu lays its groups out in a grid inside a sheet of fixed
// height, so a clipped group would be squeezed and cut. It does not clip.
test('C7: a site-menu group does not clip, so the wide menu keeps its row heights', () => {
  assert.equal(decl(ruleBody(read('08a-site-menu.css'), '.sitemenusheet__group') ?? '', 'overflow'), 'visible')
  assert.match(read('08a-site-menu.css'), /@media \(min-width: 740px\)[\s\S]*\.sitemenusheet__scroll\s*\{[^}]*display: grid/)
})

test('C7: every block renders on Card, with its frame, a flush body and every copy moved', () => {
  for (const { jsx, ns, as, frame, button } of C7) {
    for (const rel of jsx) {
      const code = src(rel)
      assert.match(code, /import \{ Card \} from ["'][\w./]+\/ui\/frame\/Card\.jsx["']/, `${rel} imports Card`)
      const uses = code.match(new RegExp(`className=\\{?["'\`]${ns}(?![\\w-])`, 'g')) ?? []
      assert.ok(uses.length > 0, `${rel}: .${ns} is used`)
      assert.deepEqual(bareTags(code, ns), [], `${rel}: .${ns} is on a bare element`)
      if (button) {
        // Every caller passes `card`; the helper draws the Card button.
        const callers = [...code.matchAll(/<(?:ScorebookGameLink|LogbookGameLink)\b([^>]*)>/g)].map((m) => m[1]).filter((a) => namesClass(a, ns))
        assert.equal(callers.length, uses.length, `${rel}: every .${ns} goes through the link helper`)
        for (const attrs of callers) assert.match(attrs, /\bcard\b/, `${rel}: .${ns} asks the helper for a Card`)
      } else {
        const tags = cardTags(code).filter((attrs) => namesClass(attrs, ns))
        assert.equal(tags.length, uses.length, `${rel}: every .${ns} is a Card`)
        for (const attrs of tags) {
          assert.match(attrs, /body="flush"/, `${rel}: .${ns}'s Card keeps the block's own inset`)
          if (frame) assert.match(attrs, new RegExp(`frame="${frame}"`), `${rel}: .${ns} is a ${frame}`)
          else assert.doesNotMatch(attrs, /frame=/, `${rel}: .${ns} is a sheet (the default)`)
          if (as) assert.match(attrs, new RegExp(`as="${as}"`), `${rel}: .${ns} is a Card ${as}`)
          assert.doesNotMatch(attrs, /head=/, `${rel}: .${ns} keeps its head as the Card's first child, as before`)
        }
      }
    }
  }
})

test('C7: the game and performer tiles are Card buttons with no head, and keep onClick, disabled and type', () => {
  for (const { rel, name } of C7_HELPERS) {
    const code = src(rel)
    const fn = code.slice(code.indexOf(`function ${name}`))
    const card = fn.match(/<Card\b([^>]*)>/)
    assert.ok(card, `${rel}: ${name} draws a Card`)
    assert.match(card[1], /as="button"/)
    assert.match(card[1], /frame="ledger"/)
    assert.match(card[1], /body="flush"/)
    assert.doesNotMatch(card[1], /head=/, 'a Card button takes no head')
    assert.match(fn, /onClick:/)
    // The plain button stays for the callers that do not pass `card`.
    assert.match(fn, /<button\s+type="button"/, `${rel}: ${name} keeps its plain button`)
  }
  assert.match(src('screens/logbook/statsShared.jsx'), /disabled: !game/)
})

test('C7: each block keeps its own margin, inset and layout, from a rule that loads after card.css', () => {
  const kept = [
    ['08a-site-menu.css', '.sitemenusheet__group', 'padding', 'var(--space-3)'],
    ['08a-site-menu.css', '.sitemenusheet__group + .sitemenusheet__group', 'margin-top', 'var(--space-2)'],
    ['42-first-scorebook.css', '.scorebookstory__gamecard', 'display', 'grid'],
    ['42-first-scorebook.css', '.scorebookstory__gamecard', 'padding', 'var(--space-4)'],
    ['42-first-scorebook.css', '.scorebookstory__gamecard', 'min-height', '174px'],
    ['42-first-scorebook.css', '.scorebookstory__performer', 'display', 'grid'],
    ['42-first-scorebook.css', '.scorebookstory__performer', 'padding', 'var(--space-3) var(--space-3) 0'],
    ['42-first-scorebook.css', '.scorebookstory__nugget', 'display', 'grid'],
    ['42-first-scorebook.css', '.scorebookstory__nugget', 'padding', 'var(--space-3)'],
    ['48a-logbook-stats.css', '.logbookstats__split', 'padding', 'var(--space-3)'],
    ['48a-logbook-stats.css', '.logbookstats__streak', 'padding', 'var(--space-4) var(--space-3)'],
    ['48a-logbook-stats.css', '.logbookstats__record', 'padding', 'var(--space-2) var(--space-3)'],
    ['48a-logbook-stats.css', '.logbookstats__record', 'min-height', '50px'],
    ['48a-logbook-stats.css', '.logbookstats__performer', 'padding', 'var(--space-3)'],
    ['55-my-tally-account.css', '.mytally__pitch', 'padding', 'var(--space-4)'],
    ['62-game-preview.css', '.posterstudio__panel', 'padding', 'var(--space-4)'],
    ['62-game-preview.css', '.posterstudio__panel', 'display', 'grid'],
  ]
  for (const [css, sel, prop, value] of kept) {
    assert.equal(decl(ruleBody(read(css), sel) ?? '', prop), value, `${css}: ${sel} keeps ${prop}: ${value}`)
  }
})

test('C7: the game card keeps its lift and its dark edge on hover and focus, and eases the Card tint too', () => {
  const css = read('42-first-scorebook.css')
  const hover = ruleBody(css, '.scorebookstory__gamecard:hover,\n.scorebookstory__gamecard:focus-visible') ?? ''
  assert.equal(decl(hover, 'transform'), 'translateY(-2px)')
  assert.equal(decl(hover, 'border-color'), 'var(--text-heading)')
  const base = ruleBody(css, '.scorebookstory__gamecard') ?? ''
  assert.match(decl(base, 'transition') ?? '', /transform[^,]*,\s*border-color[^,]*,\s*background-color/)
})

test('C7: the three Logbook tile parents keep their grid, and each tile has a class of its own', () => {
  const css = read('48a-logbook-stats.css')
  for (const [parent, cols] of [['.logbookstats__splits', '1fr 1fr'], ['.logbookstats__streaks', '1fr 1fr'], ['.logbookstats__records', '1fr']]) {
    const body = ruleBody(css, parent) ?? ''
    assert.equal(decl(body, 'display'), 'grid', `${parent} stays a grid`)
    assert.equal(decl(body, 'grid-template-columns'), cols)
  }
  // No rule styles a tile by its tag any more: a tag selector also hits nested elements.
  for (const [, sel] of rules(css)) {
    assert.doesNotMatch(sel, /logbookstats__splits\s+div|logbookstats__streaks\s+article|logbookstats__records\s*>\s*div/, `${sel} styles a tile by tag`)
  }
  const page = src('screens/LogbookStatsPage.jsx')
  const tiles = (ns) => cardTags(page).filter((attrs) => namesClass(attrs, ns)).length
  assert.equal(tiles('logbookstats__split'), 2, 'two split tiles')
  assert.equal(tiles('logbookstats__streak'), 2, 'two streak tiles')
  assert.equal(tiles('logbookstats__record'), 1, 'one record tile, in the clubs loop')
})

test('C7: the account, logbook and chrome files import no stamp art, and Card imports nothing stamp-related', () => {
  for (const rel of C7_FILES) {
    const code = src(rel)
    assert.doesNotMatch(code.replace(/\/\/.*$/gm, ''), /GameStamp|StampGameButton/, `${rel} draws no stamp art`)
  }
  const card = src('components/ui/frame/Card.jsx').replace(/\/\/.*$/gm, '')
  assert.doesNotMatch(card, /import[^\n]*stamp/i)
})

test('C7: the seal pin — no reveal-only import, SealBox or revealedThrough read moved', () => {
  for (const rel of C7_FILES) {
    const code = src(rel)
    assert.doesNotMatch(code, /from ['"][./]+\/api\/(linescore|derive)\.js['"]/, `${rel} adds no reveal-only import`)
    assert.doesNotMatch(code, /<SealBox|revealedThrough/, `${rel} adds no seal`)
  }
})

test('C7: the poster panel title keeps its own rule', () => {
  const body = ruleBody(read('62-game-preview.css'), '.posterstudio__title') ?? ''
  assert.equal(decl(body, 'font-size'), 'var(--fs-h3)')
  assert.equal(decl(body, 'text-transform'), 'uppercase')
  assert.match(src('screens/GamePreview.jsx'), /<h2 className="posterstudio__title">Preview card<\/h2>/)
})

// ---- slice H3: the second lines ----
//
// ADR-0084: a head's second line is `__note` and its title is `__title`. Each row
// is a class that broke it. The block name stays unless the block itself is
// renamed by another slice. Each old class is gone from src, e2e, scripts and
// test, comments too; each new class is drawn by a stylesheet and used by a
// markup file or by the lab catalog, in code and not only in a comment.
const H3_RENAMED = [
  // batch A: the four titles, the `__sub`, `__kicker`, `__eyebrow` and `__lede` rows
  ['awardord__hd', 'awardord__title'],
  ['coverpick__heading', 'coverpick__title'],
  ['gamelines__heading', 'gamelines__title'],
  ['lookupdeck__heading', 'lookupdeck__title'],
  ['cthist__sub', 'cthist__note'],
  ['leaders__sub', 'leaders__note'],
  ['mgrpage__sub', 'mgrpage__note'],
  ['psoddsmodal__sub', 'psoddsmodal__note'],
  ['rpt__sub', 'rpt__note'],
  ['searchbox__sub', 'searchbox__note'],
  ['searchoverlay__sub', 'searchoverlay__note'],
  ['split__sub', 'split__note'],
  ['umptend__sub', 'umptend__note'],
  ['boxlines__kicker', 'boxlines__note'],
  ['scorebookstory__kicker', 'scorebookstory__note'],
  ['tscoremodal__kicker', 'tscoremodal__note'],
  ['bcast__eyebrow', 'bcast__note'],
  ['guidelink__eyebrow', 'guidelink__note'],
  ['hitchart__eyebrow', 'hitchart__note'],
  ['introsheet__eyebrow', 'introsheet__note'],
  ['szmodal__eyebrow', 'szmodal__note'],
  ['trrank__eyebrow', 'trrank__note'],
  ['umpmodal__eyebrow', 'umpmodal__note'],
  ['sitemenusheet__eyebrow', 'sitemenusheet__note'],
  // `.wordmarklab__eyebrow` left with the Wordmark Lab study itself (#1326).
  ['admincopy__lede', 'admincopy__note'],
  ['clubsseen__lede', 'clubsseen__note'],
  ['foulavg__lede', 'foulavg__note'],
  // `note__note` repeated its block; the block is `.seasonnote` now (see below)
  ['note__lede', 'seasonnote__note'],
  ['stampin__lede', 'stampin__note'],
  ['xl-entry__lede', 'xl-entry__note'],
  // batch B, step one: the entry's own note gives up the name the page-level lede takes
  ['dlab__note', 'dlabentry__note'],
  // batch B, step two: the page-level lede takes the freed name
  ['dlab__lede', 'dlab__note'],
  // after #1339: a section title inside a modal body, not the head's second line
  ['tscoremodal__subkicker', 'tscoremodal__sectiontitle'],
]

// Two classes left with no successor: `.cover__sub` had no call site (its rule
// and its seal-scope allowlist entry went together), and the between-innings
// eyebrow repeated its block's name.
const H3_DELETED = ['cover__sub', 'betweeninnings__eyebrow']

// Text files of the four trees, this file excluded (it names the old classes).
// Read once for the whole block.
const H3_ROOT = join(SRC, '..')
const H3_TEXT = ['.css', '.jsx', '.js', '.mjs', '.md']
let h3Read
const h3Trees = () =>
  (h3Read ??= ['src', 'e2e', 'scripts', 'test'].flatMap((dir) =>
    files(join(H3_ROOT, dir), H3_TEXT)
      .map((rel) => `${dir}/${rel}`)
      .filter((rel) => rel !== 'test/card-cascade.test.js')
      .map((rel) => [rel, readFileSync(join(H3_ROOT, rel), 'utf8')]),
  ))
// `\b` is wrong here: `_` is a word character, so it does not exist before `__element`.
// A modifier (`name--tight`) counts as the class; a longer name (`name-x`, `name_x`) does not.
const h3Class = (name) => new RegExp(`(?<![A-Za-z0-9_-])${name}(?![a-z0-9_]|-[a-z0-9])`)
// A file without its comments: the shared `/* */` stripper (which also takes
// JSX's `{/* */}`), then each whole-line `//` comment. A `//` after code stays,
// so a string that holds a URL is never cut.
const h3Code = (text) => stripComments(text).replace(/^[ \t]*\/\/.*$/gm, '')

test('H3: each old second-line class is gone from src, e2e, scripts and test, comments too', () => {
  const trees = h3Trees()
  // A two-step row frees a name that the next row takes (`dlab__note`). The
  // next test pins that step.
  const taken = new Set(H3_RENAMED.map(([, now]) => now))
  const gone = [...H3_RENAMED.map(([old]) => old).filter((old) => !taken.has(old)), ...H3_DELETED]
  for (const old of gone) {
    const re = h3Class(old)
    assert.deepEqual(
      trees.filter(([, text]) => re.test(text)).map(([rel]) => rel),
      [],
      `.${old} is still named`,
    )
  }
})

// Step one of the two-step. The loop above skips `dlab__note`, because step two
// gives that name to the page-level lede, so a return to `<p className="dlab__note">`
// for an ENTRY's note would pass it. An entry's note keeps its own name.
test('H3: a design lab entry note wears .dlabentry__note, never the name the lede took', () => {
  const jsx = h3Code(readFileSync(join(SRC, 'screens/designlab/Entry.jsx'), 'utf8'))
  assert.deepEqual(
    [...jsx.matchAll(/className="([^"]*)">\{note\}/g)].map((m) => m[1]),
    ['dlabentry__note'],
  )
})

test('H3: each new second-line class is in a stylesheet and in a markup file or the lab catalog, not only in a comment', () => {
  const code = h3Trees()
    .filter(([rel]) => rel.startsWith('src/'))
    .map(([rel, text]) => [rel, h3Code(text)])
  for (const [, now] of H3_RENAMED) {
    const re = h3Class(now)
    const hit = (ext) => code.some(([rel, text]) => ext.test(rel) && re.test(text))
    assert.ok(hit(/\.css$/), `.${now} has no rule`)
    assert.ok(hit(/\.jsx?$/), `.${now} is used by no markup and no lab entry`)
  }
})

// After #1339 the block itself moved. `.note__note` repeated its block's name,
// and `note` named no job (ADR-0084 clause 1): the block is one note about the
// season that just finished, so it is `.seasonnote`, with every part. No class
// of the old block is left, as an element, a modifier or the bare block.
test('H3: the season note block is .seasonnote, and no .note class is left', () => {
  const old = /(?<![A-Za-z0-9_-])note(__|--)[a-z]|className="note[ "]|'\.note[ ']/
  assert.deepEqual(h3Trees().filter(([, text]) => old.test(text)).map(([rel]) => rel), [])
  for (const rel of ['components/offseason/LongAtBats.jsx', 'components/offseason/YoungestRegulars.jsx']) {
    assert.match(readFileSync(join(SRC, rel), 'utf8'), /<section className="seasonnote[ "]/)
  }
})

test('H3: the held rows keep their names', () => {
  const trees = h3Trees()
  const held = [
    'wire__kicker', 'bs__sub', 'ledger__sub', // not a second line (#1113, #1132)
    'contractcard__eyebrow', // `.contractcard__note` is the optioned caption, a different line
    // two different second lines on one head: needs a decision on the grammar
    'abouthero__kicker', 'abouthero__lede', 'derbycard__eyebrow', 'derbycard__sub',
    'logbooklanding__eyebrow', 'logbooklanding__lede', 'researchdiary__eyebrow', 'researchdiary__lede',
    'stampstrip__eyebrow', 'stampstrip__lede',
  ]
  for (const name of held) {
    const re = h3Class(name)
    assert.ok(
      trees.some(([rel, text]) => rel.startsWith('src/styles/') && re.test(text)),
      `.${name} lost its rule`,
    )
  }
})

test('H3: the between-innings button is still named by its fact', () => {
  const jsx = readFileSync(join(SRC, 'components/gamehud/BetweenInnings.jsx'), 'utf8')
  const button = jsx.slice(jsx.indexOf('<Card as="button"'), jsx.indexOf('</Card>'))
  // The name comes from the content: the progress count, the player and the fact.
  // An aria-label would replace it and hide the fact from a screen reader.
  assert.match(button, /betweeninnings__progress/)
  assert.match(button, /\{card\.text\}/)
  assert.doesNotMatch(button, /aria-label/)
})
