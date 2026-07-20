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
// deps, scans src/index.css (where every component rule lives).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const cssPath = resolve('src/index.css')
const raw = readFileSync(cssPath, 'utf8')

// Blank out /* ... */ comments while preserving every newline (and each line's
// length), so char offsets and line numbers stay exact.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
const rawLines = raw.split('\n')
const lineAt = (index) => css.slice(0, index).split('\n').length

const errors = []

// Innermost CSS rules: a selector list, then a body with no nested braces. This
// also correctly picks inner rules out of @media blocks (the outer `@media {`
// has braces in its body, so it never matches — only the leaf rule does).
const ruleRe = /([^{}]*)\{([^{}]*)\}/g
// The declarations that can paint a ring.
const declRe = /(outline(?:-color)?|box-shadow)\s*:\s*([^;]+);/g

let rule
while ((rule = ruleRe.exec(css))) {
  const [, selector, body] = rule
  if (!selector.includes(':focus-visible')) continue

  const bodyStart = rule.index + selector.length + 1 // '{' consumed
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
        `src/index.css:${line}: ${prop}: ${value}; — ${fix} ` +
          '(or mark a deliberate one-off with a /* focus-ring-exempt */ comment)',
      )
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
