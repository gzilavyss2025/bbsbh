#!/usr/bin/env node
// A raw z-index above 3, or a layer offset that leaves its tier, is rejected
// (#1179, #1831).
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
// `calc(var(--z-x) + N)` is the way to add a second surface to a tier, and N is
// limited to 20, and the result must stay between the tier below and the tier above. A
// calc of bare numbers, a custom property that is not a --z- token, and a quoted
// or assigned number in JS (`zIndex: '9999'`, `el.style.zIndex = 50`) are read by
// the same rule.
//
// Scans src/ (CSS, and JS/JSX for an inline `zIndex`). Run by `npm run lint`.

import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, walk } from '../lib/walk.mjs'
import { maskComments } from './mask-comments.mjs'

const MAX_RAW = 3
const EXEMPT = /z-index-exempt\s*:\s*\S/
const CSS_RE = /z-index\s*:\s*([^;}]+)/g
// `zIndex: v` in an object and `el.style.zIndex = v`; `===` and `==` are not writes.
const JS_RE = /\bzIndex\s*(?::|=(?!=))\s*([^,;}\n]+)/g
// Keywords, and the empty string, undefined and null that clear an inline style.
const KEYWORD = /^(?:auto|inherit|initial|unset|revert|revert-layer|undefined|null|)$/
const TOKEN = /^var\(\s*--z-([a-z]+)\s*\)$/
const OFFSET = /^calc\(\s*var\(\s*--z-([a-z]+)\s*\)\s*([+-])\s*(\d+)\s*\)$/

// The tiers come from src/tokens/layout.css, the one place that names them.
const LAYOUT = readFileSync(new URL('../../src/tokens/layout.css', import.meta.url), 'utf8')
const TIERS = Object.fromEntries(
  [...LAYOUT.matchAll(/--z-([a-z]+):\s*(\d+);/g)].map((m) => [m[1], Number(m[2])]),
)
if (!Object.keys(TIERS).length) throw new Error('check-z-index: no --z-* tiers found in src/tokens/layout.css')
const LEVELS = Object.values(TIERS).sort((a, b) => a - b)
const MAX_OFFSET = 20 // the largest offset the table in layout.css lists

// An offset must stay in its tier's own band: above the tier below it (or MAX_RAW),
// below the tier above it. calc(var(--z-modal) + 500) would pass the toast tier.
const band = (base) => {
  const i = LEVELS.indexOf(base)
  return [LEVELS[i - 1] ?? MAX_RAW, LEVELS[i + 1] ?? Infinity]
}

// null when the value is fine, else why it is not.
const clean = (raw) => raw.replace(/!\s*important\s*$/i, '').trim().replace(/^(['"`])(.*)\1$/, '$2').trim()

function judge(v) {
  if (KEYWORD.test(v)) return null
  if (/^-?\d+$/.test(v)) return Number(v) <= MAX_RAW ? null : 'a raw number'
  const tier = v.match(TOKEN)
  if (tier) return tier[1] in TIERS ? null : 'an unknown layer token'
  const off = v.match(OFFSET)
  if (off) {
    if (!(off[1] in TIERS)) return 'an unknown layer token'
    if (Number(off[3]) > MAX_OFFSET) return `an offset above ${MAX_OFFSET}`
    const at = TIERS[off[1]] + (off[2] === '-' ? -1 : 1) * Number(off[3])
    const [low, high] = band(TIERS[off[1]])
    return at > low && at < high ? null : `an offset outside the --z-${off[1]} band (${low}..${high})`
  }
  return 'not a layer token, a banded offset or a number'
}

export function findRawZIndex(src, kind = 'css') {
  const rawLines = src.split('\n')
  const masked = maskComments(src, kind)
  const found = []
  for (const m of masked.matchAll(kind === 'css' ? CSS_RE : JS_RE)) {
    const value = clean(m[1])
    const why = judge(value)
    if (!why) continue
    const line = masked.slice(0, m.index).split('\n').length
    if (EXEMPT.test(rawLines[line - 1]) || EXEMPT.test(rawLines[line - 2] ?? '')) continue
    found.push({ line, why, value })
  }
  return found
}

function main() {
  const files = walk(`${ROOT}/src`, { exts: ['.css', '.js', '.jsx'] })
  const problems = []
  for (const file of files) {
    const kind = file.endsWith('.css') ? 'css' : 'js'
    for (const { line, value, why } of findRawZIndex(readFileSync(file, 'utf8'), kind)) {
      problems.push(`${relative(ROOT, file)}:${line}: z-index ${value}: ${why}`)
    }
  }
  if (problems.length) {
    console.error(`✗ z-index guard: ${problems.length} bad value(s).`)
    for (const p of problems) console.error(`  ${p}`)
    console.error('  Read a layer token (var(--z-raised|sticky|overlay|modal|toast)), or add a')
    console.error('  `z-index-exempt: <reason>` comment. The table is in src/tokens/layout.css.')
    process.exit(1)
  }
  console.log(`✓ z-index guard holds — ${files.length} files checked, none above ${MAX_RAW} without a token.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
