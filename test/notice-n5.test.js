// Slice N5 of the Notice collapse (#1132): the delay card and the extra-innings
// line move onto Notice. Both sit beside a scoring surface (the innings viewer),
// so the slice moves a box and never a gate. Asserted from the source text, the
// way notice-cascade.test.js does:
//
//   1. THE SEAL PIN. Measured on origin/main before the first edit.
//   2. THE GATES. The three mounts that decide WHEN stay byte for byte.
//   3. THE MEMBERS. Each renders a Notice with its tone, size, role and
//      namespace, and keeps its copy.
//   4. THE RENAME. .delaycard is the namespace .delay, in the stylesheets, the
//      Animation Lab's freeze list and the design lab's catalog.
//   5. THE HOLD. The postponed strip stays as it is (its stamp sits in a row
//      beside two lines; Notice puts its label above the text). Its dashed edge
//      and its copy stay.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
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
const TEXT = /\.(jsx?|css|md|json)$/
const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? files(full) : TEXT.test(name) ? [full] : []
  })

// ---- 1. the seal pin ----

// THE SEAL PIN. Written before this slice changed a line: for each file the
// slice touches or mounts from, the reveal-only modules it imports
// (src/api/spoiler-manifest.json; a "mixed" module counts when a sealed export
// is imported), and how many SealBoxes and revealedThrough reads it holds, as
// measured on origin/main at 608c6062e. A box move changes none of these. If
// this fails, the slice moved a seal: stop and ask, never update the literal.
const N5_SEAL = {
  'components/inning/DelayCard.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/game/GameCardParts.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  // 16: the scorebug's mount moved from ConsoleBand to InningsHeader (the page's masthead), so the
  // viewer hands the same clamped mark to one more child. Same consumer, same clamp, no new import (ruled on by the maintainer).
  // 10, and no winprob.js: the Gameday swap (#2566) deleted the old screen's reads (the Arms tab's win
  // probability, the reference panel, the running line). Removals only; no read moved or was added.
  'screens/InningViewer.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 10 },
  'components/game/GameCard.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
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

test('N5: the seal pin — no reveal-only import, SealBox or revealedThrough read moved', () => {
  for (const [rel, want] of Object.entries(N5_SEAL)) {
    const code = src(rel)
    assert.deepEqual(revealOnlyImports(rel), want.reveal, `${rel}: its reveal-only imports changed`)
    assert.equal((code.match(/<SealBox\b/g) ?? []).length, want.sealBoxes, `${rel}: a SealBox was added or removed`)
    assert.equal((code.match(/revealedThrough/g) ?? []).length, want.revealedThrough, `${rel}: a revealedThrough read moved`)
  }
})

// ---- 2. the gates ----

// The extras line and the delay card left the innings screen with the old console (#2566); the
// postponed banner's gate stays.
test('N5: the postponed gate stays byte for byte (ADR-0060)', () => {
  assert.match(src('components/game/GameCard.jsx'), /\{postponed && <PostponedBanner game=\{game\} status=\{status\} \/>\}/)
})

// ---- 3. the members ----

test('N5: the delay card is an info Notice with the namespace .delay, its glyph as the icon and its title as the label', () => {
  const code = src('components/inning/DelayCard.jsx')
  assert.match(code, /import \{ Notice \} from '\.\.\/ui\/state\/Notice\.jsx'/)
  assert.match(
    code,
    /<Notice\n\s*tone="info"\n\s*role="note"\n\s*className="delay"\n\s*icon=\{isRain \? <RainGlyph \/> : <PauseGlyph \/>\}\n\s*label=\{title\}\n\s*>/,
  )
  // The copy, unchanged: a stoppage, its cause and its length, never a result.
  assert.match(code, /const title = reason \? `\$\{reason\} delay` : 'Delay'/)
  assert.match(code, /Play stopped for <b>\{formatDelay\(durationMinutes\)\}<\/b>/)
  assert.match(code, /'Delay in progress'/)
  assert.match(code, /export function formatDelay\(min\)/, 'EventCards.jsx imports formatDelay')
})

// ---- 4. the rename ----

test('N5: .delaycard is gone from src; the namespace .delay keeps its margin, its pop-in and its icon bubble', () => {
  const left = files(SRC).filter((f) => /delaycard/.test(readFileSync(f, 'utf8')))
  assert.deepEqual(left.map((f) => relative(SRC, f)), [])
  const sheet = css('27-player-position-innings.css')
  const root = ruleBody(sheet, '.delay')
  assert.equal(decl(root, 'margin'), '4px 0 var(--space-3)')
  assert.equal(decl(root, 'animation'), 'delay-pop var(--dur-med) var(--ease-out) both')
  assert.equal(decl(root, 'flex-wrap'), 'nowrap', 'the icon stays beside the text')
  for (const p of ['background', 'border', 'border-left', 'box-shadow', 'padding']) {
    assert.equal(decl(root, p), undefined, `.delay draws no ${p}: Notice owns the box (decisions Q1)`)
  }
  const icon = ruleBody(sheet, '.delay .notice__icon')
  assert.equal(decl(icon, 'width'), '38px')
  assert.equal(decl(icon, 'height'), '38px')
  assert.equal(decl(icon, 'border-radius'), '50%')
  assert.match(sheet, /@media \(prefers-reduced-motion: reduce\) \{\s*\.delay \{\s*animation: none;/)
})

test('N5: the Animation Lab freezes .delay, and the design lab draws it as the Notice it is', () => {
  const freeze = css('46-consent-modal.css')
  assert.match(freeze, /\.animlab__frame \.delay,\n/)
  assert.match(freeze, /\.animlab__frame \.postponed,\n\.animlab__frame \.postponed__stamp,\n/)
  assert.match(src('screens/designlab/catalog.js'), /cls: 'notice notice--info notice--block delay'/)
})

// ---- 5. the hold ----

test('N5: the postponed strip is held as it is: its dashed edge, its stamp and its copy stay', () => {
  const body = ruleBody(css('06-loader-and-cards.css'), '.postponed')
  // The dashed-rule PR (spec.md section 11) owns this line: when it decides,
  // it changes this assertion with the rule.
  assert.equal(decl(body, 'border'), 'var(--bw-hair) dashed var(--border-rule)', 'the dashed-rule PR decides (spec.md section 11)')
  assert.equal(decl(body, 'animation'), 'postponed-in var(--dur-med) var(--ease-out) both')
  const code = src('components/game/GameCardParts.jsx')
  assert.match(code, /<span className="postponed__stamp">\{status\.label\}<\/span>/)
  assert.match(code, /<span className="postponed__reason">\{status\.reason\}<\/span>/)
  assert.match(code, /<span className="postponed__makeup">Makeup&nbsp;·&nbsp;\{makeup\}<\/span>/)
})
