#!/usr/bin/env node
// Guards the FOCUS-RING invariant: every keyboard focus indicator draws from
// one of the two shared tokens, never a hand-rolled color.
//
//   - outline-style rings use  outline: <w> solid var(--focus-ring)  (the color
//     token in tokens/colors.css)
//   - inset box-shadow rings use  box-shadow: var(--ring)  (the full shadow
//     token in tokens/effects.css)
//
// A `:focus-visible` rule may also indicate focus WITHOUT a ring — by reusing
// its own :hover treatment (a border-color/background/transform change). Those
// rules carry no `outline`/`box-shadow` and are left alone. What this check
// stops is the third path: a bespoke `outline: 2px solid var(--accent-primary)`
// or `box-shadow: 0 0 0 3px rgba(...)` that drifts from the two tokens, so the
// focus ring looks different depending on which control you tab to.
//
// A deliberate one-off must be marked with a `focus-ring-exempt` comment on the
// same line (mirrors the caps-exempt convention). Run by `npm run lint`. Zero
// deps, scans src/styles/*.css (where every component rule lives).

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

// Every component rule lives under src/styles/ — the partials src/index.css
// @imports in order. Read the DIRECTORY TREE rather than a fixed list so a new
// partial is covered the moment it exists, SUBDIRECTORIES INCLUDED: the flat
// directory sits at its own file ratchet (check-dir-size.mjs), so a partial
// that outgrows the file cap subdivides instead of splitting sideways
// (ADR-0038), and `focus/`, `scorecard/` and `motion/` are all real rules this
// guard would otherwise walk straight past.
const stylesDir = resolve('src/styles')
const listSheets = (dir, prefix) =>
  readdirSync(dir).flatMap((f) => {
    const abs = join(dir, f)
    if (statSync(abs).isDirectory()) return listSheets(abs, `${prefix}${f}/`)
    return f.endsWith('.css')
      ? [{ rel: `src/styles/${prefix}${f}`, raw: readFileSync(abs, 'utf8') }]
      : []
  })
const sheets = listSheets(stylesDir, '').sort((a, b) => a.rel.localeCompare(b.rel))

// Same hazard as check-typography.mjs: if the stylesheets move again, or a
// refactor empties them, every assertion below becomes a no-op while still
// printing ✓. Fail loudly instead of guarding nothing.
const totalRules = sheets.reduce(
  (n, s) => n + (s.raw.replace(/\/\*[\s\S]*?\*\//g, '').match(/\{/g) || []).length,
  0,
)
if (!sheets.length || totalRules === 0) {
  console.error(
    '\n✗ Focus-ring guard has nothing to check — src/styles/ holds no CSS rules\n' +
      '  (found ' + sheets.length + ' sheet(s), ' + totalRules + ' rule(s)). If the stylesheets\n' +
      '  moved, repoint this script IN THE SAME COMMIT as the move. Do not delete\n' +
      '  this assertion — a vacuous pass still prints ✓.\n'
  )
  process.exit(1)
}

const errors = []

// Innermost CSS rules: a selector list, then a body with no nested braces. This
// also correctly picks inner rules out of @media blocks (the outer `@media {`
// has braces in its body, so it never matches — only the leaf rule does).
const ruleRe = /([^{}]*)\{([^{}]*)\}/g
// The declarations that can paint a ring.
const declRe = /(outline(?:-color)?|box-shadow)\s*:\s*([^;]+);/g

for (const { rel, raw } of sheets) {
  // Blank out /* ... */ comments while preserving every newline (and each line's
  // length), so char offsets and line numbers stay exact.
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  const rawLines = raw.split('\n')
  const lineAt = (index) => css.slice(0, index).split('\n').length
  ruleRe.lastIndex = 0

  let rule
  while ((rule = ruleRe.exec(css))) {
  const [, selector, body] = rule
  if (!selector.includes(':focus-visible')) continue

  const bodyStart = rule.index + selector.length + 1 // '{' consumed
  declRe.lastIndex = 0
  let decl
  while ((decl = declRe.exec(body))) {
    const prop = decl[1]
    const value = decl[2].trim().replace(/\s*!important$/i, '')
    const line = lineAt(bodyStart + decl.index)
    if (/focus-ring-exempt/i.test(rawLines[line - 1] ?? '')) continue

    const ok =
      prop === 'box-shadow'
        ? /^var\(--ring\)$/.test(value)
        : value === 'none' ||
          value === 'transparent' ||
          value.includes('var(--focus-ring)')

    if (!ok) {
      const fix =
        prop === 'box-shadow'
          ? 'use box-shadow: var(--ring)'
          : 'use outline: <width> solid var(--focus-ring)'
      errors.push(
        `${rel}:${line}: ${prop}: ${value}; — ${fix} ` +
          '(or mark a deliberate one-off with a /* focus-ring-exempt */ comment)',
      )
    }
  }
  }
}

if (errors.length) {
  console.error(
    '\n✗ FOCUS-RING invariant violated — focus indicators must use the shared tokens.\n',
  )
  for (const error of errors) console.error(`  ${error}`)
  console.error('')
  process.exit(1)
}

console.log('✓ FOCUS-RING invariant holds — every focus ring uses var(--focus-ring)/var(--ring).')
