#!/usr/bin/env node
// Guards the CONTRAST invariant: the app's known text-on-background token
// pairings meet WCAG 2.1 AA. Several of these ratios were only ever asserted in
// a passing comment next to the token (e.g. --seal-ink "dark enough to hold
// WCAG AA against BOTH kraft stripes of --seal-texture"). A later nudge to a
// paper or ink hex could quietly drop one below the line with nothing to catch
// it. This turns those informal notes into a computed, enforced check.
//
// Thresholds (WCAG 2.1 AA): normal text ≥ 4.5:1, large text / non-text UI ≥ 3:1.
//
// Resolves each token to a hex by following var() chains through tokens/*.css,
// so the check reads the SAME values the app ships. Run by `npm run lint`. Zero
// deps. If you intentionally retune a color, update the hex until this passes —
// don't loosen a threshold.

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// ---- Load every custom property defined under src/tokens/ ----
const tokensDir = resolve('src/tokens')
const tokens = new Map()
for (const file of readdirSync(tokensDir)) {
  if (!file.endsWith('.css')) continue
  const css = readFileSync(resolve(tokensDir, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // drop comments so prose isn't parsed
  for (const m of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    if (!tokens.has(m[1])) tokens.set(m[1], m[2].trim())
  }
}

// ---- Resolve a token (or literal hex) to a #rrggbb string ----
function resolveColor(ref, seen = new Set()) {
  if (ref.startsWith('#')) return ref
  const varMatch = ref.match(/^var\(\s*--([\w-]+)\s*(?:,[^)]*)?\)$/)
  const name = varMatch ? varMatch[1] : ref.replace(/^--/, '')
  if (seen.has(name)) throw new Error(`token cycle at --${name}`)
  seen.add(name)
  if (!tokens.has(name)) throw new Error(`unknown color token --${name}`)
  const value = tokens.get(name)
  if (value.startsWith('#') || value.startsWith('var(')) return resolveColor(value, seen)
  throw new Error(`--${name} is not a solid color (got "${value}")`)
}

function toRgb(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length > 6) h = h.slice(0, 6) // ignore any alpha byte
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// WCAG relative luminance + contrast ratio.
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function ratio(fg, bg) {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const TEXT = 4.5 // normal-size body text
const UI = 3.0 // large text / non-text UI affordance

// The enforced pairings. `fg`/`bg` are token names or literal hex.
const PAIRINGS = [
  // Kraft seal cover: the sealed-cover ink over BOTH stripes of --seal-texture.
  { fg: 'seal-ink', bg: 'seal', min: TEXT, note: 'seal ink on kraft base stripe' },
  { fg: 'seal-ink', bg: 'seal-hatch', min: TEXT, note: 'seal ink on kraft hatch stripe' },
  // Injured-list tape: white banner text over BOTH stripes of --il-texture.
  { fg: '#FFFFFF', bg: 'clay', min: TEXT, note: 'white on IL clay base stripe' },
  { fg: '#FFFFFF', bg: 'clay-deep', min: TEXT, note: 'white on IL clay hatch stripe' },
  // Core semantic text roles on their intended surfaces.
  { fg: 'text-body', bg: 'bg-canvas', min: TEXT, note: 'body text on app canvas' },
  { fg: 'text-heading', bg: 'surface-card', min: TEXT, note: 'heading on raised card' },
  { fg: 'text-muted', bg: 'surface-card', min: TEXT, note: 'muted text on raised card' },
  { fg: 'text-caption', bg: 'bg-page', min: TEXT, note: 'caption/graphite on page' },
  { fg: 'text-on-ink', bg: 'accent-primary', min: TEXT, note: 'inverse text on ink chip' },
  // Non-text UI: the focus ring must stay visible against the canvas.
  { fg: 'focus-ring', bg: 'bg-canvas', min: UI, note: 'focus ring on app canvas' },
]

const failures = []
const rows = []
for (const p of PAIRINGS) {
  const fgHex = resolveColor(p.fg)
  const bgHex = resolveColor(p.bg)
  const r = ratio(fgHex, bgHex)
  const pass = r >= p.min
  rows.push(
    `  ${pass ? '✓' : '✗'} ${r.toFixed(2).padStart(5)}:1 (need ${p.min}:1)  ${p.note}` +
      `  [${p.fg} on ${p.bg}]`,
  )
  if (!pass) failures.push(p.note)
}

console.log(failures.length ? '\n✗ CONTRAST invariant violated:\n' : '✓ CONTRAST invariant holds — all known token pairings meet WCAG AA.')
for (const row of rows) console.log(row)
if (failures.length) {
  console.error('\nRetune the offending color token until it clears the threshold — do not lower the threshold.')
  process.exit(1)
}
