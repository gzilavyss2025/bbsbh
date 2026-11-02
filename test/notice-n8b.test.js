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
//   5. THE ROOT. .pitchernotice and its modifiers were N8c's; N8c renamed them.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

// ---- 2. retired ----

// Strict, comments too: a comment that names a retired class sends the next
// reader to a rule that does not exist. docs/adr and docs/design-system-naming.md
// keep the old name, since the ledger records it. The next character may not be
// a word character, so `__code` cannot hide inside a longer name.
const PARTS = ['code', 'code--alert', 'label', 'teammark', 'spacer', 'mvcount', 'eventtext', 'pitchno']
// ADR-0113: the mound visit's label is its name tab (.card__name), so .change__label is gone;
// the old pitchernotice__label name stays retired.
// Slice 2 (ADR-0113) retired the code chip, the team mark, the spacer, the "N left" tail and
// the pitch number from the bars (the club is a logo, "Pitch N" the count tag), so only the
// event text is still a live part. Their old pitchernotice__ names stay retired.
const LIVE = ['eventtext']
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
  for (const part of LIVE) {
    assert.match(css, new RegExp(`^\\.change__${part} \\{`, 'm'), `.change__${part}`)
  }
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

// ---- 5. the root (renamed by N8c) ----

test('N8b: the root and its modifiers took the .change name in N8c', () => {
  const css = src('styles/12-sealbox.css')
  assert.match(css, /^\.change--event \{/m)
  assert.match(css, /^\.change--framed \{/m)
})
