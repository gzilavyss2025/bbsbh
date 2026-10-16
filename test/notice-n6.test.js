// Slice N6 of the Notice collapse (#1132): the four one-line event bars and the
// two handoff cards of the innings feed take their frame from the Notice class
// helper (noticeClass, tone 'event') instead of .change--framed. The feed is
// a scoring surface, so the slice moves a frame and never a gate. Asserted from
// the source text, the way notice-cascade.test.js does:
//
//   1. THE SEAL PIN. Measured on origin/main before the first edit.
//   2. THE ROOTS. Each of the six takes noticeClass({ tone: 'event' }), wears no
//      .change--framed and keeps every other class it had.
//   3. THE NAMESPACES. The old frame's margin moves onto .change--event
//      and .pitcherhandoff, with what keeps the pixels the same: no wrap, and
//      a stretched column on the handoff cards.
//   4. THE OLD FRAME left the actor cards in N7 (notice-n7.test.js); the
//      callers wear the helper, and the rule is the margin-only namespace.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(join('styles', rel)))
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()
// The text of one exported function, up to the next top-level function.
const fn = (code, name) => {
  const at = code.indexOf(`export function ${name}(`)
  assert.ok(at >= 0, `${name} exists`)
  const end = code.slice(at + 1).search(/\n(export )?function /)
  return end < 0 ? code.slice(at) : code.slice(at, at + 1 + end)
}

// ---- 1. the seal pin ----

// THE SEAL PIN. Written before this slice changed a line: for each file the
// slice touches or mounts from, the reveal-only modules it imports
// (src/api/spoiler-manifest.json; a "mixed" module counts when a sealed export
// is imported), and how many SealBoxes and revealedThrough reads it holds, as
// measured on origin/main at 118f08809. A frame move changes none of these. If
// this fails, the slice moved a seal: stop and ask, never update the literal.
const N6_SEAL = {
  'components/playbyplay/EventCards.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/PitcherHandoffCard.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/PlayByPlay.jsx': { reveal: ['playbyplay.js'], sealBoxes: 0, revealedThrough: 1 },
  'components/inning/HalfInning.jsx': { reveal: ['boxscore.js', 'highlights.js', 'hitchart.js', 'playbyplay.js'], sealBoxes: 1, revealedThrough: 12 },
}
const SPOILER_MANIFEST = JSON.parse(src('api/spoiler-manifest.json')).modules

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

test('N6: the seal pin — no reveal-only import, SealBox or revealedThrough read moved', () => {
  for (const [rel, want] of Object.entries(N6_SEAL)) {
    const code = src(rel)
    assert.deepEqual(revealOnlyImports(rel), want.reveal, `${rel}: its reveal-only imports changed`)
    assert.equal((code.match(/<SealBox\b/g) ?? []).length, want.sealBoxes, `${rel}: a SealBox was added or removed`)
    assert.equal((code.match(/revealedThrough/g) ?? []).length, want.revealedThrough, `${rel}: a revealedThrough read moved`)
  }
})

// ---- 2. the roots ----

// ADR-0113 moved the six roots from the Notice frame to the stamped event card.
const HELPER = /import \{ eventCardClass \} from '\.\.\/\.\.\/lib\/design\/cardClass\.js'/

test('N6: the four event bars take the event frame from noticeClass and keep their own classes', () => {
  const code = src('components/playbyplay/EventCards.jsx')
  assert.match(code, HELPER)
  const bar = '<div className={`change ${eventCardClass()} change--event'
  assert.ok(fn(code, 'MoundVisitBar').includes(`${bar} change--mv\`}>`), 'the mound visit keeps change--mv')
  for (const name of ['EjectionBar', 'EventCard', 'DelayNotice']) {
    assert.ok(fn(code, name).includes(`${bar}\`}>`), `${name}'s root`)
  }
  assert.doesNotMatch(code, /className=[^>]*change--framed/, 'no event bar wears the old frame')
})

test('N6: the two handoff cards take the event frame on their Stack and keep their inner layout', () => {
  const code = src('components/playbyplay/PitcherHandoffCard.jsx')
  assert.match(code, HELPER)
  for (const name of ['DepartureLineCard', 'FinalizedLineCard']) {
    const body = fn(code, name)
    assert.ok(body.includes(`<Stack gap="snug" className={eventCardClass('pitcherhandoff')}>`), `${name}'s root`)
    assert.ok(body.includes('<div className="change">'), `${name} keeps its header row`)
    assert.ok(body.includes('<PitcherLineTable line={line}'), `${name} keeps its table`)
  }
  assert.doesNotMatch(code, /change--framed/, 'no handoff card wears the old frame')
})

// ---- 3. the namespaces ----

// THE GAP AND THE STRETCH. ADR-0113 moved the margin onto .card--event (the
// stamped event card's room: 34px above for the tab, 4px below for the shadow;
// event-card-frame.test.js pins it) and dropped the wrap, because the stamped
// card is not a .notice, which wrapped. What the namespaces keep: the bar's
// tighter gap, and the handoff card's stretched column, which would otherwise
// shrink the full-width table to its content.
test('N6: .change--event keeps its gap and .pitcherhandoff its stretch; neither sets a margin', () => {
  const sheet = css('12-sealbox.css')
  assert.match(sheet, /\.change--event \{\s*gap: var\(--space-2\);\s*\}/, 'the bar keeps its tighter gap')
  assert.equal(decl(ruleBody(sheet, '.change--framed,\n.change--event'), 'margin'), undefined, 'the margin is .card--event\'s')
  const handoff = ruleBody(sheet, '.pitcherhandoff')
  assert.equal(decl(handoff, 'align-items'), 'stretch')
  assert.equal(decl(handoff, 'margin'), undefined, 'the margin is .card--event\'s')
})

// The handoff card's gap: the Stack's "snug" step is the only gap now (the
// Notice's own gap, which equalled it, no longer applies).
test('N6: the handoff card keeps the 8px gap of Stack\'s "snug" step', () => {
  assert.equal(decl(ruleBody(css('system/stack.css'), '.stack--snug'), '--stack-gap'), 'var(--space-2)')
  assert.equal(decl(ruleBody(css('12-sealbox.css'), '.pitcherhandoff'), 'gap'), undefined)
})

// ---- 4. the old frame left the actor cards in N7 ----

// The actor cards' callers pass eventCardClass with .change--framed as the
// namespace. The namespace keeps only the row padding now (ADR-0113): the
// frame and the margin are .card--event's.
test('N6: .change--framed keeps only the row padding, and the actor-card callers wear eventCardClass', () => {
  const frame = ruleBody(css('12-sealbox.css'), '.change--framed,\n.change--event')
  assert.equal(decl(frame, 'padding'), 'calc(var(--space-6) + var(--space-1)) var(--space-4) var(--space-4)')
  for (const prop of ['margin', 'border', 'border-radius', 'background', 'box-shadow']) assert.equal(decl(frame, prop), undefined, `.card--event draws the ${prop}`)
  for (const rel of [
    'components/playbyplay/PitcherNotice.jsx',
    'components/playbyplay/PlayByPlay.jsx',
    'components/inning/HalfInning.jsx',
    'components/scoring/lens/PitcherSheet.jsx',
  ]) {
    assert.match(src(rel), /\{eventCardClass\('change--framed'\)\}/, `${rel} wears the helper`)
  }
  // The lens's arm button is its own element and keeps the Notice frame.
  assert.match(src('components/scoring/lens/LensCards.jsx'), /noticeClass\(\{ tone: 'event', className: 'change--framed' \}\)/)
})
