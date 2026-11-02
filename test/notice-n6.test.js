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
import { dirname, join } from 'node:path'
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
// ---- 3. the namespaces ----

// THE GAP AND THE STRETCH. ADR-0113 moved the margin onto .card--event (the
// stamped event card's room: 34px above for the tab, 4px below for the shadow;
// event-card-frame.test.js pins it) and dropped the wrap, because the stamped
// card is not a .notice, which wrapped. What the namespaces keep: the bar's
// tighter gap, and the handoff card's stretched column, which would otherwise
// shrink the full-width table to its content.
test('N6: .change--event keeps its gap and .pitcherhandoff its stretch; neither sets a margin', () => {
  const sheet = css('12-sealbox.css')
  // Slice 2 (ADR-0113): the design's gap between the photo, the sentence and the logo is 12px.
  assert.match(sheet, /\.change--event \{\s*gap: var\(--space-3\);\s*\}/, 'the bar has the design\'s gap')
  assert.equal(ruleBody(sheet, '.change--event').includes('margin'), false, 'the margin is .card--event\'s')
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
// namespace. The namespace keeps the margin and no-wrap that the lens arm
// button needs (ADR-0113); a stamped card's margin and padding are .card--event's.
test('N6: .change--framed keeps the margin and no-wrap for the lens button, and the actor-card callers wear eventCardClass', () => {
  const frame = ruleBody(css('12-sealbox.css'), '.change--framed')
  assert.equal(decl(frame, 'margin'), 'var(--space-1) var(--space-3h)')
  assert.equal(decl(frame, 'flex-wrap'), 'nowrap')
  for (const prop of ['padding', 'border', 'border-radius', 'background', 'box-shadow']) assert.equal(decl(frame, prop), undefined, `.card--event draws the ${prop}`)
  // Slice 3 (ADR-0113): ReliefRepeat is gone, so PitcherNotice.jsx no longer passes the frame.
  for (const rel of [
    'components/scoring/lens/PitcherSheet.jsx',
  ]) {
    assert.match(src(rel), /\{eventCardClass\('change--framed'\)\}/, `${rel} wears the helper`)
  }
  // The lens's arm button is its own element and keeps the Notice frame.
  assert.match(src('components/scoring/lens/LensCards.jsx'), /noticeClass\(\{ tone: 'event', className: 'change--framed' \}\)/)
})
