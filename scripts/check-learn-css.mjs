// Guards public/learn.css against palette drift.
//
// WHY IT EXISTS. The guides at /learn are standalone documents served by
// api/page.js — no bundle, no #root, no way to @import a token sheet that Vite
// resolves. So learn.css redeclares the handful of colours it needs, copied from
// src/tokens/colors.css. A copy drifts. This makes the drift a build failure
// instead of a page that slowly stops looking like the app.
//
// It checks ONLY the colour values, and only the ones learn.css actually
// declares. It is not a general CSS linter, and it deliberately does not require
// learn.css to carry every token — most of them are for surfaces these pages do
// not have.

import { readFileSync } from 'node:fs'

const source = readFileSync('src/tokens/colors.css', 'utf8')
const copy = readFileSync('public/learn.css', 'utf8')

// `--name: value;` where the value is a literal, not a var() alias. The
// semantic layer in colors.css (--text-body: var(--ink-1)) is intentionally not
// mirrored into learn.css, so aliases are skipped on both sides.
const DECL = /--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})\s*;/g

function palette(css) {
  const out = new Map()
  for (const [, name, value] of css.matchAll(DECL)) {
    if (!out.has(name)) out.set(name, value.toUpperCase())
  }
  return out
}

const truth = palette(source)
const mirror = palette(copy)
const problems = []

for (const [name, value] of mirror) {
  if (!truth.has(name)) {
    problems.push(`--${name} is declared in public/learn.css but not in src/tokens/colors.css.`)
    continue
  }
  if (truth.get(name) !== value) {
    problems.push(
      `--${name} is ${value} in public/learn.css but ${truth.get(name)} in src/tokens/colors.css.`,
    )
  }
}

if (problems.length) {
  console.error('\n✗ public/learn.css has drifted from the design tokens.')
  console.error('  The guides at /learn copy these values because they are served')
  console.error('  outside the bundle (see the header of public/learn.css).\n')
  for (const problem of problems) console.error(`  ${problem}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ public/learn.css matches src/tokens/colors.css — ${mirror.size} values checked.`)
