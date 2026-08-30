#!/usr/bin/env node
// Guards against a NAMED IMPORT whose target does not export that name — the
// inverse of check-dead-exports.mjs, which asks whether an export has importers.
// This asks whether an import has an export.
//
// WHY IT EXISTS. `import { START_CHALLENGES } from '../../api/challenges.js'`
// survived a commit in which the `export const START_CHALLENGES = 2` line was
// deleted along with the comment block above it. eslint passed. All 3,586 unit
// tests passed, because no test imported that name. Only `vite build` caught
// it, in CI, after the push — the one check in the pipeline that resolves the
// module graph. This script moves that class of break back to `npm run lint`,
// where it fails locally in under a second and before the commit hook runs.
//
// The usual answer is eslint-plugin-import's `import/named` rule. That is a new
// dependency and a resolver to configure, for a check the repo can already
// express in the same crude, regex-based style as its twenty-odd other guards
// (ADR-0038). Same trade as check-dead-exports.mjs, which builds most of this
// graph already: a parser would be more correct, a regex is enough to catch a
// deleted export.
//
// WHAT IT CHECKS. Static `import { a, b as c } from './x.js'` and
// `export { a } from './x.js'`, where the specifier is RELATIVE and resolves to
// a file inside the corpus. Everything else is skipped on purpose:
//   - bare/package specifiers ('react') — not ours to resolve
//   - default and namespace imports — `import x` / `import * as x` cannot name
//     a missing export
//   - dynamic `import()` and the lazyNamed()/`.then((m) => m.X)` shapes — a
//     wrong name there is a RUNTIME failure, not a build one, so it is out of
//     this guard's scope (check-dead-exports.mjs models those for its own
//     question)
//
// FOLLOWING RE-EXPORTS. A barrel that says `export * from './y.js'` exports
// everything y does, so star re-exports are followed transitively (with a seen
// set, since a cycle would otherwise hang). A file that re-exports from a
// package rather than a local file is treated as exporting ANY name — there is
// no way to know what a package exports without resolving node_modules, and
// guessing would mean false positives.
//
// Run by `npm run lint` (so it gates every push).

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const CODE_EXT = new Set(['.js', '.jsx', '.mjs'])
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.vercel'])
const CORPUS_ROOTS = ['src', 'api', 'scripts', 'test', 'e2e']

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = CORPUS_ROOTS.flatMap((root) => walk(join(ROOT, root))).filter((f) =>
  CODE_EXT.has(extname(f)),
)
const src = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]))

// COMMENT STRIPPING, AND WHY THE ORDER MATTERS. Blanking block comments first
// is wrong: `// profiles/*.jsx's shelfMarks` (LogoShelf.jsx) and
// `// (scripts/data/contracts/*.csv)` (positions.js) both put a `/*` inside a
// LINE comment, and a block-first pass reads that as an opener and swallows
// everything down to the next real `*/` — in those two files, the actual
// `export` 30 and 70 lines below. Line comments therefore go first.
//
// The two sides of this guard want OPPOSITE failure modes, so they get
// different treatment:
//   exportsOf   runs on RAW text. Over-collecting a name (from a commented-out
//               or documented export) only makes the guard more permissive.
//               UNDER-collecting is what produces a false failure.
//   importsOf   runs on comment-stripped text and anchors at line start. Here
//               over-collecting is the danger: an example import inside a
//               comment would be checked as if it were real.
function stripComments(text) {
  return text
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"\`])\/\/.*$/gm, '$1')
    .replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' '))
}

function resolveSpecifier(spec, fromFile) {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(fromFile), spec)
  const candidates = [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    join(base, 'index.js'),
    join(base, 'index.jsx'),
  ]
  return candidates.find((c) => src.has(c)) ?? null
}

// Every name a file exports. `star` is the list of specifiers it re-exports
// wholesale; `opaque` means it star-re-exports from something unresolvable (a
// package, or a file outside the corpus), so no name can be called missing.
function exportsOf(file) {
  // Whole-text, not line-by-line: this repo's barrels (src/api/person.js,
  // playbyplay.js, callout-notes.js) re-export in MULTI-LINE
  // `export {\n  a,\n  b,\n} from './x.js'` blocks, and a per-line scan sees
  // only the bare `export {` and never the names. That mistake reported 219
  // false positives against a tree whose build was green.
  const text = src.get(file)
  const names = new Set()
  const star = []
  let opaque = false

  for (const re of [
    /export\s+(?:const|let|var)\s+(\w+)/g,
    /export\s+(?:async\s+)?function\*?\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
  ]) {
    for (const m of text.matchAll(re)) names.add(m[1])
  }

  // export { a, b as c } [from '...'] — the names this file EXPOSES are the
  // ones to the right of `as`, whether or not there is a `from` clause.
  for (const m of text.matchAll(/export\s*\{([\s\S]*?)\}/g)) {
    for (const part of m[1].split(',')) {
      const p = part.trim()
      if (!p) continue
      const as = p.match(/^(\S+)\s+as\s+(\S+)$/)
      names.add(as ? as[2] : p)
    }
  }

  for (const m of text.matchAll(/export\s+\*\s+from\s+['"]([^'"]+)['"]/g)) {
    const target = resolveSpecifier(m[1], file)
    if (target) star.push(target)
    else opaque = true
  }
  // export * as ns from 'x' — exposes one name, not everything.
  for (const m of text.matchAll(/export\s+\*\s+as\s+(\w+)\s+from/g)) names.add(m[1])

  return { names, star, opaque }
}

// Star re-exports followed transitively. There are none in the repo today, so
// this is future-proofing rather than load-bearing — which is exactly why it is
// written not to lie if one appears: a traversal that breaks a cycle returns a
// PARTIAL name set, and caching that partial would make a later query miss real
// exports and report a false failure. Only complete traversals are cached.
const exportCache = new Map()
function allExportsOf(file, seen = new Set()) {
  if (exportCache.has(file)) return exportCache.get(file)
  if (seen.has(file)) return { names: new Set(), opaque: false, partial: true }
  seen.add(file)

  const own = exportsOf(file)
  const names = new Set(own.names)
  let opaque = own.opaque
  let partial = false
  for (const target of own.star) {
    const sub = allExportsOf(target, seen)
    for (const n of sub.names) names.add(n)
    if (sub.opaque) opaque = true
    if (sub.partial) partial = true
  }
  seen.delete(file)

  const result = { names, opaque, partial }
  if (!partial) exportCache.set(file, result)
  return result
}

// Named bindings a file pulls in, with the line each sits on.
function namedImportsOf(file) {
  const text = stripComments(src.get(file))
  const out = []

  // `import ... from 'x'` / `export { ... } from 'x'`, either possibly spanning
  // several lines, and anchored at the start of a line so prose never matches.
  // The brace group carries the named bindings; a clause with no braces
  // (default or namespace) contributes nothing this guard can check.
  const re = /^[ \t]*(?:import|export)\s+([^;'"]*?)\s*from\s*['"]([^'"]+)['"]/gm
  let m
  while ((m = re.exec(text))) {
    const clause = m[1]
    const spec = m[2]
    const brace = clause.match(/\{([\s\S]*)\}/)
    if (!brace) continue
    const line = text.slice(0, m.index).split('\n').length
    for (const part of brace[1].split(',')) {
      const p = part.trim()
      if (!p) continue
      const as = p.match(/^(\S+)\s+as\s+(\S+)$/)
      const imported = as ? as[1] : p
      if (imported === 'default' || !/^\w+$/.test(imported)) continue
      out.push({ name: imported, spec, line })
    }
  }
  return out
}

const problems = []
let checked = 0
for (const file of files) {
  for (const { name, spec, line } of namedImportsOf(file)) {
    const target = resolveSpecifier(spec, file)
    if (!target) continue
    checked += 1
    const { names, opaque } = allExportsOf(target)
    if (opaque || names.has(name)) continue
    problems.push({ file: relative(ROOT, file), line, name, target: relative(ROOT, target) })
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} named import(s) with no matching export:\n`)
  for (const p of problems) {
    console.error(`  ${p.file}:${p.line}`)
    console.error(`    imports { ${p.name} } from ${p.target}, which does not export it`)
  }
  console.error(
    '\n  Either the export was removed/renamed, or the import is a typo.\n' +
      '  This is what breaks `npm run build` with [MISSING_EXPORT].\n',
  )
  process.exit(1)
}

console.log(
  `✓ Import-resolution guard holds — ${checked} named imports across ${files.length} files all resolve to a real export.`,
)
