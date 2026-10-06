// Slice N4 of the Notice collapse (#1132): the shared error line moves onto
// Notice. This is a SPOILER-SCOPE slice — the slate and the lineup page call
// AsyncStatus, the slate card back and Box Lines sit on scoring surfaces — so
// the file opens with a seal pin, then asserts the moved lines from source text
// the way notice-cascade.test.js does (a .jsx file cannot be imported here).
//
//   1. THE SEAL PIN. Measured on origin/main before the first edit.
//   2. AsyncGate.jsx: the cold, stale and not-found lines are a Notice with the
//      error tone; the Retry is the Notice's action; loading and empty unchanged.
//   3. The slate card back and the Box Lines sheet draw their error on Notice.
//   4. The namespace margins that give back the old .hint padding.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const src = (rel) => readFileSync(join(SRC, rel), 'utf8')
const css = (rel) => stripComments(readFileSync(join(SRC, 'styles', rel), 'utf8'))
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

// ---- 1. the seal pin ----

// THE SEAL PIN. Written before this slice changed a line: for each file the
// slice touches, plus the two scoring callers it does not edit, the reveal-only
// modules it imports (src/api/spoiler-manifest.json; a "mixed" module counts
// when a sealed export is imported), every other gated api/ import, and how
// many SealBoxes and revealedThrough reads it holds, as measured on origin/main
// at 608c6062e. Moving an error line onto Notice changes none of these. If this
// fails, the slice moved a seal: stop and ask, never update the literal to match.
const N4_SEAL = {
  'components/boxlines/BoxLinesSheet.jsx': { reveal: [], gated: ['boxlines/fetch.js'], sealBoxes: 0, revealedThrough: 0 },
  'components/game/PastGameFlipCard.jsx': { reveal: [], gated: [], sealBoxes: 0, revealedThrough: 0 },
  'components/ui/AsyncGate.jsx': { reveal: [], gated: [], sealBoxes: 0, revealedThrough: 0 },
  'screens/GameSelect.jsx': { reveal: [], gated: ['postseason/text.js'], sealBoxes: 0, revealedThrough: 0 },
  'screens/GameView.jsx': { reveal: [], gated: ['postseason/bracket.js', 'postseason/text.js'], sealBoxes: 0, revealedThrough: 0 },
}
const SPOILER_MANIFEST = JSON.parse(readFileSync(join(SRC, 'api', 'spoiler-manifest.json'), 'utf8')).modules

// The api/ imports of a file, split the way C4_SEAL splits them
// (test/card-cascade.test.js): `reveal` holds reveal-only modules and mixed
// modules imported for a sealed export; `gated` holds every other module whose
// class is not spoiler-free.
function apiImports(rel) {
  const reveal = new Set()
  const gated = new Set()
  for (const m of src(rel).matchAll(/^import\s+([^'"]*?)\s+from\s+['"](\.[^'"]+)['"]/gm)) {
    const target = join(dirname(join(SRC, rel)), m[2])
    const fromApi = relative(join(SRC, 'api'), target).replaceAll('\\', '/')
    const apiRel = fromApi.startsWith('..') ? null : fromApi
    const entry = apiRel && SPOILER_MANIFEST[apiRel]
    if (!entry) continue
    const names = (m[1].match(/\{([^}]*)\}/)?.[1] ?? '').split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean)
    if (entry.class === 'reveal-only') reveal.add(apiRel)
    else if (entry.class === 'mixed' && names.some((n) => entry.revealOnlyExports.includes(n))) reveal.add(apiRel)
    else if (entry.class !== 'spoiler-free') gated.add(apiRel)
  }
  return { reveal: [...reveal].sort(), gated: [...gated].sort() }
}

test('N4: the seal pin — no reveal-only import, gated import, SealBox or revealedThrough read moved', () => {
  for (const [rel, want] of Object.entries(N4_SEAL)) {
    const code = src(rel)
    const got = apiImports(rel)
    assert.deepEqual(got.reveal, want.reveal, `${rel}: its reveal-only imports changed`)
    assert.deepEqual(got.gated, want.gated, `${rel}: its gated api/ imports changed`)
    assert.equal((code.match(/<SealBox\b/g) ?? []).length, want.sealBoxes, `${rel}: a SealBox was added or removed`)
    assert.equal((code.match(/revealedThrough/g) ?? []).length, want.revealedThrough, `${rel}: a revealedThrough read moved`)
  }
})

// ---- 2. AsyncGate.jsx ----

const GATE = 'components/ui/AsyncGate.jsx'
// The body of one exported function, up to the next top-level export.
const fn = (code, name) => {
  const at = code.indexOf(`export function ${name}(`)
  assert.ok(at !== -1, `${name} exists`)
  const next = code.indexOf('\nexport function ', at + 1)
  return code.slice(at, next === -1 ? undefined : next)
}

test('AsyncGate.jsx draws no bare error line, and imports Notice and Button', () => {
  const code = src(GATE)
  assert.doesNotMatch(code, /hint--error/, 'the bare clay line is gone')
  assert.match(code, /^import \{ Notice \} from '\.\/state\/Notice\.jsx'$/m)
  assert.match(code, /^import \{ Button \} from '\.\/control\/Button\.jsx'$/m)
})

test('AsyncGate(): the not-found or error page is a Notice, error tone, default role (alert)', () => {
  const body = fn(src(GATE), 'AsyncGate')
  assert.match(body, /<Notice tone="error" className="asyncstatus__notice">\s*\{error \? `Couldn’t load this \$\{noun\}\. Try again\.` : `\$\{capitalized\} not found\.`\}\s*<\/Notice>/)
  assert.doesNotMatch(body, /<Notice[^>]*\brole=/, 'no role passed: the error tone says alert')
})

test('AsyncStatus cold error: a Notice, error tone, default role, the Retry Button (tap size, 44px) as its action', () => {
  const body = fn(src(GATE), 'AsyncStatus')
  const cold = body.slice(body.indexOf('if (error && !hasData)'), body.indexOf('if (error && hasData'))
  assert.match(
    cold,
    /<Notice\s+tone="error"\s+className="asyncstatus__notice"\s+action=\{onRetry && <Button onClick=\{onRetry\}>Retry<\/Button>\}\s*>\s*\{errorMessage\}\s*<\/Notice>/,
  )
  assert.doesNotMatch(cold, /\brole=/, 'the cold error is alert now, not status')
  assert.doesNotMatch(cold, /<button/, 'the Retry is the Notice action, not a bare button after it')
})

test('AsyncStatus stale error: a Notice, error tone, role="status" (the data is on screen)', () => {
  const body = fn(src(GATE), 'AsyncStatus')
  const stale = body.slice(body.indexOf('if (error && hasData'), body.indexOf('if (!loading && !error'))
  assert.match(stale, /<Notice tone="error" role="status" className="asyncstatus__notice">\s*\{staleErrorMessage\}\s*<\/Notice>/)
})

test('AsyncStatus and AsyncGate(): the tests that decide WHEN a line shows, and the loading and empty branches, are unchanged', () => {
  const code = src(GATE)
  const status = fn(code, 'AsyncStatus')
  for (const line of [
    'if (loading && !hasData) return <Loader />',
    'if (error && !hasData) {',
    'if (error && hasData && staleErrorMessage) {',
    'if (!loading && !error && !hasData && emptyMessage) {',
    'return <EmptyState>{emptyMessage}</EmptyState>',
    "errorMessage = 'Couldn’t load. Try again.',",
  ])
    assert.ok(status.includes(line), `AsyncStatus keeps: ${line}`)
  const gate = fn(code, 'AsyncGate')
  for (const line of ['if (loading && !data) {', '<Loader />', 'if (!data) {', 'return null'])
    assert.ok(gate.includes(line), `AsyncGate keeps: ${line}`)
})

// ---- 3. the slate card back and Box Lines ----

test('the slate card back draws its error on Notice, static (role=note), inside the same renderBack branch', () => {
  const code = src('components/game/PastGameFlipCard.jsx')
  assert.match(code, /^import \{ Notice \} from '\.\.\/ui\/state\/Notice\.jsx'$/m)
  assert.doesNotMatch(code, /hint--error/)
  assert.match(
    code,
    /if \(state\.loading\) \{\s*return <BoxScoreSkeleton cardMeta=\{cardMeta\} \/>\s*\}\s*if \(state\.error\) \{(?:\s*\/\/[^\n]*)*\s*return \(\s*<Notice tone="error" role="note">\s*Couldn&apos;t load this game\.\s*<\/Notice>\s*\)\s*\}\s*if \(!state\.data\) return null/,
  )
})

test('Box Lines draws its error on Notice with Try again as the action; the loading line keeps .boxlines__hint', () => {
  const code = src('components/boxlines/BoxLinesSheet.jsx')
  assert.match(code, /^import \{ Notice \} from '\.\.\/ui\/state\/Notice\.jsx'$/m)
  assert.match(code, /^import \{ Button \} from '\.\.\/ui\/control\/Button\.jsx'$/m)
  assert.match(
    code,
    /\{failed && \(\s*<Notice\s+tone="error"\s+className="boxlines__notice"\s+action=\{<Button onClick=\{query\.reload\}>Try again<\/Button>\}\s*>\s*Couldn’t pull his game lines\. Try again in a moment\.\s*<\/Notice>\s*\)\}/,
  )
  assert.ok(code.includes('const failed = !query.loading && rows === null'), 'the test that decides WHEN it shows stays')
  assert.ok(code.includes('<p className="hint boxlines__hint">Pulling his game lines…</p>'), 'the loading line is unchanged')
  assert.doesNotMatch(code, /boxlines__retry/, 'the bare retry button is gone')
})

// ---- 4. the namespace margins ----

test('.asyncstatus__notice gives back the 12px the .hint padding gave, after notice.css so it wins', () => {
  const body = ruleBody(css('06-loader-and-cards.css'), '.asyncstatus__notice')
  assert.ok(body, 'the rule exists in 06, which loads after system/notice.css')
  assert.equal(decl(body, 'margin'), 'var(--space-3) 0', '.hint had padding: var(--space-3) 2px')
  assert.equal(decl(ruleBody(css('05-masthead-nav.css'), '.hint'), 'padding'), 'var(--space-3) 2px', 'the number the margin copies')
})

test('boxlines.css: the error Notice takes the status line gap; the retry rule is gone; the loading line keeps .boxlines__hint', () => {
  const sheet = css('boxlines/boxlines.css')
  assert.equal(decl(ruleBody(sheet, '.boxlines__notice'), 'margin'), 'var(--space-2h) 0 0', 'the same gap as .boxlines__empty')
  assert.equal(ruleBody(sheet, '.boxlines__notice').split(';').filter((d) => d.trim()).length, 1, 'a margin and nothing else')
  assert.equal(ruleBody(sheet, '.boxlines__retry'), null)
  assert.ok(ruleBody(sheet, '.boxlines__hint'), 'the loading line still wears it')
})
