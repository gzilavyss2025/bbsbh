#!/usr/bin/env node
// Every var(--x) with no fallback must name a custom property that something
// defines (#2526).
//
// A var() of an undefined property is invalid at computed-value time: the declaration
// silently falls back to an inherited or initial value. Before #2522 four rules read
// --accent-link ahead of its definition, so "See all ›" drew in the heading's graphite
// and nothing failed.
//
// What counts as defined:
//   - a `--name:` declaration in any stylesheet under src/ (tokens, and a local rule
//     such as --band-fill in system/section-head.css);
//   - a `'--name'` string literal in src/ JS (setProperty, a style-object key, a theme
//     such as --bar-fill in lib/headerTheme.js). A literal that opens a template
//     (`--row-${i}`) defines every property with that prefix.
// A read with a fallback, var(--x, y), is allowed.
//
// Reads are checked in src/**/*.css, in the `css` field of .design-sync/captures/*.json
// (saved cards carry copies of CSS rules), and in public/learn.css, which is standalone
// and may read only what it declares itself.
//
// Not checked: that a defined property is used; var() reads inside JS strings.
// Run by `npm run lint`.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, walk } from '../lib/walk.mjs'
import { maskComments } from './mask-comments.mjs'

const DECL_RE = /(--[\w-]+)\s*:/g
const READ_RE = /var\(\s*(--[\w-]+)\s*([,)])/g
const LITERAL_RE = /['"`](--[\w-]+)(\$\{)?/g

export function declaredIn(css) {
  return new Set([...maskComments(css, 'css').matchAll(DECL_RE)].map((m) => m[1]))
}

// { names, prefixes } from the '--name' literals of one JS source.
export function literalsIn(js) {
  const names = new Set()
  const prefixes = new Set()
  for (const m of maskComments(js, 'js').matchAll(LITERAL_RE)) (m[2] ? prefixes : names).add(m[1])
  return { names, prefixes }
}

// `defined` is { names, prefixes }; `own` (optional) is a Set of names this source defines itself.
export function findUndefinedReads(css, defined, own = new Set()) {
  const masked = maskComments(css, 'css')
  const found = []
  for (const m of masked.matchAll(READ_RE)) {
    const name = m[1]
    if (m[2] === ',' || defined.names.has(name) || own.has(name)) continue
    if ([...defined.prefixes].some((p) => name.startsWith(p))) continue
    found.push({ line: masked.slice(0, m.index).split('\n').length, name })
  }
  return found
}

function main() {
  const cssFiles = walk(`${ROOT}/src`, { exts: ['.css'] })
  const jsFiles = walk(`${ROOT}/src`, { exts: ['.js', '.jsx'] })
  const defined = { names: new Set(), prefixes: new Set() }
  for (const f of cssFiles) for (const n of declaredIn(readFileSync(f, 'utf8'))) defined.names.add(n)
  for (const f of jsFiles) {
    const { names, prefixes } = literalsIn(readFileSync(f, 'utf8'))
    for (const n of names) defined.names.add(n)
    for (const p of prefixes) defined.prefixes.add(p)
  }

  const problems = []
  const check = (label, css, defs, own) => {
    for (const { line, name } of findUndefinedReads(css, defs, own)) problems.push(`${label}:${line}: var(${name}) is not defined anywhere`)
  }
  for (const f of cssFiles) check(relative(ROOT, f), readFileSync(f, 'utf8'), defined)
  const captures = walk(`${ROOT}/.design-sync/captures`, { exts: ['.json'], tolerant: true })
  for (const f of captures) {
    const css = JSON.parse(readFileSync(f, 'utf8')).css ?? ''
    check(`${relative(ROOT, f)} (css)`, css, defined, declaredIn(css))
  }
  const learn = readFileSync(`${ROOT}/public/learn.css`, 'utf8')
  check('public/learn.css', learn, { names: new Set(), prefixes: new Set() }, declaredIn(learn))

  if (problems.length) {
    console.error(`✗ css-vars guard: ${problems.length} read(s) of an undefined custom property.`)
    for (const p of problems) console.error(`  ${p}`)
    console.error('  Define the property in src/tokens/, give the read a fallback, or fix the name.')
    process.exit(1)
  }
  console.log(`✓ css-vars guard holds — ${cssFiles.length} stylesheets and ${captures.length} captures read only defined properties.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
