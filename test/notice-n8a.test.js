// Slice N8a of the Notice collapse (#1132): the headshot well of the pitcher-card
// family, .pitchernotice__shot*, becomes .change__shot* (ADR-0084; Gary picked
// .change on 2026-10-07). A pure rename: no gate, prop, mount or key moves. The
// innings viewer, the scorecard lens and the focus console are scoring
// surfaces, so the test pins the seal and then the names. Asserted from the
// source text, the way notice-n7.test.js does:
//
//   1. THE SEAL PIN. Measured on origin/main (a75f6edae) before the first edit.
//   2. THE RETIRED CLASS. .pitchernotice__shot is gone, comments too.
//   3. THE NEW NAMES exist, with the rest of the family still on its old name.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(src(join('styles', rel)))

function files(dir, ext, prefix = '') {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return files(abs, ext, `${prefix}${f}/`)
    return ext.some((e) => f.endsWith(e)) ? [`${prefix}${f}`] : []
  })
}

// ---- 1. the seal pin ----

// THE SEAL PIN. Written before this slice changed a line: for the one file the
// slice edits that holds JSX, the reveal-only modules it imports
// (src/api/spoiler-manifest.json; a "mixed" module counts when a sealed export
// is imported), and how many SealBoxes and revealedThrough reads it holds, as
// measured on origin/main at a75f6edae. A rename changes none of these. If this
// fails, the slice moved a seal: stop and ask, never update the literal.
const N8A_SEAL = {
  'components/playbyplay/PitcherNotice.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
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

test('N8a: the seal pin — no reveal-only import, SealBox or revealedThrough read moved', () => {
  for (const [rel, want] of Object.entries(N8A_SEAL)) {
    const code = src(rel)
    assert.deepEqual(revealOnlyImports(rel), want.reveal, `${rel}: its reveal-only imports changed`)
    assert.equal((code.match(/<SealBox\b/g) ?? []).length, want.sealBoxes, `${rel}: a SealBox was added or removed`)
    assert.equal((code.match(/revealedThrough/g) ?? []).length, want.revealedThrough, `${rel}: a revealedThrough read moved`)
  }
})

// ---- 2. the retired class ----

// Strict, comments too: a comment that names a retired class sends the next
// reader to a rule that does not exist. docs/adr and docs/design-system-naming
// .md keep the old name, since the ledger records it.
const RETIRED_N8A = /pitchernotice__sh/
test('N8a: .pitchernotice__shot is gone from stylesheets, markup, comments, e2e and scripts', () => {
  const hits = (dir, ext) =>
    files(dir, ext).filter((rel) => RETIRED_N8A.test(readFileSync(join(dir, rel), 'utf8')))
  assert.deepEqual(hits(SRC, ['.css', '.jsx', '.js', '.md']), [])
  assert.deepEqual(hits(join(ROOT, 'e2e'), ['.js', '.mjs']), [])
  assert.deepEqual(hits(join(ROOT, 'scripts'), ['.js', '.mjs']), [])
})

// ---- 3. the new names ----

test('N8a: .change__shot, --logo and --fallback exist in 12-sealbox.css', () => {
  const sheet = css('12-sealbox.css')
  for (const sel of ['.change__shot', '.change__shot img', '.change__shot--fallback', '.change__shot--logo', '.change__shot--logo img']) {
    assert.ok(ruleBody(sheet, sel), `${sel} has no rule`)
  }
})

test('N8a: the callers of the well use the new name; the rest of the family keeps its own', () => {
  assert.match(css('12-sealbox.css'), /\.pitchernotice:has\(\.pitchernotice__entering\) \.change__shot\s*\{/)
  assert.match(css('13-play-by-play.css'), /\.pbp__batshot \.change__shot\s*\{/)
  assert.match(css('26-player-page.css'), /\.change__shot img\[data-pending\]\s*\{/)
  const atbat = css('focus/atbat.css')
  assert.match(atbat, /\.abhero__shot \.change__shot\s*\{/)
  assert.match(atbat, /\.abhero__shot \.change__shot img\s*\{/)
  assert.match(atbat, /\.abhero__shot--bat \.change__shot,\s*\.abhero__shot--arm \.change__shot\s*\{/)
})

test('N8a: PitcherNotice.jsx builds the well class with the new name', () => {
  const code = src('components/playbyplay/PitcherNotice.jsx')
  assert.ok(code.includes('className="change__shot change__shot--fallback"'), 'the fallback well')
  assert.ok(
    code.includes("className={`change__shot${showLogo ? ' change__shot--logo' : ''}`}"),
    'the logo well is built by template with the new name',
  )
})
