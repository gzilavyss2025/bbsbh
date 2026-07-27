#!/usr/bin/env node
// Guards the CONTRAST invariant in two places.
//
// 1. The app's known text-on-background TOKEN pairings meet WCAG 2.1 AA.
//    Several of these ratios were only ever asserted in a passing comment next
//    to the token (e.g. --seal-ink "dark enough to hold WCAG AA against BOTH
//    kraft stripes of --seal-texture"). A later nudge to a paper or ink hex
//    could quietly drop one below the line with nothing to catch it. This turns
//    those informal notes into a computed, enforced check.
//
// 2. Every per-club HEADER TRIAD in the hand-tuned stores: `onBar` must clear
//    AA against `bar`. Those triads dress a real surface now — the lineup
//    page's club-name bar and section mastheads (ADR-0030) — and unlike a token
//    they are authored by eye, one club at a time, in a lab whose preview can
//    look fine to the person who picked the two colors. This half of the check
//    is what makes the feature shippable rather than a lab curiosity: without
//    it a hand-tuned pair reaches production unreadable and nothing says so.
//
// Thresholds (WCAG 2.1 AA): normal text ≥ 4.5:1, large text / non-text UI ≥ 3:1.
//
// Resolves each token to a hex by following var() chains through tokens/*.css,
// so the check reads the SAME values the app ships. Run by `npm run lint`. Zero
// deps. If you intentionally retune a color, update the hex until this passes —
// don't loosen a threshold.

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import MLB_TREATMENT_TUNING from '../src/lib/data/mlb-treatment-tuning.json' with { type: 'json' }
import MILB_TREATMENT_TUNING from '../src/lib/data/milb-treatment-tuning.json' with { type: 'json' }

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
  // The slate result card's scenario pills (GameResultFace.jsx's
  // SCENARIO_STYLE) — each filled solid in its own accent, so the fg/bg pair
  // (and which text color a given accent needs) is asserted here rather than
  // left to eyeball: field/clay/allstar-blue are dark/saturated enough for
  // light on-ink text, but marker (Close Game) is a bright highlighter
  // yellow — reversed, dark heading-ink text is what holds AA against IT.
  { fg: 'text-on-ink', bg: 'field', min: TEXT, note: 'Dominant Performance pill text' },
  { fg: 'text-on-ink', bg: 'clay', min: TEXT, note: 'Blowout pill text' },
  { fg: 'text-heading', bg: 'marker', min: TEXT, note: 'Close Game pill text' },
  { fg: 'text-on-ink', bg: 'allstar-blue', min: TEXT, note: 'Extra Innings pill text' },
  // The crown outranks all four and carries its own medal-amber fill, both on
  // the card pill (.flipback__pill--crown) and on the filter chip that selects
  // it (FILTER_CHIPS, src/lib/resultCards.js) — same pairing, asserted once.
  { fg: 'text-on-ink', bg: 'award-ink', min: TEXT, note: 'Game of the Night crown pill text' },
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

// ---- Every per-club header triad in the hand-tuned stores ----
// A club's bar is whatever hex someone landed for it, so the check reads the
// STORES rather than a token table. Only `onBar` vs `bar` is asserted: those
// two are the text-on-background pair. `accent` is the bar's 3px kraft-tape
// bottom edge — a decorative rule against the page, not against the bar, and
// holding it to a ratio against the bar would forbid the tone-on-tone edges
// several clubs' own liveries actually use.
//
// A tile's club MARK is a separate readability problem with a separate answer:
// the mono knockout art is a flat single-ink silhouette, so a themed masthead
// re-inks it to match `onBar` rather than constraining which bars may exist
// (see .metricbar--themed-dark in index.css / ADR-0030).
const headerFailures = []
const headerRows = []
let headerCount = 0
for (const [label, store] of [['MLB', MLB_TREATMENT_TUNING], ['MiLB', MILB_TREATMENT_TUNING]]) {
  for (const [teamId, entry] of Object.entries(store)) {
    for (const [treatment, record] of Object.entries(entry.treatments ?? {})) {
      const header = record.header
      if (!header) continue
      headerCount += 1
      const { bar, onBar } = header
      if (!bar || !onBar) {
        headerFailures.push(`${label} ${teamId} ${treatment}: header is missing bar/onBar`)
        continue
      }
      const r = ratio(onBar, bar)
      if (r >= TEXT) continue
      headerFailures.push(
        `${label} ${teamId} ${entry.name ?? ''} [${treatment}] — ${r.toFixed(2)}:1 ` +
          `(onBar ${onBar} on bar ${bar})`,
      )
      headerRows.push(`  ✗ ${r.toFixed(2).padStart(5)}:1 (need ${TEXT}:1)  ${label} ${teamId} ${entry.name ?? ''} [${treatment}]`)
    }
  }
}

const allFailures = [...failures, ...headerFailures]
console.log(
  allFailures.length
    ? '\n✗ CONTRAST invariant violated:\n'
    : '✓ CONTRAST invariant holds — all known token pairings meet WCAG AA.',
)
for (const row of rows) console.log(row)
for (const row of headerRows) console.log(row)
if (!headerFailures.length) {
  console.log(`  ✓ ${headerCount} club header triads — every onBar clears ${TEXT}:1 against its bar.`)
}
if (allFailures.length) {
  console.error('\nRetune the offending color until it clears the threshold — do not lower the threshold.')
  if (headerFailures.length) {
    console.error(
      'A club header triad lives in src/lib/data/{mlb,milb}-treatment-tuning.json — pick a readable\n' +
        '`onBar` (or a darker `bar`) in the Team Identity Lab, which shows this same ratio live.',
    )
  }
  process.exit(1)
}
