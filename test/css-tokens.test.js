// Every `var(--token)` in the stylesheets resolves to a token that exists.
//
// THE BUG THIS EXISTS TO CLOSE. `26c-mound-card.css` and `26d-command-map.css`
// shipped using `--sp-3`, `--r-xs` and `--w-semi`. The scale is `--space-3`,
// `--radius-xs` and `--w-semibold`; the three shorthand names were never
// defined anywhere. CSS drops a declaration whose var() does not resolve and
// says nothing, so the mound card's gaps, paddings and 3px corner radii simply
// never rendered — for two shipped surfaces, invisibly, with lint green.
//
// A typo in a token name is not a rare mistake to make: the scale has four
// families and several plausible abbreviations of each. Nothing else in the
// toolchain checks it — the guards cover contrast, casing, typography and file
// size, all of which passed the whole time.
//
// Scope: `src/tokens/` plus `src/index.css` and `src/styles/**` define the
// vocabulary; component-imported partials use it. A var() with a FALLBACK
// (`var(--bar-fill, transparent)`) is deliberately allowed to name a token that
// no stylesheet defines — those are set inline from JS (the club header triads,
// ADR-0030), and the fallback is what makes that safe.
//
// A RATCHET, not a clean sweep. What is left on the list is one kind only:
// properties genuinely set from JS at runtime that carry no fallback. Those are
// correct as they stand — they are listed so the check has something to compare
// against, not because they need work.
//
// The typo class the scan first turned up is GONE. Six declarations across five
// partials named tokens that do not exist and had therefore never rendered, and
// each was fixed to the value its own file's evidence pointed at rather than
// guessed: --bw-thin to --bw-hair (three rules away in the same file, doing the
// identical job), --fs-micro to --fs-caption (the smallest size the scale
// defines, on captions already inked --text-caption), --fs-section to --fs-h3
// (.section__title--bar's tier, a step above the --fs-label eyebrows beside it),
// --dur-base to --dur-med (the middle tier; --dur-fast is the tap-feedback one),
// and --space-7/--space-9 to --space-6/--space-8 (the scale has no 7 or 9; the
// page keeps its bottom padding larger than its top).
//
// The list may only ever SHRINK. New code adds nothing to it, and the stale
// check below is what stops it rotting into a permanent exemption.
const KNOWN_UNDEFINED = new Set([
  // --- set inline from JS at runtime; no fallback, but never unresolved ---
  '--team-color', // 20-charts.css — the club's own ink, set per chart
  '--team-text',
  '--chip-accent', // 22-box-score-tables.css — per-club chips and pills
  '--chip-text',
  '--card-accent',
  '--pill-accent',
  '--pill-text',
  '--start', // 26a-percentile-strip.css — the band's geometry, per player
  '--width',
  '--pct',
  '--level-count', // 05-masthead-nav.css — how many levels the bar draws
  '--rankstrip-track-width', // 28-team-hub.css
])
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath, not `.pathname` — a URL path is percent-encoded, so a checkout
// under a directory with a space in it reads back as `%20` and every readFileSync
// below misses. It also handles the leading-slash-before-a-drive-letter shape on
// Windows without a hand-rolled regex. Same call the contracts tests make.
const ROOT = fileURLToPath(new URL('..', import.meta.url))

function cssFilesUnder(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) cssFilesUnder(full, out)
    else if (entry.endsWith('.css')) out.push(full)
  }
  return out
}

const files = [
  ...cssFilesUnder(join(ROOT, 'src', 'tokens')),
  ...cssFilesUnder(join(ROOT, 'src', 'styles')),
  join(ROOT, 'src', 'index.css'),
]

// Strip comments first so prose ("see --sp-3 below") is never read as code.
const sources = new Map(
  files.map((f) => [f, readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')]),
)

// Everything DEFINED anywhere in the sheets, at any nesting — a token defined
// inside a media query or a `[data-theme]` block counts.
const defined = new Set()
for (const css of sources.values()) {
  for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1])
}

test('the token vocabulary is not empty (the scan actually found the sheets)', () => {
  assert.ok(files.length > 50, `expected the stylesheet tree, found ${files.length} files`)
  assert.ok(defined.has('--space-3'), 'the spacing scale should be in the vocabulary')
  assert.ok(defined.has('--radius-xs'), 'the radius scale should be in the vocabulary')
})

test('every var(--token) without a fallback names a token that exists', () => {
  const missing = []
  for (const [file, css] of sources) {
    // `var(--name` up to the next comma or close paren — the comma is what
    // tells a bare reference from one carrying a fallback.
    for (const m of css.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
      const [, name, next] = m
      if (next === ',') continue // has a fallback; may be set from JS
      if (defined.has(name)) continue
      if (KNOWN_UNDEFINED.has(name)) continue
      const line = css.slice(0, m.index).split('\n').length
      missing.push(`${relative(ROOT, file)}:${line}  ${name}`)
    }
  }
  assert.deepEqual(
    missing,
    [],
    `these var() references resolve to nothing, so CSS drops the whole declaration:\n  ${missing.join('\n  ')}`,
  )
})

// The ratchet's other half: an entry that no longer appears is an entry to
// delete, so the list cannot rot into a permanent exemption after someone
// fixes one of these for real.
test('the known-undefined list carries no stale entries', () => {
  const referenced = new Set()
  for (const css of sources.values()) {
    for (const m of css.matchAll(/var\(\s*(--[\w-]+)\s*[,)]/g)) referenced.add(m[1])
  }
  const stale = [...KNOWN_UNDEFINED].filter((t) => !referenced.has(t) || defined.has(t))
  assert.deepEqual(
    stale,
    [],
    `these are pinned but no longer need to be — drop them from KNOWN_UNDEFINED:\n  ${stale.join('\n  ')}`,
  )
})
