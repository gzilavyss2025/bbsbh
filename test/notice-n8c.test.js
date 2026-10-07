// Slice N8c of the Notice collapse (#1132): the pitcher-card family drops the
// shape word. The root `.pitchernotice` becomes `.change` (ADR-0084), with the
// body and the other parts of the family, and the frame namespace
// `.pitchernotice--pbp` becomes `.change--framed`. A rename moves no pixel and no
// gate. The innings viewer, the scorecard lens and the focus console are scoring
// surfaces, so the seal pin comes first. Asserted from the source text, the way
// notice-n7.test.js does:
//
//   1. THE SEAL PIN. Measured on origin/main at a75f6edae before the first edit.
//   2. THE RETIRED CLASS. `pitchernotice` is absent from src, e2e and scripts,
//      comments too, except the two families that N8a (the headshot well) and
//      N8b (the event bar parts) still own. Each of those two slices deletes its
//      line from RENAMED_LATER when it renames its parts.
//   3. THE NEW NAMES exist, and no `.change` rule sits beside another one.
//   4. THE ROOTS and THE CALLERS wear the new names.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { stripComments } from './helpers/css.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')

// ---- 1. the seal pin ----

// THE SEAL PIN. Written before this slice changed a line: for each file the
// slice touches or mounts from, the reveal-only modules it imports
// (src/api/spoiler-manifest.json; a "mixed" module counts when a sealed export
// is imported), and how many SealBoxes and revealedThrough reads it holds, as
// measured on origin/main at a75f6edae. A rename changes none of these. If this
// fails, the slice moved a seal: stop and ask, never update the literal.
const N8C_SEAL = {
  'components/inning/HalfInning.jsx': { reveal: ['boxscore.js', 'highlights.js', 'hitchart.js', 'playbyplay.js'], sealBoxes: 1, revealedThrough: 12 },
  'components/playbyplay/PlayByPlay.jsx': { reveal: ['playbyplay.js'], sealBoxes: 0, revealedThrough: 1 },
  'components/scoring/lens/PitcherSheet.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/PitcherNotice.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/BatterNotice.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/FielderNotice.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/PinchRunNotice.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/PitcherHandoffCard.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/EventCards.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/scoring/lens/LensCards.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
  'components/playbyplay/pitcherCard/PitcherCard.jsx': { reveal: [], sealBoxes: 0, revealedThrough: 0 },
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

test('N8c: the seal pin — no reveal-only import, SealBox or revealedThrough read moved', () => {
  for (const [rel, want] of Object.entries(N8C_SEAL)) {
    const code = src(rel)
    assert.deepEqual(revealOnlyImports(rel), want.reveal, `${rel}: its reveal-only imports changed`)
    assert.equal((code.match(/<SealBox\b/g) ?? []).length, want.sealBoxes, `${rel}: a SealBox was added or removed`)
    assert.equal((code.match(/revealedThrough/g) ?? []).length, want.revealedThrough, `${rel}: a revealedThrough read moved`)
  }
})

// ---- 2. the retired class ----

function files(dir, exts) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...files(full, exts))
    else if (exts.some((e) => name.endsWith(e))) out.push(full)
  }
  return out
}

// The parts N8a and N8b still own. Everything else the family named is gone, so
// the strip below leaves no `pitchernotice` anywhere. Delete a line here when
// its slice renames those parts; the empty list is the end state.
const RENAMED_LATER = [
  /pitchernotice__shot[\w-]*/g, // N8a: the headshot well
  /pitchernotice__(?:code|label|teammark|spacer|mvcount|eventtext|pitchno)[\w-]*/g, // N8b: the event bar parts
]
const RETIRED = /pitchernotice/

// Strict, comments too: a comment that names a retired class sends the next
// reader to a rule that does not exist. docs/adr and docs/design-system-naming.md
// keep the old name, since the ledger records it.
test('N8c: .pitchernotice is gone from src, e2e and scripts, comments too', () => {
  const left = []
  for (const dir of [SRC, join(ROOT, 'e2e'), join(ROOT, 'scripts')]) {
    for (const file of files(dir, ['.css', '.jsx', '.js', '.mjs', '.md', '.json'])) {
      let text = readFileSync(file, 'utf8')
      for (const later of RENAMED_LATER) text = text.replace(later, '')
      text.split('\n').forEach((line, i) => {
        if (RETIRED.test(line)) left.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim().slice(0, 100)}`)
      })
    }
  }
  assert.deepEqual(left, [])
})

// ---- 3. the new names exist ----

const sealbox = stripComments(src('styles/12-sealbox.css'))
const allCss = files(join(SRC, 'styles'), ['.css']).map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n')
const has = (css, selector) => new RegExp(`(^|[^\\w-])${selector.replace(/[.]/g, '\\.')}(?![\\w-])`, 'm').test(css)

test('N8c: .change, .change--framed, .change--event and .change--mv exist in 12-sealbox.css', () => {
  for (const sel of ['.change', '.change--framed', '.change--event', '.change--mv']) assert.ok(has(sealbox, sel), `${sel} has a rule`)
})

test('N8c: every part of the family keeps its rule under the new root', () => {
  const parts = ['body', 'badges', 'entering', 'enteringcount', 'enteringwhen', 'flag', 'forline', 'hand', 'jersey', 'now', 'pitcher', 'prtag']
  for (const part of parts) assert.ok(has(allCss, `.change__${part}`), `.change__${part} has a rule`)
})

// ---- 4. the roots and the callers ----

const count = (code, s) => code.split(s).length - 1
const FRAME = "noticeClass({ tone: 'event', className: 'change--framed' })"

test('N8c: the four role roots wear change, and a handoff header row too', () => {
  for (const name of ['PitcherNotice', 'BatterNotice', 'FielderNotice', 'PinchRunNotice']) {
    assert.ok(src(`components/playbyplay/${name}.jsx`).includes('<div className={`change ${className}`}>'), `${name}'s root`)
  }
  assert.equal(count(src('components/playbyplay/PitcherHandoffCard.jsx'), '<div className="change">'), 2, 'both handoff headers')
})

test('N8c: the nine call sites pass change--framed through noticeClass', () => {
  const callers = {
    'components/inning/HalfInning.jsx': 3,
    'components/playbyplay/PlayByPlay.jsx': 4,
    'components/scoring/lens/PitcherSheet.jsx': 1,
    'components/playbyplay/PitcherNotice.jsx': 1,
  }
  for (const [rel, n] of Object.entries(callers)) assert.equal(count(src(rel), `className={${FRAME}}`), n, `${rel}: ${n} call sites`)
})

test('N8c: ArmNotice is still one <button> and wears change and the frame', () => {
  const code = src('components/scoring/lens/LensCards.jsx')
  assert.equal(count(code, `<button type="button" className={\`change \${${FRAME}} sc-armnotice\`} onClick={onOpen}>`), 1)
})

test('N8c: the event bars wear change, change--event and (the mound visit) change--mv', () => {
  const code = src('components/playbyplay/EventCards.jsx')
  const bar = "<div className={`change ${noticeClass({ tone: 'event' })} change--event"
  assert.equal(count(code, bar), 4, 'four event bars')
  assert.equal(count(code, `${bar} change--mv\`}>`), 1, 'the mound visit')
})
