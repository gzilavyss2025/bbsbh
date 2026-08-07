#!/usr/bin/env node
// Guards src/api/spoiler-manifest.json — the machine-readable half of the
// spoiler rule (root CLAUDE.md, ADR-0001/0002/0003/0009/0010).
//
// WHY THIS EXISTS. Until the manifest, every module in src/api/ was classified
// only in prose: src/api/CLAUDE.md's catalog, plus each module's own header.
// Prose cannot be checked, and in this repo every convention with a guard held
// while every convention that was only prose drifted (the same argument
// ADR-0038 makes). Three specific things nothing could catch:
//
//   1. A NEW module shipping with no classification at all — the reviewer has
//      to notice, on a diff that is usually about something else.
//   2. A reveal-only module quietly gaining an importer on an open surface.
//   3. A header being WRONG. loadScorecard.js's claimed for months that the
//      module "pulls ONLY spoiler-free, pre-pitch reference data" while
//      importing revealInning/revealTotals two lines below it. Nothing leaked,
//      but only because its one consumer is DEV-gated out of the production
//      graph — the containment was real, it just lived somewhere else.
//
// So: four assertions, cheapest first.
//
//   1. COMPLETENESS — every .js under src/api/ has a manifest entry.
//   2. NO STALE ENTRIES — every manifest entry names a file that exists.
//   3. WELL-FORMED — a known class, a non-empty `why`, `importers` exactly on
//      the classes that take one, `revealOnlyExports` exactly on `mixed`.
//   4. CONTAINMENT — a `reveal-only`/`reveal-gated` module is imported only by
//      its allowlist; a `mixed` module's reveal-only EXPORTS likewise. Stale
//      allowlist entries fail too, the same ratchet rule check-dir-size.mjs
//      uses: a list that quietly stops meaning anything is worse than none.
//
// WHAT IT DOES NOT DO. It cannot prove a reveal-only call sits inside a
// SealBox's reveal render function — that is enforced structurally by
// SealBox.jsx taking `children` as a render function (ADR-0002), not by any
// static check. What this buys is that the set of paths an audit has to walk
// is enumerated and pinned, so a spoiler review is a diff against this file
// rather than a re-trace of the whole graph.
//
// ONE IMPLEMENTATION NOTE worth keeping. Unlike its sibling guards, this one
// RESOLVES import specifiers to real paths instead of substring-matching a
// basename. That is not tidiness: `highlights.js` is a substring of
// `gamehighlights.js`, and those two modules have opposite classifications —
// a basename match reports the Team hub's highlight rail as an importer of the
// reveal-only join it has never touched. Relative sibling imports ('./x.js')
// also defeat any path-tail match. Resolve, don't grep.
//
// Run by `npm run lint` (so it gates every push). Zero deps, walks src/.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const API = join(SRC, 'api')
const MANIFEST = join(API, 'spoiler-manifest.json')

// Classes that carry an `importers` allowlist, i.e. the ones the containment
// assertion applies to. The others are classifications the manifest records
// but does not police: a caller-gated module's gate lives at its CALLER, and a
// cutoff-gated one's lives in the date the caller asks for — neither is a fact
// about who may import what.
const GATED_CLASSES = new Set(['reveal-only', 'reveal-gated', 'mixed'])
const ALL_CLASSES = new Set([
  'reveal-only',
  'reveal-gated',
  'caller-gated',
  'cutoff-gated',
  'progress-only',
  'mixed',
  'spoiler-free',
])

function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (entry.endsWith('.jsx') || entry.endsWith('.js')) out.push(full)
  }
  return out
}

const rel = (file) => relative(SRC, file).replace(/\\/g, '/')

// Blank out comments so this repo's long spoiler-rule headers — which name
// plenty of modules in prose — don't read as imports.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, (m) => ' '.repeat(m.length))
}

// Every `from '...'` / `import('...')` specifier in a file, resolved against
// that file's own directory and returned as a src-relative path. Non-relative
// specifiers (packages) resolve to null and are dropped.
function importsOf(file, src) {
  const out = []
  const re = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g
  let m
  while ((m = re.exec(src))) {
    out.push({ path: rel(resolve(dirname(file), m[1])), index: m.index })
  }
  return out
}

// The named specifiers of the import statement containing `index`. Returns null
// for a default/namespace import or anything unparseable, which the caller
// treats as "assume it reaches the whole module".
function namedSpecifiersAt(src, index) {
  const stmt = src.slice(Math.max(0, index - 400), index)
  const open = stmt.lastIndexOf('{')
  const close = stmt.lastIndexOf('}')
  if (open === -1 || close < open) return null
  return stmt
    .slice(open + 1, close)
    .split(',')
    .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
    .filter(Boolean)
}

const problems = []

let manifest
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
} catch (err) {
  console.error(`\n✗ Could not read ${rel(MANIFEST)}: ${err.message}\n`)
  process.exit(1)
}
const entries = manifest.modules ?? {}

// --- 1 + 2: completeness, both directions ---------------------------------
const onDisk = sourceFiles(API)
  .map((f) => relative(API, f).replace(/\\/g, '/'))
  .sort()

for (const file of onDisk) {
  if (!entries[file]) {
    problems.push(
      `src/api/${file} has no entry in spoiler-manifest.json. Every module here ` +
        `carries a spoiler classification — add one (see the $classes block).`,
    )
  }
}
for (const file of Object.keys(entries)) {
  if (!onDisk.includes(file)) {
    problems.push(
      `spoiler-manifest.json classifies src/api/${file}, which no longer exists. ` +
        `Remove the entry in the same commit that removed the file.`,
    )
  }
}

// --- 3: well-formed entries ------------------------------------------------
for (const [file, entry] of Object.entries(entries)) {
  if (!onDisk.includes(file)) continue // already reported above
  if (!ALL_CLASSES.has(entry.class)) {
    problems.push(
      `src/api/${file} has class "${entry.class}", which is not one of: ` +
        `${[...ALL_CLASSES].join(', ')}.`,
    )
    continue
  }
  if (!entry.why || entry.why.length < 20) {
    problems.push(
      `src/api/${file} has no meaningful "why". The classification is only useful ` +
        `if the next reader can tell whether it still holds.`,
    )
  }
  const gated = GATED_CLASSES.has(entry.class)
  if (gated && !Array.isArray(entry.importers)) {
    problems.push(`src/api/${file} is ${entry.class} but carries no "importers" allowlist.`)
  }
  if (!gated && entry.importers) {
    problems.push(
      `src/api/${file} is ${entry.class}, which takes no "importers" allowlist — ` +
        `containment is only enforced on ${[...GATED_CLASSES].join('/')}.`,
    )
  }
  if (entry.class === 'mixed' && !entry.revealOnlyExports?.length) {
    problems.push(
      `src/api/${file} is "mixed" but names no revealOnlyExports. That list IS the ` +
        `boundary — without it the class means nothing.`,
    )
  }
  if (entry.class !== 'mixed' && entry.revealOnlyExports) {
    problems.push(`src/api/${file} is ${entry.class}, so "revealOnlyExports" does not apply.`)
  }
}

// --- 4: containment --------------------------------------------------------
const files = sourceFiles(SRC)
const parsed = new Map(files.map((f) => [f, stripComments(readFileSync(f, 'utf8'))]))

for (const [file, entry] of Object.entries(entries)) {
  if (!onDisk.includes(file) || !GATED_CLASSES.has(entry.class)) continue
  const target = `api/${file}`
  const allowed = entry.importers ?? []
  const seen = new Set()

  for (const importer of files) {
    const name = rel(importer)
    if (name === target) continue
    const hits = importsOf(importer, parsed.get(importer)).filter((i) => i.path === target)
    if (!hits.length) continue

    // For a mixed module, only an import that names a reveal-only export (or a
    // default/namespace import, which reaches everything) is contained.
    if (entry.class === 'mixed') {
      const touchesSealed = hits.some((hit) => {
        const named = namedSpecifiersAt(parsed.get(importer), hit.index)
        if (named === null) return true
        return named.some((n) => entry.revealOnlyExports.includes(n))
      })
      if (!touchesSealed) continue
    }

    seen.add(name)
    if (!allowed.includes(name)) {
      problems.push(
        entry.class === 'mixed'
          ? `${name} imports a reveal-only export of src/api/${file} ` +
            `(${entry.revealOnlyExports.join(', ')}) and is not on its allowlist.`
          : `${name} imports src/api/${file}, which is ${entry.class} and is not on ` +
            `its allowlist (${allowed.join(', ') || 'empty'}).`,
      )
    }
  }

  for (const stale of allowed.filter((a) => !seen.has(a))) {
    problems.push(
      `spoiler-manifest.json lists ${stale} on src/api/${file}'s allowlist, but it no ` +
        `longer imports it. Drop the entry — an allowlist that outlives its callers ` +
        `stops meaning anything.`,
    )
  }
}

if (problems.length) {
  console.error(
    '\n✗ Spoiler manifest guard failed. src/api/spoiler-manifest.json is the\n' +
      '  machine-readable record of which modules may reveal a score and who may\n' +
      '  reach them (root CLAUDE.md, ADR-0001). Problems:\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  If a new surface genuinely belongs on an allowlist, widen it deliberately\n' +
      "  and say in the PR why that surface cannot render an unrevealed game. If a\n" +
      '  module is newly classified, put the reasoning in its "why" — the next\n' +
      '  audit reads that, not the diff.\n',
  )
  process.exit(1)
}

const counts = {}
for (const entry of Object.values(entries)) counts[entry.class] = (counts[entry.class] ?? 0) + 1
const summary = Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${v} ${k}`)
  .join(', ')
console.log(
  `✓ Spoiler manifest holds — ${onDisk.length} src/api modules classified (${summary}), ` +
    'and every gated module is imported only from its allowlist.',
)
