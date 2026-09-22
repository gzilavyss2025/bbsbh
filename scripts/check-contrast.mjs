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

import { readFileSync, readdirSync, statSync } from 'node:fs'
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


// The thresholds and the enforced pairings are DATA, and they live in
// src/lib/design/contrastPairings.js so that this guard and /design-lab read
// one list instead of two that drift. This file keeps the enforcement: it
// resolves each token to a hex against the shipped tokens/*.css and fails the
// build on a miss. Add or retune a pairing THERE.
import { TEXT, UI, PAIRINGS, ratio } from '../src/lib/design/contrastPairings.js'


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


// ---- 3. RATIO CLAIMS WRITTEN IN PROSE ------------------------------------
// Halves 1 and 2 assert that a pairing clears its THRESHOLD. Neither looks at
// the ratio numbers this repo writes in its COMMENTS, and those numbers are
// load-bearing. A token comment saying a pair measures 13.5:1 is the only
// record a later reader has; nobody re-derives it, they trust it and tune
// against it. ADR-0083 makes the case for its sibling guard in exactly these
// terms — a comment that lies about a colour is how the colour drifted in the
// first place. A comment that lies about a RATIO is the same failure with a
// number attached, and it is harder to catch because it looks measured. Four
// wrong ones were found by hand while reviewing that ADR's own PR — and the
// fourth, --accent-link's "5.14:1 at worst", had been sitting in colors.css
// since 2026-08-19, cited and trusted, with every threshold check passing.
//
// THE FORM: `10.5:1 (--text-heading on --marker)`. Naming the pair is what
// turns an unverifiable assertion into a checkable one.
//
// Two halves, deliberately asymmetric:
//
//   A. ANYWHERE that form appears under the scanned roots, the pair is
//      resolved against the shipped tokens and the number asserted. Opt-in, so
//      it costs an existing comment nothing until someone chooses precision.
//   B. Under src/tokens/, the annotation is REQUIRED for a measurement. That
//      tier is where a number is normative rather than descriptive: it is the
//      definition every other comment cites. A THRESHOLD is not a measurement
//      — ">= 4.5:1", "at least 3:1" state a rule, not a reading — so a claim
//      introduced that way is exempt.
//
// Rounding is compared at the precision written: `5.4:1` must round to 5.4,
// `5.41:1` to 5.41. Write the number you mean.

const ANNOTATED = /(\d+(?:\.\d+)?):1\s*\(\s*(--[\w-]+)\s+on\s+(--[\w-]+)\s*\)/g
const ANY_RATIO = /(>=|≥|at least\s+)?\s*(\d+(?:\.\d+)?):1/g

// Comment text only, so a declaration can never read as a claim. For JS the
// `//` split also catches a `https://` inside a string literal; harmless here,
// since a URL carries no `N:1`.
function commentText(src, isJs) {
  const blocks = src.match(/\/\*[\s\S]*?\*\//g) ?? []
  if (!isJs) return blocks.join('\n')
  const lineComments = src.split('\n').map((line) => {
    const i = line.indexOf('//')
    return i === -1 ? '' : line.slice(i + 2)
  })
  return [...blocks, ...lineComments].join('\n')
}

function claimFiles(dir, ext, out = []) {
  for (const entry of readdirSync(resolve(dir))) {
    const full = `${dir}/${entry}`
    if (statSync(resolve(full)).isDirectory()) claimFiles(full, ext, out)
    else if (entry.endsWith(ext)) out.push(full)
  }
  return out
}

const claimFailures = []
const CLAIM_SCAN = [
  ...claimFiles('src/tokens', '.css'),
  ...claimFiles('src/styles', '.css'),
  ...claimFiles('src/lib/design', '.js'),
]

let claimsChecked = 0
for (const file of CLAIM_SCAN) {
  const text = commentText(readFileSync(resolve(file), 'utf8'), file.endsWith('.js'))

  // --- A: every annotated claim must be true ---
  const annotated = []
  for (const m of text.matchAll(ANNOTATED)) {
    annotated.push([m.index, m.index + m[0].length])
    const [, claim, fg, bg] = m
    let r
    try {
      r = ratio(resolveColor(fg), resolveColor(bg))
    } catch (err) {
      claimFailures.push(`${file} — \`${m[0]}\` names a color this check cannot resolve: ${err.message}`)
      continue
    }
    claimsChecked += 1
    const actual = r.toFixed((claim.split('.')[1] ?? '').length)
    if (actual !== claim) {
      claimFailures.push(
        `${file} — \`${m[0]}\` claims ${claim}:1, but ${fg} on ${bg} measures ` +
          `${r.toFixed(2)}:1. Write ${actual}:1, or name the pair you actually meant.`,
      )
    }
  }

  // --- B: under src/tokens/, a measurement must name its pair ---
  if (!file.startsWith('src/tokens/')) continue
  for (const m of text.matchAll(ANY_RATIO)) {
    if (m[1]) continue
    const at = m.index + m[0].indexOf(m[2])
    if (annotated.some(([a, b]) => at >= a && at < b)) continue
    claimFailures.push(
      `${file} — \`${m[2]}:1\` is a measured ratio with no pair named. Write it as ` +
        `\`${m[2]}:1 (--fg on --bg)\` so this guard can check it, or write ">=" if ` +
        'it is a threshold rather than a reading.',
    )
  }
}

const allFailures = [...failures, ...headerFailures, ...claimFailures]
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
if (claimFailures.length) {
  console.log('')
  for (const row of claimFailures) console.log(`  ✗ ${row}`)
} else {
  console.log(`  ✓ ${claimsChecked} ratio claims written in comments — every one matches its pair.`)
}
if (allFailures.length) {
  if (failures.length || headerFailures.length) {
    console.error('\nRetune the offending color until it clears the threshold — do not lower the threshold.')
  }
  if (claimFailures.length) {
    console.error(
      '\nA ratio written in a comment is the only record a later reader has of what a pair\n' +
        'measures, and it is trusted and tuned against. Correct the NUMBER — do not delete\n' +
        'the claim to silence this.',
    )
  }
  if (headerFailures.length) {
    console.error(
      'A club header triad lives in src/lib/data/{mlb,milb}-treatment-tuning.json — pick a readable\n' +
        '`onBar` (or a darker `bar`) in the Team Identity Lab, which shows this same ratio live.',
    )
  }
  process.exit(1)
}
