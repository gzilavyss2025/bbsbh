#!/usr/bin/env node
// A raw z-index above 3 is rejected (#1179).
//
// The layers have names: --z-raised, --z-sticky, --z-overlay, --z-modal and
// --z-toast, in src/tokens/layout.css, which also holds the table of who sits
// where. A bare `z-index: 20` is a number nobody can place against the other
// surfaces, and "the menu is behind the sticky header" is what that gave
// (e2e/inning-modal-stacking.spec.js is the regression it caused once).
//
// A local lift of -1 to 3 inside one component's own stacking context may stay a
// raw number: it never has to be compared with another surface. Anything above 3
// reads a token, or opts out with `z-index-exempt: <reason>` in a comment on the
// same line or the line above. The reason is required.
//
// Scans src/ (CSS, and JS/JSX for an inline `zIndex`). Run by `npm run lint`.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, walk } from '../lib/walk.mjs'

const MAX_RAW = 3
const EXEMPT = /z-index-exempt\s*:\s*\S/
const CSS_RE = /z-index\s*:\s*(-?\d+)\s*(?:[;}!]|$)/gm
const JS_RE = /\bzIndex\s*:\s*(-?\d+)\b/g

// Comments blanked, every newline kept, so a line number still points at the file.
const blank = (m) => m.replace(/[^\n]/g, ' ')
const mask = (src, kind) => {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, blank)
  return kind === 'css' ? noBlock : noBlock.replace(/(^|\s)\/\/.*$/gm, (m) => blank(m))
}

export function findRawZIndex(src, kind = 'css') {
  const rawLines = src.split('\n')
  const masked = mask(src, kind)
  const found = []
  for (const m of masked.matchAll(kind === 'css' ? CSS_RE : JS_RE)) {
    const value = Number(m[1])
    if (value <= MAX_RAW) continue
    const line = masked.slice(0, m.index).split('\n').length
    if (EXEMPT.test(rawLines[line - 1]) || EXEMPT.test(rawLines[line - 2] ?? '')) continue
    found.push({ line, value })
  }
  return found
}

function main() {
  const files = walk(`${ROOT}/src`, { exts: ['.css', '.js', '.jsx'] })
  const problems = []
  for (const file of files) {
    const kind = file.endsWith('.css') ? 'css' : 'js'
    for (const { line, value } of findRawZIndex(readFileSync(file, 'utf8'), kind)) {
      problems.push(`${relative(ROOT, file)}:${line}: raw z-index ${value}`)
    }
  }
  if (problems.length) {
    console.error(`✗ z-index guard: ${problems.length} raw value(s) above ${MAX_RAW}.`)
    for (const p of problems) console.error(`  ${p}`)
    console.error('  Read a layer token (var(--z-raised|sticky|overlay|modal|toast)), or add a')
    console.error('  `z-index-exempt: <reason>` comment. The table is in src/tokens/layout.css.')
    process.exit(1)
  }
  console.log(`✓ z-index guard holds — ${files.length} files checked, none above ${MAX_RAW} without a token.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
