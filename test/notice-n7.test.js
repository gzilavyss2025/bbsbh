// Slice N7 of the Notice collapse (#1132): the pitcher, batter, fielder and
// pinch-runner cards, the full Now Pitching card and the scorecard's arm button
// take their outer frame from the Notice class helper (noticeClass, tone
// 'event'). The innings viewer and the scorecard lens are scoring surfaces, so
// the slice moves a frame and never a gate. Asserted from the source text, the
// way notice-n6.test.js does:
//
//   1. THE SEAL PIN. Measured on origin/main before the first edit.
//   2. THE CALLERS. The frame stays the caller's: PitcherNotice is also the
//      header INSIDE the full card (pitcherCard/PitcherCard.jsx), and a frame on
//      its root would draw a card in the card. So each of the nine call sites
//      passes the helper, with .pitchernotice--pbp as the namespace until N8c,
//      and the four role roots keep taking it from className.
//   3. THE NAMESPACE. .pitchernotice--pbp keeps only what Notice does not draw.
//   4. THE FULL CARD. .pcard undoes .notice's centre and wrap.
//   5. THE CONSOLE keys on the frame class every staged card now wears.
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

// ---- 1. the seal pin ----

// THE SEAL PIN. Written before this slice changed a line: for each file the
// slice touches or mounts from, the reveal-only modules it imports
// (src/api/spoiler-manifest.json; a "mixed" module counts when a sealed export
// is imported), and how many SealBoxes and revealedThrough reads it holds, as
// measured on origin/main at f150612ab. A frame move changes none of these. If
// this fails, the slice moved a seal: stop and ask, never update the literal.
const N7_SEAL = {
  'components/inning/HalfInning.jsx': { reveal: ['boxscore.js', 'highlights.js', 'hitchart.js', 'playbyplay.js'], sealBoxes: 1, revealedThrough: 12 },
  'components/playbyplay/PlayByPlay.jsx': { reveal: ['playbyplay.js'], sealBoxes: 0, revealedThrough: 1 },
  'components/scoring/lens/PitcherSheet.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/PitcherNotice.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/scoring/lens/LensCards.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/pitcherCard/PitcherCard.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/BatterNotice.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/FielderNotice.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/PinchRunNotice.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'screens/scorecard/ScorecardPage.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 7 },
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

test('N7: the seal pin — no reveal-only import, SealBox or revealedThrough read moved', () => {
  for (const [rel, want] of Object.entries(N7_SEAL)) {
    const code = src(rel)
    assert.deepEqual(revealOnlyImports(rel), want.reveal, `${rel}: its reveal-only imports changed`)
    assert.equal((code.match(/<SealBox\b/g) ?? []).length, want.sealBoxes, `${rel}: a SealBox was added or removed`)
    assert.equal((code.match(/revealedThrough/g) ?? []).length, want.revealedThrough, `${rel}: a revealedThrough read moved`)
  }
})

// ---- 2. the callers ----

const FRAME = "noticeClass({ tone: 'event', className: 'pitchernotice--pbp' })"
const HELPER = /^import \{ noticeClass \} from '(\.\.\/)+lib\/design\/noticeClass\.js'$/m
// file -> how many of its card props take the frame from the helper
const CALLERS = {
  'components/inning/HalfInning.jsx': 3, // the Now Pitching card, the staged batter and fielder
  'components/playbyplay/PlayByPlay.jsx': 4, // mid-half pitcher, fielder, pinch runner, pinch hitter
  'components/scoring/lens/PitcherSheet.jsx': 1, // the full card in the lens sheet
  'components/playbyplay/PitcherNotice.jsx': 1, // ReliefRepeat
}
const count = (code, s) => code.split(s).length - 1

test('N7: the nine call sites pass the event frame from noticeClass, never the bare class', () => {
  for (const [rel, n] of Object.entries(CALLERS)) {
    const code = src(rel)
    assert.match(code, HELPER, `${rel} imports noticeClass`)
    assert.equal(count(code, `className={${FRAME}}`), n, `${rel}: ${n} call sites take the frame`)
    assert.doesNotMatch(code, /className="pitchernotice--pbp"/, `${rel}: no call site passes the bare class`)
  }
})

test('N7: ArmNotice is still one <button> and takes the frame from noticeClass', () => {
  const code = src('components/scoring/lens/LensCards.jsx')
  assert.match(code, HELPER)
  assert.equal(count(code, `<button type="button" className={\`pitchernotice \${${FRAME}} sc-armnotice\`} onClick={onOpen}>`), 1)
  assert.doesNotMatch(code, /className="[^"]*pitchernotice--pbp/, 'no bare frame class left')
})

// The frame stays the caller's. The four role roots take it from className, and
// the full card renders PitcherNotice bare inside div.pcard, so its header draws
// no second frame.
test('N7: the role roots keep the caller\'s className, and the full card\'s header stays bare', () => {
  for (const name of ['PitcherNotice', 'BatterNotice', 'FielderNotice', 'PinchRunNotice']) {
    const code = src(`components/playbyplay/${name}.jsx`)
    assert.ok(code.includes('<div className={`pitchernotice ${className}`}>'), `${name}'s root`)
    // PitcherNotice.jsx's one call is ReliefRepeat's, a caller (above).
    const live = code.replace(/^\s*\/\/.*$/gm, '') // a comment may name the helper
    assert.equal(count(live, 'noticeClass('), name === 'PitcherNotice' ? 1 : 0, `${name} does not draw the frame itself`)
  }
  const card = src('components/playbyplay/pitcherCard/PitcherCard.jsx')
  assert.ok(card.includes("<div className={`pcard ${className ?? ''}`}>"), 'the frame lands on .pcard')
  assert.doesNotMatch(card.slice(card.indexOf('<PitcherNotice')).split('/>')[0], /className/, 'the header takes no frame')
})

// ---- 3. the namespace ----

// Notice draws the padding, the edge, the radius and the wash (the same values
// the old frame drew). The namespace keeps the margin (.half has no padding,
// so the card would sit flush) and no wrap: .notice wraps, the cards did not.
// None of this goes in notice.css: notice-cascade.test.js pins every rule
// there as one class.
test('N7: .pitchernotice--pbp keeps only the margin and the no-wrap', () => {
  const body = ruleBody(css('12-sealbox.css'), '.pitchernotice--pbp')
  assert.equal(decl(body, 'margin'), 'var(--space-1) var(--space-3h)', '4px 14px, as tokens')
  assert.equal(decl(body, 'flex-wrap'), 'nowrap')
  for (const prop of ['padding', 'border', 'border-radius', 'background']) {
    assert.equal(decl(body, prop), undefined, `Notice draws the ${prop} now`)
  }
})

// ---- 4. the full card ----

// .notice centres its items and wraps; .pcard is a column of full-width
// sections. card.css loads after notice.css, so these win on order.
test('N7: .pcard stretches its sections, does not wrap and keeps its gap', () => {
  const body = ruleBody(css('pitcher-card/card.css'), '.pcard')
  assert.equal(decl(body, 'flex-direction'), 'column')
  assert.equal(decl(body, 'align-items'), 'stretch')
  assert.equal(decl(body, 'flex-wrap'), 'nowrap')
  assert.equal(decl(body, 'gap'), 'var(--space-2h)')
})

// ---- 5. the console ----

test('N7: the console finds a lone staged card by the event frame', () => {
  const sheet = css('focus/console.css')
  assert.ok(sheet.includes('.half:has(.notice--event):not(:has(.statgrid))'))
  assert.doesNotMatch(sheet, /pitchernotice--pbp/)
})
