// Slice 1 of 3 of the notification-card redesign (ADR-0113): every focus-mode
// notification card wears the stamped yellow frame. Asserted from source text,
// as notice-n7.test.js does. The seal pin for this slice is C4_SEAL in
// card-cascade.test.js; it passes unchanged.
//
//   1. THE TOKEN AND ITS CONTRAST PAIRS.
//   2. THE CLASS LIST: one helper names the frame.
//   3. THE CALLERS and THE TABS: every card passes the helper, and every card
//      has a name tab, which is its heading.
//   4. THE CSS: the tone, the row padding and the parent gap.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'
import { PAIRINGS, TEXT, ratio } from '../src/lib/design/contrastPairings.js'
import { cardClassName, eventCardClass } from '../src/lib/design/cardClass.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(join('styles', rel)))
const tokens = (rel) => stripComments(src(join('tokens', rel)))

const mix = (a, b, pct) => a.map((v, i) => Math.round((v * pct) / 100 + (b[i] * (100 - pct)) / 100))
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`

// ---- 1. the token and its contrast pairs ----

const colors = tokens('colors.css')
const token = (name) => colors.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]

test('the event ground is one solid yellow: --marker at 35% over --paper-2, precomputed', () => {
  assert.equal(token('surface-stamped-event'), '#F8E3B3')
  assert.equal(hex(mix(rgb(token('marker')), rgb(token('paper-2')), 35)), '#F8E3B3', 'the literal is the wash')
})

test('the event ground carries ink-0, ink-1, ink-2 and graphite text at the named ratios', () => {
  const ground = token('surface-stamped-event')
  const want = [['ink-0', 14.2], ['ink-1', 11.6], ['ink-2', 7.2], ['text-caption', 4.58]]
  const caption = colors.match(/--text-caption:\s*var\(--([\w-]+)\)/)?.[1]
  for (const [fg, min] of want) {
    const fgHex = token(fg) ?? token(fg === 'text-caption' ? caption : fg)
    assert.ok(fgHex, `${fg} resolves`)
    assert.ok(ratio(fgHex, ground) >= min - 0.05, `${fg} on the event ground is ${ratio(fgHex, ground).toFixed(2)}:1, need ${min}`)
    const pair = PAIRINGS.find((p) => p.fg === fg && p.bg === 'surface-stamped-event')
    assert.ok(pair, `${fg} on surface-stamped-event is pinned in contrastPairings.js`)
    assert.equal(pair.min, TEXT)
  }
})

// ---- 2. the class list ----

test('the event tone is a stamped tone, and eventCardClass names the whole frame', () => {
  assert.equal(cardClassName({ frame: 'stamped', tone: 'event' }), 'card card--stamped card--event')
  assert.throws(() => cardClassName({ tone: 'event' }), /frame="stamped"/)
  assert.equal(eventCardClass(), 'card card--stamped card--event card--named')
  assert.equal(eventCardClass('change--framed'), 'card card--stamped card--event card--named change--framed')
})

// ---- 3. the callers and the tabs ----

const CARD_FILES = [
  'components/playbyplay/PitcherNotice.jsx',
  'components/playbyplay/BatterNotice.jsx',
  'components/playbyplay/FielderNotice.jsx',
  'components/playbyplay/PinchRunNotice.jsx',
  'components/playbyplay/PitcherHandoffCard.jsx',
  'components/playbyplay/EventCards.jsx',
  'components/playbyplay/PlayByPlay.jsx',
  'components/inning/HalfInning.jsx',
  'components/scoring/lens/PitcherSheet.jsx', // hands PitcherCard its frame
]
const live = (code) => code.replace(/^\s*\/\/.*$/gm, '')

test('no notification card passes the Notice frame any more; each passes eventCardClass', () => {
  for (const rel of CARD_FILES) {
    const code = live(src(rel))
    assert.doesNotMatch(code, /noticeClass\(/, `${rel} draws no Notice frame`)
    // PitcherNotice.jsx took no frame once ReliefRepeat left it (slice 3): its callers pass it.
    if (!rel.endsWith('PinchRunNotice.jsx') && !rel.endsWith('BatterNotice.jsx') && !rel.endsWith('FielderNotice.jsx') && !rel.endsWith('PitcherNotice.jsx')) {
      assert.match(code, /eventCardClass\(/, `${rel} passes the stamped event frame`)
    }
  }
})

test('every card has a name tab that is its heading, drawn by .card__name', () => {
  const tabs = {
    'components/playbyplay/PitcherNotice.jsx': 1, // ActorHead: the four actor cards and the two handoff cards draw their tab here (slice 2)
    'components/playbyplay/BatterNotice.jsx': 0,
    'components/playbyplay/FielderNotice.jsx': 0,
    'components/playbyplay/PinchRunNotice.jsx': 0,
    'components/playbyplay/PitcherHandoffCard.jsx': 0,
    'components/playbyplay/EventCards.jsx': 4, // mound visit, ejection, event, delay
  }
  for (const [rel, n] of Object.entries(tabs)) {
    const count = live(src(rel)).split('className="card__name"').length - 1
    assert.equal(count, n, `${rel}: ${n} name tabs`)
  }
  assert.doesNotMatch(src('components/playbyplay/PitcherNotice.jsx').replace(/^\s*\/\/.*$/gm, ''), /className="change__now"/, 'the label is the tab now')
})

// ---- 4. the css ----

test('.card--event sets the one yellow ground and nothing else of its own', () => {
  const body = ruleBody(css('system/card.css'), '.card--event')
  assert.match(body, /--card-ground:\s*var\(--surface-stamped-event\)/)
  assert.doesNotMatch(body, /--seal|--clay|--field|blur|border-left/)
})

test('the frame uses no seal token, no blurred shadow and no club colour', () => {
  for (const rel of ['system/card.css', 'system/stamped/stamped.css']) {
    const body = css(rel)
    assert.doesNotMatch(body, /var\(--seal/, `${rel} reads no --seal token`)
  }
  assert.doesNotMatch(tokens('colors.css').match(/--surface-stamped-event:[^;]+;/)[0], /seal/)
})

test('a row of an event card clears the tab: 28px above the body (24px on a mound visit), 16px around', () => {
  const sheet = css('12-sealbox.css')
  const row = ruleBody(sheet, '.change.card--event')
  assert.equal(row.match(/padding:\s*([^;]+);/)?.[1].trim(), 'calc(var(--space-6) + var(--space-1)) var(--space-4) var(--space-4)')
  const mv = ruleBody(sheet, '.change--mv.card--event')
  assert.equal(mv.match(/padding-top:\s*([^;]+);/)?.[1].trim(), 'var(--space-6)')
})

test('a parent leaves 34px above a card (tab 14px, shadow 4px, room), 12px below, and the card keeps its 14px inset', () => {
  const card = ruleBody(css('12-sealbox.css'), '.card--event')
  assert.equal(card.match(/margin:\s*([^;]+);/)?.[1].trim(), 'calc(var(--space-6) + var(--space-2h)) var(--space-3h) var(--space-3)')
})

test('every shorthand code EventCard can get has a tab name, so no tab is empty', () => {
  const cards = src('components/playbyplay/EventCards.jsx')
  const codes = new Set([...cards.match(/export const EVENT_CODES = \{[\s\S]*?\n\}/)[0].matchAll(/: '([A-Z]{2})'/g)].map((m) => m[1]))
  const names = new Set([...cards.match(/export const EVENT_NAMES = \{[\s\S]*?\n\}/)[0].matchAll(/\b([A-Z]{2}): '/g)].map((m) => m[1]))
  assert.ok(codes.size >= 8)
  for (const code of codes) assert.ok(names.has(code), `${code} has a tab name`)
})

test('the lens arm button keeps the Notice frame, and .change--framed keeps its margin and no-wrap for it', () => {
  const body = ruleBody(css('12-sealbox.css'), '.change--framed')
  assert.match(body, /margin:\s*var\(--space-1\) var\(--space-3h\)/)
  assert.match(body, /flex-wrap:\s*nowrap/)
  assert.doesNotMatch(body, /padding/, 'only an event card has a tab to clear')
})
