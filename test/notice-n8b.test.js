// Slice N8b of the Notice collapse (#1132, ADR-0084): the parts of the four
// one-line event bars (mound visit, ejection, baserunning event, in-feed
// delay) change their prefix from `pitchernotice` to `change`. A pure rename.
// The innings viewer is a scoring surface, so the slice moves a name and never
// a gate. Asserted from the source text, the way notice-n7.test.js does:
//
//   1. THE SEAL PIN. Measured on origin/main (a75f6edae) before the first edit.
//   2. RETIRED. The eight old part names are gone, comments too.
//   3. THE NEW NAMES. The stylesheet draws them and EventCards.jsx wears them.
//   4. THE CAPS EXEMPTION. The event text keeps its `#root` prefix.
//   5. THE ROOT. .pitchernotice and its modifiers are N8c's, and stay.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')

function files(dir, ext, prefix = '') {
  return readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return files(abs, ext, `${prefix}${f}/`)
    return ext.some((e) => f.endsWith(e)) ? [`${prefix}${f}`] : []
  })
}

// ---- 1. the seal pin ----

// THE SEAL PIN. Written before this slice changed a line: for each file the
// slice touches or mounts from, the reveal-only modules it imports
// (src/api/spoiler-manifest.json; a "mixed" module counts when a sealed export
// is imported), and how many SealBoxes and revealedThrough reads it holds, as
// measured on origin/main at a75f6edae. A rename changes none of these. If this
// fails, the slice moved a seal: stop and ask, never update the literal.
const N8B_SEAL = {
  'components/playbyplay/EventCards.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
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

test('N8b: the seal pin — no reveal-only import, SealBox or revealedThrough read moved', () => {
  for (const [rel, want] of Object.entries(N8B_SEAL)) {
    const code = src(rel)
    assert.deepEqual(revealOnlyImports(rel), want.reveal, `${rel}: its reveal-only imports changed`)
    assert.equal((code.match(/<SealBox\b/g) ?? []).length, want.sealBoxes, `${rel}: a SealBox was added or removed`)
    assert.equal((code.match(/revealedThrough/g) ?? []).length, want.revealedThrough, `${rel}: a revealedThrough read moved`)
  }
})

// ---- 2. retired ----

// Strict, comments too: a comment that names a retired class sends the next
// reader to a rule that does not exist. docs/adr and docs/design-system-naming.md
// keep the old name, since the ledger records it. The next character may not be
// a word character, so `__code` cannot hide inside a longer name.
const PARTS = ['code', 'code--alert', 'label', 'teammark', 'spacer', 'mvcount', 'eventtext', 'pitchno']
const RETIRED_N8B = new RegExp(`pitchernotice__(${PARTS.join('|')})(?![A-Za-z0-9_])`)

test('N8b: the eight event-bar parts are gone from src, e2e and scripts, comments too', () => {
  const inSrc = files(SRC, ['.css', '.jsx', '.js', '.md']).filter((rel) => RETIRED_N8B.test(src(rel)))
  const inE2e = files(join(ROOT, 'e2e'), ['.js', '.mjs']).filter((rel) => RETIRED_N8B.test(readFileSync(join(ROOT, 'e2e', rel), 'utf8')))
  const inScripts = files(join(ROOT, 'scripts'), ['.js', '.mjs']).filter((rel) => RETIRED_N8B.test(readFileSync(join(ROOT, 'scripts', rel), 'utf8')))
  assert.deepEqual([...inSrc, ...inE2e, ...inScripts], [])
})

// ---- 3. the new names ----

test('N8b: 12-sealbox.css draws the eight parts under .change', () => {
  const css = src('styles/12-sealbox.css')
  for (const part of PARTS) {
    assert.match(css, new RegExp(`^\\.change__${part} \\{`, 'm'), `.change__${part}`)
  }
})

test('N8b: the four event bars wear the new names', () => {
  const code = src('components/playbyplay/EventCards.jsx')
  for (const part of PARTS) {
    assert.match(code, new RegExp(`change__${part}(?![\\w-])`), `change__${part}`)
  }
  assert.equal((code.match(/change__eventtext/g) ?? []).length, 3, 'ejection, baserunning and delay each carry the event text')
  assert.equal((code.match(/change__code(?![\w-])/g) ?? []).length, 3, 'ejection, baserunning and delay each carry a code')
})

// ---- 4. the caps exemption ----

test('N8b: the event text keeps its #root caps exemption', () => {
  const css = src('styles/13-play-by-play.css')
  assert.match(css, /^#root \.change__eventtext,$/m)
  assert.match(css, /^#root \.change__eventtext :is\(\.plink, b\) \{$/m)
  const at = css.indexOf('#root .change__eventtext :is(.plink, b)')
  assert.match(css.slice(at, css.indexOf('}', at)), /text-transform: none; \/\* caps-exempt:/)
  assert.match(src('styles/01-base.css'), /`\.change__eventtext`/, 'the exemption list in 01-base.css names the new part')
})

// ---- 5. the root stays ----

test('N8b: the root, its modifiers and the headshot well are not in this slice', () => {
  const css = src('styles/12-sealbox.css')
  assert.match(css, /^\.pitchernotice--event \{/m)
  assert.match(css, /^\.pitchernotice--pbp \{/m)
  const code = src('components/playbyplay/EventCards.jsx')
  assert.match(code, /pitchernotice \$\{noticeClass\(\{ tone: 'event' \}\)\} pitchernotice--event/)
})
