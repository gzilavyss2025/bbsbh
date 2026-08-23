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
  // Last 10 Games win stamp: knockout text/W-L letter over BOTH stripes of
  // --win-texture. The loss stamp reuses --il-texture, already asserted above.
  { fg: 'text-on-ink', bg: 'field', min: TEXT, note: 'knockout text on win stamp base stripe' },
  { fg: 'text-on-ink', bg: 'field-deep', min: TEXT, note: 'knockout text on win stamp hatch stripe' },
  // Last 10 Games home-game stub: seal-ink over the composite color
  // `color-mix(in srgb, var(--seal) 80%, transparent)` renders as against
  // --surface-card (the literal hex is that composite, precomputed by hand
  // since this checker doesn't parse color-mix()).
  { fg: 'seal-ink', bg: '#C3996A', min: TEXT, note: 'seal ink on Last 10 Games home-game stub' },
  // The three Game Log book boards a league-mark cover prints on, each carrying
  // the same paper foil (PassportCover.jsx stamps every line on the board in
  // --cover-foil). Held to the FULL 4.5:1 text bar rather than the 3:1 large-text
  // one the cover's own type would allow, because a board colour is picked once
  // and then worn by whatever the cover grows next.
  { fg: 'book-board-foil', bg: 'book-board-kraft', min: TEXT, note: 'book cover foil on the kraft board' },
  { fg: 'book-board-foil', bg: 'book-board-red', min: TEXT, note: 'book cover foil on the red board' },
  { fg: 'book-board-foil', bg: 'book-board-blue', min: TEXT, note: 'book cover foil on the blue board' },
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
  // Stamp In's row action, in both states (ADR-0042): a soft neutral until you
  // press it, field green once you hold that stamp. The green pair is the same
  // one the win stamp already asserts above; the neutral pair is asserted here
  // rather than assumed, because --surface-inset is the lightest paper in the
  // system and a later nudge to either token is exactly the kind of change
  // nothing else would catch.
  { fg: 'text-body', bg: 'surface-inset', min: TEXT, note: 'Stamp In row action, unpressed' },
  { fg: 'text-on-ink', bg: 'accent-positive', min: TEXT, note: 'Stamp In row action, stamped' },
  // The slate's Scores Unlocked live band: run totals (heading ink) and the
  // centered state token (muted ink) over the field-green wash.
  { fg: 'text-heading', bg: 'field-soft', min: TEXT, note: 'live score band numerals' },
  { fg: 'text-muted', bg: 'field-soft', min: TEXT, note: 'live score band state token' },
  // The band's hover mow stripe: `color-mix(in srgb, var(--field) 10%,
  // transparent)` over --field-soft — precomputed by hand like the Last 10
  // Games stub above, since this checker doesn't parse color-mix().
  { fg: 'text-heading', bg: '#D1E0D3', min: TEXT, note: 'live band numerals on hover mow stripe' },
  { fg: 'text-muted', bg: '#D1E0D3', min: TEXT, note: 'live band state token on hover mow stripe' },
  // Link / text-button ink, on each of the three grounds it lands on: the app
  // canvas, a page, and a raised card. Held to the full text bar because these
  // run SMALL — "See all ›" and the "more" affordance are --fs-caption caps.
  { fg: 'accent-link', bg: 'bg-canvas', min: TEXT, note: 'link text on app canvas' },
  { fg: 'accent-link', bg: 'bg-page', min: TEXT, note: 'link text on page' },
  { fg: 'accent-link', bg: 'surface-card', min: TEXT, note: 'link text on raised card' },
  // Non-text UI: the focus ring must stay visible against the canvas.
  { fg: 'focus-ring', bg: 'bg-canvas', min: UI, note: 'focus ring on app canvas' },
  // ---- The season spray map (73-spray-map.css) ----
  // Everything below was found by a design review, not by this file, and that
  // is the reason it is here now: all three defects were ALPHAS applied on top
  // of a token, and an alpha is precisely what this checker cannot see. Each
  // composite is precomputed by hand, the same way the color-mix() pairs above
  // are, and named so a retune of the underlying token fails here first.
  //
  // The direction bar's three segments, on the card they sit on. One ink at
  // three alphas put the lightest at 2.44:1; these are three real tokens.
  // --graphite-soft is the thinnest margin in this group at 3.06:1 — it is a
  // LINE token, fine as a chart region at the 3:1 bar and NOT fine as small
  // text, which is the distinction that put it here rather than in a color rule.
  { fg: 'navy', bg: 'surface-card', min: UI, note: 'spray direction bar, pull segment' },
  { fg: 'graphite', bg: 'surface-card', min: UI, note: 'spray direction bar, center segment' },
  { fg: 'graphite-soft', bg: 'surface-card', min: UI, note: 'spray direction bar, oppo segment' },
  // Adjacent segments are only 1.6-2.5:1 against each other — unavoidable in a
  // monotone ramp — so a paper hairline carries every boundary instead.
  { fg: 'surface-inset', bg: 'navy', min: UI, note: 'spray direction bar hairline, against pull' },
  { fg: 'surface-inset', bg: 'graphite', min: UI, note: 'spray direction bar hairline, against center' },
  { fg: 'surface-inset', bg: 'graphite-soft', min: UI, note: 'spray direction bar hairline, against oppo' },
  // The chip count on a THIN (grayed) split chip. It carried opacity .85 on top
  // of --text-caption and composited to 3.86:1; at full strength it is 5.31:1.
  // Held to the text bar, not the UI one — it is an 11px figure.
  { fg: 'text-caption', bg: 'surface-card', min: TEXT, note: 'spray thin-chip split count' },
  // The home-run diamond over the heat layer. The heat is a BLURRED field, so it
  // renders every luminance between its palest and darkest band, and medal amber
  // cannot hold 3:1 across all of that from one side. Three pairings pin the two
  // ends and the ring that spans the middle. The two fills are the ramp's
  // extremes composited over --surface-card by hand: --award-line at .22 and
  // --clay-deep at .70 (73-spray-map.css's .spray__cell--1 / --5).
  { fg: 'award-ink', bg: '#F0E2C3', min: UI, note: 'spray HR diamond on the palest heat' },
  { fg: 'surface-inset', bg: '#AF6E64', min: UI, note: 'spray HR diamond ring on the hottest heat' },
  // The load-bearing one: the ring is an opaque paper band, so it — not the
  // heat — is the diamond's adjacent colour wherever the mark lands.
  { fg: 'award-ink', bg: 'surface-inset', min: UI, note: 'spray HR diamond against its own paper ring' },
  // A navy dot needs no ring; it clears the hottest fill on its own.
  { fg: 'navy', bg: '#AF6E64', min: UI, note: 'spray hit dot on the hottest heat' },
  // Trade Deadline's cash-consideration icon frame — the positive/acquired
  // green tint (TradeCard.jsx's ConsiderationRow, tone="cash").
  { fg: 'field-deep', bg: 'field-soft', min: TEXT, note: 'Trade Deadline cash consideration icon' },
  // The broadcast report package (styles/68-around-the-game.css). Its
  // masthead is the one surface in the app that sets text on the seam red
  // rather than on paper or on ink, and the strand chip's knockout is the pair
  // that has to hold — 5.05:1, which is real but is the thinnest margin in
  // this table, so a future nudge to --clay must be re-checked here first.
  { fg: 'paper-2', bg: 'clay', min: TEXT, note: 'report masthead strand chip' },
  { fg: 'paper-3', bg: 'navy', min: TEXT, note: 'report masthead title on the ink slab' },

  // The player page's Pitches card — an ink slab (tokens/colors.css's --heat-*).
  // Every ink that carries TEXT on it is here: the pitch names, the four family
  // labels, and the per-pitch share figures, which are inked to match their own
  // bar rather than the body ink.
  { fg: 'heat-ink', bg: 'heat-slab', min: TEXT, note: 'pitch name / velocity on the heat slab' },
  { fg: 'heat-fastball', bg: 'heat-slab', min: TEXT, note: 'fastball family label + share on the heat slab' },
  { fg: 'heat-breaking', bg: 'heat-slab', min: TEXT, note: 'breaking family label + share on the heat slab' },
  { fg: 'heat-offspeed', bg: 'heat-slab', min: TEXT, note: 'offspeed family label + share on the heat slab' },
  { fg: 'heat-other', bg: 'heat-slab', min: TEXT, note: 'other family label + share on the heat slab' },
  { fg: 'heat-band-ink', bg: 'heat-band', min: TEXT, note: '100 mph band figures on the band' },
  { fg: 'clay-deep', bg: 'surface-card', min: TEXT, note: 'rundown card eyebrow' },
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
