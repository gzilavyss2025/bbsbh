#!/usr/bin/env node
// Guards against a named/default export in src/ that nothing else imports — an
// orphaned function or constant left behind after its last caller was removed.
// Regex-based static analysis, in the same "crude on purpose" spirit as
// check-dir-size.mjs/check-file-size.mjs (ADR-0038): it cannot understand the
// code, only count references to it, so a real audit still has to read the
// context before deleting anything this flags.
//
// WHAT IT WALKS. Every export in src/**/*.{js,jsx} is checked against an
// import graph built from src/, api/, scripts/ and e2e/. An export only a test
// (test/) imports is NOT used (#2845): ~1,000 lines of src/api code piled up that
// way with no product caller. A test still counts for "is this file imported at
// all", so a whole file only tests import is checked, but never for a name.
// A generator script's import is a real use.
// A barrel's `export { x } from './y.js'` is a use of y's x only when the barrel's own x is
// used outside test/. The barrel's own names are not checked, only the leaf's. An ALLOWLIST
// entry that a non-test file now uses fails too: drop it.
// A name called elsewhere in ITS OWN file — an internal helper that also
// happens to carry an `export` keyword nobody else reaches for — ALSO counts
// as used: that code is reachable, so flagging it would just be noise about
// an unnecessary keyword, not a dead-code finding. This guard only fires on
// an export with ZERO references anywhere, cross-file or same-file — the
// thing an audit would actually delete. (First cut of this script checked
// cross-file imports only and flagged ~90 ordinary internal helpers as
// "dead"; every one of them turned out to be called from elsewhere in the
// same file. Comment/doc mentions don't count as a reference either — see
// below.)
//
// DYNAMIC IMPORTS. Every lazy-loaded screen in this app goes through
// `lazyNamed(() => import('./Screen.jsx'), 'ScreenName')` (src/lib/react/lazyNamed.js) or the
// equivalent inline `import('./x.jsx').then((m) => ({ default: m.X }))` /
// `.then((m) => m.X(...))` shape (a handful of Clerk-gated components). Both are pattern-matched below so
// a lazily-routed export doesn't read as dead just because no STATIC `import`
// statement names it. A future dynamic-import shape that doesn't match either
// pattern will misfire this guard — that is expected of a regex, not a parser;
// widen the two regexes below rather than reaching for ALLOWLIST first.
//
// WHAT COUNTS AS "UNUSED" ELSEWHERE. Prose mentions — a comment, CLAUDE.md, or
// a docs/*.md file naming the export — do NOT count as usage; only another
// `.js`/`.jsx`/`.mjs` file with a real reference does. That distinction is what
// caught the real dead code this guard was written to encode (a re-export and
// four forgotten helper functions, none called from anywhere, each just
// documented at some point) — see the PR that added this script.
//
// ALLOWLIST. A small number of exports are deliberately unused right now and
// documented as such at their own declaration (a forward-looking API staged
// ahead of its first caller, or a re-export kept open for a caller that hasn't
// landed yet). Each entry below names the export AND the reason, so the list
// stays a set of decisions, not a growing set of exceptions nobody reads.
// Adding an entry is a deliberate call for a PR description, not a reflex to
// make lint green — the default fix for a real finding is to delete the code.
//
// Run by `npm run lint` (so it gates every push).

import { readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { ROOT, walk } from './lib/walk.mjs'


const CODE_EXT = new Set(['.js', '.jsx', '.mjs'])
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.vercel'])
// Every root whose files can import from src/. test/ is walked only to mark a file
// as imported (see the import loop); its imports never count as a use.
const CORPUS_ROOTS = ['src', 'api', 'scripts', 'test', 'e2e']
// Only exports declared in these are checked — api/ and scripts/ have their
// own conventions (Vercel handlers, one-off generators) this guard doesn't
// model.
const CHECKED_ROOT = 'src'

// name -> reason, keyed as "relative/path.js#exportName". Each reason is the
// one that belongs in a PR description if this list needs to grow.
const ALLOWLIST = {
  'src/api/milbHistory.js#historicalClubName': 'Deliberately staged ahead of its first caller — the function\'s own header comment says "Not yet wired into any screen (no historical logo art exists yet)"; it is exposed for a future pass, not forgotten.',
  'src/lib/milbColors.js#MILB_COLORS': 'Re-exported on purpose ("so every existing MiLB caller ... still has one import for \'MiLB colors\'") even though every current caller happens to import it from brandColors.js instead. Kept open as the intended single entry point.',
  'src/lib/milbColors.js#MILB_RESEARCHED_PAIRS': 'Same re-export as MILB_COLORS above, same file, same rationale.',
  'src/lib/wpa/wpaBandColors.js#WPA_PLOT_SIZE': 'Declared "exported so Team Identity Lab\'s WPA preview can render its tile pattern at TRUE size" — the lab does not currently read it (comment may be ahead of the wiring), flagged for a maintainer to confirm rather than deleted blind.',
}

// Several exports of one file that share a reason: { 'path#name': reason }.
const staged = (file, names, why) => Object.fromEntries(names.map((n) => [`${file}#${n}`, why]))

Object.assign(
  ALLOWLIST,
  staged('src/api/gameday/moments/moments.js', ['levelFor', 'momentsForPlay'], '(#2574) staged: Gameday\'s moments dial waits for its screen. Only test/gameday-moments.test.js uses it today.'),
  staged('src/api/ovr/ovrData.js', ['fetchOvrHistory'], '(#1703) staged: gen-ovr.mjs has the history write PAUSED until the OVR card shows it (Gary, 2026-11-04); this is its reader. test/ovr/history.test.js.'),
  staged('src/api/history/onThisDay.js', ['onThisDay'], 'ADR-0100 ships the on-this-day shards and their reader first; the page that calls it is not built. Pinned by test/on-this-day.test.js.'),
  staged('src/api/savant/attackAngle.js', ['fetchAttackAngles'], 'Phase C data fetch of the contact replay (docs/contact-replay.md, row C), kept with the replay models listed below; the replay card is deleted, so nothing calls it. test/savant-attack-angle.test.js.'),
  staged('src/api/boxlines/careerSplits.js', ['DOOR_COLUMNS_WIDE', 'DOOR_EMPHASIS'], 'Card column vocabulary (ADR-0073) that names doorCells({ wide }) and the inked cell; no screen reads it today. Pinned against doorCells in test/splits-part-a.test.js and test/boxlines-card-facets.test.js.'),
  staged('src/api/game.js', ['resetPitcherReads'], 'test seam: clears the pitcher-read memos between cases, test/pitcher-card-data.test.js.'),
  staged('src/api/scout/rosterStats.js', ['resetRosterReads'], 'test seam: clears the roster-read memo between cases, test/world-series/roster-card.test.js.'),
  staged('src/lib/headshot/retry.js', ['resetSiloMisses'], 'test seam: clears the silo-miss set between cases, test/headshot.test.js.'),
  staged('src/lib/ballpark/layout/fenceShape.js', ['fenceProblems'], 'test seam: validates every live ballpark outline, test/ballpark-layouts.test.js.'),
  staged('src/lib/ballpark/layout/resolveLayout.js', ['allBallparkLayouts'], 'test seam: walks every live ballpark layout (coverage report and tests), test/ballpark-layouts.test.js and three more.'),
  staged('src/lib/pitcherCard/replaySteps.js', ['replaySteps', 'countAt', 'basesAt'], 'Kept on purpose with their tests: the pure models behind the deleted at-bat replay (src/components/playbyplay/CLAUDE.md, docs/contact-replay.md).'),
  staged('src/lib/pitcherCard/contactDraw.js', ['apexLabel', 'distanceLabel', 'sidePathFor'], 'Kept on purpose with their tests: the deleted at-bat replay\'s side view (src/components/playbyplay/CLAUDE.md, docs/contact-replay.md).'),
  staged('src/lib/pitcherCard/atBat.js', ['markHomeRun'], 'Kept on purpose with its test: the deleted at-bat replay (src/components/playbyplay/CLAUDE.md, docs/contact-replay.md).'),
  staged('src/lib/pitcherCard/quality.js', ['qualityFigures'], 'Kept on purpose with its test: the deleted at-bat replay (src/components/playbyplay/CLAUDE.md, docs/contact-replay.md).'),
  staged('src/lib/pitcherCard/sideWall.js', ['wallAlong'], 'Kept on purpose with its test: the deleted at-bat replay (src/components/playbyplay/CLAUDE.md, docs/contact-replay.md).'),
  staged('src/lib/motion/curves.js', ['easeStamp', 'easeUnfold'], 'Curves docs/contact-replay.md names for the kept replay models; pinned by test/motion-curves.test.js.'),
  staged('src/lib/contracts/parseMoney.js', ['parseMoneyCell'], 'Used by the .scratch contract build scripts (.scratch/contracts/, .scratch/team-success/), which sit outside this guard\'s roots; pinned by test/parse-money.test.js.'),
  staged('src/lib/contracts/positions.js', ['POSITIONS', 'resolveRole'], 'Used by the .scratch contract build scripts (.scratch/contracts-extensions/, .scratch/prospect-value/), which sit outside this guard\'s roots; pinned by test/contracts-positions.test.js.'),
  staged('src/lib/runExpectancy.js', ['lookupEraRE'], 'Staged reader of the per-decade run-expectancy tables (docs/api/static-data.md); no screen reads per-count run expectancy yet. Pinned by test/run-expectancy-eras.test.js.'),
)

const allFiles = CORPUS_ROOTS.flatMap((root) => walk(join(ROOT, root), { skip: IGNORE_DIRS }))
const codeFiles = allFiles.filter((f) => CODE_EXT.has(extname(f)))
const src = new Map(codeFiles.map((f) => [f, readFileSync(f, 'utf8')]))

function resolveSpecifier(spec, fromFile) {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(fromFile), spec)
  const candidates = [base, `${base}.js`, `${base}.jsx`, `${base}.mjs`, join(base, 'index.js'), join(base, 'index.jsx')]
  return candidates.find((c) => src.has(c)) ?? null
}

function extractImports(text) {
  const imports = []
  const importRe = /import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g
  let m
  while ((m = importRe.exec(text))) {
    if (m[3]) continue // side-effect only import — no bindings to track
    const clause = m[1].trim()
    const spec = m[2]
    const names = []
    let hasDefault = false
    let hasNamespace = /\*\s+as\s+\w+/.test(clause)
    const braceMatch = clause.match(/\{([^}]*)\}/)
    if (braceMatch) {
      for (const part of braceMatch[1].split(',')) {
        const p = part.trim()
        if (!p) continue
        const asMatch = p.match(/^(\S+)\s+as\s+(\S+)$/)
        names.push(asMatch ? asMatch[1] : p)
      }
    }
    if (clause[0] !== '{' && clause[0] !== '*' && /^\w/.test(clause)) hasDefault = true
    imports.push({ spec, names, hasDefault, hasNamespace })
  }

  // `export * from 'x'`. A NAMED re-export (`export { a } from 'x'`) is not an import: see
  // extractReExports, which the graph below resolves only once the barrel's own name is used.
  const reExportStarRe = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g
  while ((m = reExportStarRe.exec(text))) {
    imports.push({ spec: m[1], names: [], hasDefault: true, hasNamespace: true })
  }

  // Static-string dynamic import('x') — treated as default-only (this app's
  // React.lazy() usage never reaches for a named export off a bare import()).
  const dynRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = dynRe.exec(text))) imports.push({ spec: m[1], names: [], hasDefault: true, hasNamespace: false })

  return imports
}

// Named re-exports: `export { a, b as c } from 'x'` (across lines too). -> [{ spec, pairs:
// [{ orig, exported, offset }] }], `offset` being where the exported name sits in `text`.
function extractReExports(text) {
  const out = []
  for (const m of text.matchAll(/export\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    const pairs = []
    let from = m.index
    for (const part of m[1].split(',')) {
      const p = part.trim()
      if (!p) continue
      const asMatch = p.match(/^(\S+)\s+as\s+(\S+)$/)
      const [orig, exported] = asMatch ? [asMatch[1], asMatch[2]] : [p, p]
      const offset = text.indexOf(p, from)
      from = offset + p.length
      pairs.push({ orig, exported, offset })
    }
    out.push({ spec: m[2], pairs })
  }
  return out
}

// Two dynamic-import shapes carry a NAMED export past a bare import(), neither
// visible to extractImports above:
//   lazyNamed(() => import('./Screen.jsx'), 'ScreenName')   — src/lib/react/lazyNamed.js
//   import('./x.jsx').then((m) => ({ default: m.X }))       — a few Clerk/
//   import('./x.jsx').then((m) => m.X(...))                    dynamic gates
// Returns [{ spec, names: [...] }].
function extractDynamicNamedImports(text) {
  const out = []
  const lazyNamedRe = /import\(\s*['"]([^'"]+)['"]\s*\)\s*,\s*['"](\w+)['"]\s*,?\s*\)/g
  let m
  while ((m = lazyNamedRe.exec(text))) out.push({ spec: m[1], names: [m[2]] })

  // A bare import('x'), for the `.then((m) => ...)` shape. Found by INDEX
  // rather than a consuming regex with trailing context: two import() calls
  // can sit within a few lines of each other (e.g. AccountButton then
  // ContinueScoring in the same file), and a regex that captures "the next
  // 400 chars" as part of its own match swallows the next call's `import(`
  // before the engine ever gets to look for it as a separate match — silently
  // dropping every import() but the first in a cluster. Slicing by explicit
  // start indices sidesteps that: each call's tail window stops at the next
  // call's start (or 400 chars, whichever is shorter), so windows never
  // overlap and every call is inspected independently.
  const importStarts = [...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((mm) => ({
    spec: mm[1],
    start: mm.index,
    end: mm.index + mm[0].length,
  }))
  importStarts.forEach(({ spec, end }, i) => {
    const nextStart = i + 1 < importStarts.length ? importStarts[i + 1].start : text.length
    const tail = text.slice(end, Math.min(end + 400, nextStart))
    if (!/\.then\s*\(/.test(tail)) return
    const paramMatch = tail.match(/\.then\(\s*\(\s*(\w+)\s*\)/)
    if (!paramMatch) return
    const param = paramMatch[1]
    const memberRe = new RegExp(`\\b${param}\\.(\\w+)`, 'g')
    const names = [...tail.matchAll(memberRe)].map((mm) => mm[1])
    if (names.length) out.push({ spec, names })
  })

  // `const [{ A }, { B, C }] = await Promise.all([import('a'), import('b')])`
  // (src/main.jsx's Clerk gate) — positional destructuring of a Promise.all
  // array of import() calls, no `.then()` in sight. Pairs the i-th `{...}`
  // destructure with the i-th import() by position.
  const promiseAllRe = /const\s*\[([^\]]*)\]\s*=\s*await\s+Promise\.all\(\s*\[([^\]]*)\]\s*\)/g
  while ((m = promiseAllRe.exec(text))) {
    const destructures = [...m[1].matchAll(/\{([^}]*)\}/g)].map((mm) => mm[1])
    const specs = [...m[2].matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((mm) => mm[1])
    destructures.forEach((rawNames, i) => {
      const spec = specs[i]
      if (!spec) return
      const names = rawNames
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => (p.match(/^(\S+)\s*:\s*(\S+)$/) || [null, p])[1])
      if (names.length) out.push({ spec, names })
    })
  }
  return out
}

// Returns { declLine: Map<name, lineIndex>, hasDefault, lines } — `lines` is
// the comment-blanked text split on '\n', so callers can both enumerate
// exported names and later check the REST of the file for a real reference
// to each one (excluding the line it's declared on).
function extractExports(text) {
  const declLine = new Map()
  let hasDefault = false
  // Line comments go FIRST. Blanking block comments first is wrong: a `/*`
  // can sit inside a LINE comment — `// profiles/*.jsx's shelfMarks`
  // (LogoShelf.jsx), `// (scripts/data/contracts/*.csv)` (positions.js) — and
  // a block-first pass reads that as an opener and swallows everything down to
  // the next real `*/`. In those two files that ate the actual `export` 30 and
  // 70 lines below, so this guard could not see LogoShelf or POSITIONS at all
  // and silently skipped them. Stripping `//` to end-of-line first cannot make
  // the same mistake: a `/*` inside a line comment is gone before the block
  // pass runs. (The `[^:'\"`]` guard keeps `https://` and the like intact.)
  const stripped = text
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'\"`])\/\/.*$/gm, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '))
  const lines = stripped.split('\n')

  const declPatterns = [
    /export\s+(?:const|let|var)\s+(\w+)/,
    /export\s+(?:async\s+)?function\*?\s+(\w+)/,
    /export\s+class\s+(\w+)/,
  ]
  lines.forEach((rawLine, i) => {
    const codeOnly = rawLine.replace(/\/\/.*$/, '')
    for (const p of declPatterns) {
      const m = codeOnly.match(p)
      if (m) declLine.set(m[1], i)
    }
    if (/export\s+default\s/.test(codeOnly)) hasDefault = true
    const listMatch = codeOnly.match(/export\s+\{([^}]*)\}(?!\s+from)/)
    if (listMatch) {
      for (const part of listMatch[1].split(',')) {
        const p = part.trim()
        if (!p) continue
        const asMatch = p.match(/^(\S+)\s+as\s+(\S+)$/)
        const exportedName = asMatch ? asMatch[2] : p
        if (exportedName === 'default') hasDefault = true
        else if (!declLine.has(exportedName)) declLine.set(exportedName, i)
      }
    }
  })
  return { declLine, hasDefault, lines }
}

// Is `name` referenced anywhere in `lines` other than `skipLine`? A plain
// whole-word text search, same crude standard as the rest of this guard —
// good enough to tell "called from elsewhere in this file" from "declared
// and never touched again".
function usedElsewhereInFile(lines, skipLine, name) {
  const re = new RegExp(`\\b${name}\\b`)
  return lines.some((line, i) => i !== skipLine && re.test(line.replace(/\/\/.*$/, '')))
}

const testDir = join(ROOT, 'test') + sep
const usedNamed = new Map(codeFiles.map((f) => [f, new Set()]))
const usedDefault = new Map(codeFiles.map((f) => [f, false]))
const namespaceImported = new Map(codeFiles.map((f) => [f, false]))
const importedAtAll = new Map(codeFiles.map((f) => [f, false]))
const reExports = [] // { barrel, target, pairs } from a non-test file

for (const fromFile of codeFiles) {
  const text = src.get(fromFile)
  const fromTest = fromFile.startsWith(testDir)
  for (const r of extractReExports(text)) {
    const target = resolveSpecifier(r.spec, fromFile)
    if (!target) continue
    importedAtAll.set(target, true)
    if (!fromTest) reExports.push({ barrel: fromFile, target, pairs: r.pairs })
  }
  for (const imp of extractImports(text)) {
    const target = resolveSpecifier(imp.spec, fromFile)
    if (!target) continue
    importedAtAll.set(target, true)
    if (fromTest) continue
    if (imp.hasNamespace) namespaceImported.set(target, true)
    if (imp.hasDefault) usedDefault.set(target, true)
    for (const n of imp.names) (n === 'default' ? usedDefault.set(target, true) : usedNamed.get(target).add(n))
  }
  for (const imp of extractDynamicNamedImports(text)) {
    const target = resolveSpecifier(imp.spec, fromFile)
    if (!target) continue
    importedAtAll.set(target, true)
    if (fromTest) continue
    for (const n of imp.names) (n === 'default' ? usedDefault.set(target, true) : usedNamed.get(target).add(n))
  }
}

// A barrel's `export { x } from './y.js'` is a use of y's x only when the barrel's own `x` is used
// outside test/ (an import of it, or a re-export of it by another barrel). Repeat to a fixed point.
for (let changed = true; changed; ) {
  changed = false
  for (const { barrel, target, pairs } of reExports) {
    for (const { orig, exported } of pairs) {
      const barrelUsed = exported === 'default' ? usedDefault.get(barrel) : usedNamed.get(barrel).has(exported)
      if (!barrelUsed && !namespaceImported.get(barrel)) continue
      if (orig === 'default') {
        if (!usedDefault.get(target)) changed = !!usedDefault.set(target, true)
      } else if (!usedNamed.get(target).has(orig)) {
        usedNamed.get(target).add(orig)
        changed = true
      }
    }
  }
}

// index.html loads src/main.jsx directly, no import statement involved.
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8')
for (const m of indexHtml.matchAll(/src=["']([^"']+)["']/g)) {
  const abs = resolve(ROOT, m[1].replace(/^\//, ''))
  if (src.has(abs)) importedAtAll.set(abs, true)
}

const srcDir = join(ROOT, CHECKED_ROOT)
const checkedFiles = codeFiles.filter((f) => f.startsWith(srcDir + '\\') || f.startsWith(srcDir + '/'))

const problems = []
const staleAllowlist = new Set(Object.keys(ALLOWLIST))

for (const f of checkedFiles) {
  if (!importedAtAll.get(f)) continue // a whole unimported file is a different, louder problem than this guard covers
  if (namespaceImported.get(f)) continue // can't tell statically which members a `* as ns` import touches
  const rel = relative(ROOT, f).replace(/\\/g, '/')
  const exp = extractExports(src.get(f))
  const usedByOthers = usedNamed.get(f)
  for (const [name, line] of exp.declLine) {
    const key = `${rel}#${name}`
    if (ALLOWLIST[key]) {
      staleAllowlist.delete(key)
      if (usedByOthers.has(name)) problems.push(`ALLOWLIST has "${key}" but a non-test file now uses it — drop the entry.`)
      continue
    }
    if (usedByOthers.has(name)) continue
    if (usedElsewhereInFile(exp.lines, line, name)) continue
    problems.push(`${rel}: export "${name}" has no reference anywhere — not imported by another file, and not called elsewhere in its own file.`)
  }
  if (exp.hasDefault && !usedDefault.get(f)) {
    const key = `${rel}#default`
    if (ALLOWLIST[key]) {
      staleAllowlist.delete(key)
      if (usedDefault.get(f)) problems.push(`ALLOWLIST has "${key}" but a non-test file now imports it — drop the entry.`)
    } else problems.push(`${rel}: the default export is not imported anywhere.`)
  }
}

for (const key of staleAllowlist) {
  problems.push(`ALLOWLIST has "${key}" but that export is now genuinely used (or gone) — drop the entry.`)
}

if (problems.length) {
  console.error(
    '\n✗ Dead-export guard failed. Regex-based, so read the export before deleting\n' +
      '  it — an internal helper that also carries `export` for no external caller\n' +
      '  is a candidate to un-export, not necessarily to delete; a genuine orphan\n' +
      '  (nothing calls it at all) should just go. Problems:\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Fix by deleting unreachable code, dropping an unnecessary `export`, or —\n' +
      '  for a deliberate, documented exception — adding it to ALLOWLIST in this\n' +
      '  script with the reason, the same way BUDGETS works in check-dir-size.mjs.\n',
  )
  process.exit(1)
}

console.log(
  `✓ Dead-export guard holds — ${checkedFiles.length} files checked, ${Object.keys(ALLOWLIST).length} deliberate exceptions on the allowlist.`,
)
