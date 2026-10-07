// Slice N6 of the Notice collapse (#1132): the four one-line event bars and the
// two handoff cards of the innings feed take their frame from the Notice class
// helper (noticeClass, tone 'event') instead of .pitchernotice--pbp. The feed is
// a scoring surface, so the slice moves a frame and never a gate. Asserted from
// the source text, the way notice-cascade.test.js does:
//
//   1. THE SEAL PIN. Measured on origin/main before the first edit.
//   2. THE ROOTS. Each of the six takes noticeClass({ tone: 'event' }), wears no
//      .pitchernotice--pbp and keeps every other class it had.
//   3. THE NAMESPACES. The old frame's margin moves onto .pitchernotice--event
//      and .pitcherhandoff, with what keeps the pixels the same: no wrap, and
//      a stretched column on the handoff cards.
//   4. THE OLD FRAME STAYS for the actor cards until N7 moves them.
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

const HELPER = /import \{ noticeClass \} from '\.\.\/\.\.\/lib\/design\/noticeClass\.js'/

test('N6: the four event bars take the event frame from noticeClass and keep their own classes', () => {
  const code = src('components/playbyplay/EventCards.jsx')
  assert.match(code, HELPER)
  const bar = '<div className={`pitchernotice ${noticeClass({ tone: \'event\' })} pitchernotice--event'
  assert.ok(fn(code, 'MoundVisitBar').includes(`${bar} pitchernotice--mv\`}>`), 'the mound visit keeps pitchernotice--mv')
  for (const name of ['EjectionBar', 'EventCard', 'DelayNotice']) {
    assert.ok(fn(code, name).includes(`${bar}\`}>`), `${name}'s root`)
  }
  assert.doesNotMatch(code, /className=[^>]*pitchernotice--pbp/, 'no event bar wears the old frame')
})

test('N6: the two handoff cards take the event frame on their Stack and keep their inner layout', () => {
  const code = src('components/playbyplay/PitcherHandoffCard.jsx')
  assert.match(code, HELPER)
  for (const name of ['DepartureLineCard', 'FinalizedLineCard']) {
    const body = fn(code, name)
    assert.ok(body.includes(`<Stack gap="snug" className={noticeClass({ tone: 'event', className: 'pitcherhandoff' })}>`), `${name}'s root`)
    assert.ok(body.includes('<div className="pitchernotice">'), `${name} keeps its header row`)
    assert.ok(body.includes('<PitcherLineTable line={line}'), `${name} keeps its table`)
  }
  assert.doesNotMatch(code, /pitchernotice--pbp/, 'no handoff card wears the old frame')
})

// ---- 3. the namespaces ----

// THE MARGIN, THE WRAP AND THE STRETCH. The old frame gave a 4px 14px margin
// (written here as the tokens --space-1 and --space-3h)
// (.half has no padding, so a card without it sits flush); Notice owns no
// margin, so it moves to the namespace. .notice wraps, and the old bars did
// not: at 390px the mound visit (mark, label, spacer, pips, "N left") would
// break its row. N5 met the same trap. On the handoff cards .notice also
// centres its items, which would shrink the full-width table; the Stack's
// column must stretch, as it did with no align-items at all. None of this goes
// in notice.css: notice-cascade.test.js pins every rule there as one class.
test('N6: .pitchernotice--event and .pitcherhandoff carry the old margin and do not wrap', () => {
  const sheet = css('12-sealbox.css')
  const event = ruleBody(sheet, '.pitchernotice--event')
  assert.equal(decl(event, 'margin'), 'var(--space-1) var(--space-3h)', '4px 14px, as tokens')
  assert.equal(decl(event, 'flex-wrap'), 'nowrap')
  assert.equal(decl(event, 'gap'), 'var(--space-2)', 'the bar keeps its tighter gap')
  const handoff = ruleBody(sheet, '.pitcherhandoff')
  assert.equal(decl(handoff, 'margin'), 'var(--space-1) var(--space-3h)', '4px 14px, as tokens')
  assert.equal(decl(handoff, 'flex-wrap'), 'nowrap')
  assert.equal(decl(handoff, 'align-items'), 'stretch')
})

// The handoff card's gap: .notice loads after stack.css and sets its own gap,
// which beats the Stack's "snug" step. Both must stay the same 8px.
test('N6: the handoff card keeps the 8px gap of Stack\'s "snug" step', () => {
  assert.equal(decl(ruleBody(css('system/notice.css'), '.notice'), 'gap'), 'var(--space-2)')
  assert.equal(decl(ruleBody(css('system/stack.css'), '.stack--snug'), '--stack-gap'), 'var(--space-2)')
  assert.equal(decl(ruleBody(css('12-sealbox.css'), '.pitcherhandoff'), 'gap'), undefined)
})

// ---- 4. the old frame stays ----

test('N6: the .pitchernotice--pbp frame stays for the actor cards until N7', () => {
  const frame = ruleBody(css('12-sealbox.css'), '.pitchernotice--pbp')
  assert.equal(decl(frame, 'margin'), '4px 14px')
  assert.equal(decl(frame, 'border'), 'var(--bw-hair) solid var(--border-rule)')
  for (const rel of [
    'components/playbyplay/PitcherNotice.jsx',
    'components/playbyplay/PlayByPlay.jsx',
    'components/inning/HalfInning.jsx',
    'components/scoring/lens/LensCards.jsx',
    'components/scoring/lens/PitcherSheet.jsx',
  ]) {
    assert.match(src(rel), /className="[^"]*pitchernotice--pbp/, `${rel} still wears the old frame`)
  }
})
