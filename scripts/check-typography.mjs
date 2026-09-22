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
      ? [{ rel: `src/styles/${prefix}${f}`, name: `${prefix}${f}`, css: readFileSync(abs, 'utf8') }]
      : []
  })
const sheets = listSheets(stylesDir, '').sort((a, b) => a.rel.localeCompare(b.rel))
const errors = []

// This guard is only as good as its target. If the partials move again — or a
// refactor empties them — this script would keep exiting 0 while checking
// nothing, and a guard that stops guarding is worse than none, because the ✓
// still prints and reads as coverage. So assert there is real CSS to scan.
const totalRules = sheets.reduce(
  (n, s) => n + (s.css.replace(/\/\*[\s\S]*?\*\//g, '').match(/\{/g) || []).length,
  0,
)
if (!sheets.length || totalRules === 0) {
  console.error(
    '\n✗ Typography guard has nothing to check — src/styles/ holds no CSS rules\n' +
      '  (found ' + sheets.length + ' sheet(s), ' + totalRules + ' rule(s)). If the stylesheets moved,\n' +
      '  repoint this script IN THE SAME COMMIT as the move. Do not delete this\n' +
      '  assertion — it exists precisely because a vacuous pass still prints ✓.\n'
  )
  process.exit(1)
}

// A comment is not a declaration. The scan used to read the raw sheet, which
// was harmless while every rule named a type property — nobody writes
// `font-size:` in prose. `padding:` and `gap:` are different: four comment
// bodies in src/styles/ open an English sentence with one of those words and a
// colon, and three of them are real explanations that must not be reworded to
// please a linter. Blank the comment bodies but keep their LENGTH and their
// newlines, so every reported line number still points at the right line.
const stripComments = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))

// ---------------------------------------------------------------------------
// THE SPACING RESIDUE (ADR-0085)
//
// The padding/gap rule below says: no raw px. Two sweeps got it there.
//
// The first converted the 1086 literals a token already carried EXACTLY — 598
// on the 4px scale, 488 at the new half-steps 6/10/14 — and moved no value.
// The second rounded the odd 5/7/9/11/13px band DOWN one step: 231 literals in
// 222 declarations across 63 partials. That one DID move values, by 1px each,
// and it is the only rounding this codebase has agreed to. 406 literals are
// left, and they split into two kinds that are answered differently on purpose.
//
// 1. THE OPTICAL NUDGE, 1-3px. 363 literals in 348 declarations. #1128 already
//    grants margins their 1-3px nudges as real spacing rather than sloppiness,
//    and a 2px pad on a chip is the same correction on the same surface. No
//    token exists at 1, 2 or 3px and minting one would say these are steps of
//    the scale, which they are not — they are corrections to it. So the band is
//    EXEMPT, not listed: enumerating 348 sites would record nothing that has to
//    be decided. NUDGE_CEILING keeps the exemption from quietly becoming the
//    house style — see its note.
//
// 2. THE GENUINE ONE-OFFS, 43 literals in 22 partials, at 18px and up. These
//    are NOT exempt. They are listed, one entry per partial, value by value
//    with an exact count. Eleven of their seventeen values have no honest
//    rounding at all: five sit above the top of the scale, and six are exactly
//    midway between two steps. Where the value is load-bearing — a reserved
//    strip, a lab gutter, a safe-area offset — it wants an explaining comment
//    at the declaration, not a number moved.
//
// DO NOT ROUND A VALUE TO MAKE AN ENTRY GO AWAY. The odd band was rounded by a
// recorded decision over measured evidence, on all 231 of its sites at once.
// Rounding one entry here is a different act: a real spacing change, made by
// whoever happened to be editing that partial, on a surface nobody compared.
//
// The counts are exact in both directions, the same ratchet check-seal-scope.mjs
// uses. A literal that is not listed fails. A listed literal that is no longer
// there also fails, so the list can only shrink, and it cannot rot into a
// record of what the app used to look like.
const NUDGE_MAX = 3

const SPACING_RESIDUE = {
  '04a-wire-dock.css': { 62: 1 },
  '05-masthead-nav.css': { 18: 1 },
  '07-team-logo-and-buttons.css': { 18: 1 },
  '08-site-shell.css': { 23: 2 },
  '09-team-info.css': { 72: 1 },
  '11-innings.css': { 130: 1 },
  '12-sealbox.css': { 18: 1 },
  '16-identity-lab-shell.css': { 72: 1, 120: 1, 200: 1 },
  '19-pattern-and-sketch-labs.css': { 22: 1, 28: 1 },
  '21-box-score.css': { 72: 1 },
  '26-player-page.css': { 22: 1 },
  '30-standings.css': { 56: 1 },
  '31-wild-card.css': { 18: 5 },
  '34-postseason.css': { 56: 1 },
  '35-postseason-series.css': { 50: 2 },
  '42-first-scorebook.css': { 28: 2, 30: 1, 36: 1, 42: 1, 52: 1, 62: 1, 84: 1 },
  '63-print-sheet.css': { 72: 1 },
  '69-pitch-arsenal.css': { 18: 3, 44: 1 },
  '72-club-transactions.css': { 18: 1 },
  '77-express-lane.css': { 18: 1 },
  'report/charts.css': { 36: 3 },
  'scorecard/footer.css': { 72: 1 },
}

// WHY THE NUDGE BAND GETS A CEILING AND NOT A LIST. An exact count here would
// go red on ordinary work — a new component that pads a chip by 2px is normal,
// not a defect — and check-file-size.mjs already wrote down what happens to a
// guard that fires on normal work: it gets deleted. So the band is measured
// against a CEILING rounded up to the next 25, exactly that guard's reasoning.
// Growth inside the band is free; crossing it is a deliberate one-number edit
// that says the nudge stopped being a correction and became the house spacing.
// It only moves down: if the count falls a full band below, tighten it, so this
// number can never become a record of a codebase that no longer exists.
const NUDGE_CEILING = 375
const NUDGE_BAND = 25

// A live copy of the ledger, drawn down as each listed literal is found.
const owed = Object.fromEntries(
  Object.entries(SPACING_RESIDUE).map(([file, vals]) => [file, { ...vals }]),
)
let nudges = 0

// Matches a bare px length, and only a bare one. The lookbehind keeps the `2px`
// inside a token NAME out, the optional sign keeps a negative in — padding and
// gap cannot take one, so writing one is a mistake this rule should still
// catch rather than skip.
const RAW_PX = /(?<![\w.-])(-?\d+(?:\.\d+)?)px(?![\w-])/g

const spacingAllowed = (value, { name }) => {
  const bad = []
  for (const [, num] of value.matchAll(RAW_PX)) {
    const px = Math.abs(Number(num))
    if (px <= NUDGE_MAX) {
      nudges += 1
      continue
    }
    const bucket = owed[name]
    if (bucket?.[px] > 0) {
      bucket[px] -= 1
      continue
    }
    bad.push(px)
  }
  if (!bad.length) return true
  return (
    `${bad.map((n) => `${n}px`).join(', ')} is raw. Read a --space-* token, or — if ` +
    'no token carries that value and rounding to one would move a rendered pixel — ' +
    `add it to SPACING_RESIDUE['${name}'] in this guard and say why in the PR. ` +
    'Do not round the value to silence this.'
  )
}

const rules = [
  {
    property: 'font-size',
    allowed: (value) =>
      value.startsWith('var(') ||
      value.startsWith('clamp(') ||
      /^-?[0-9]+(?:\.[0-9]+)?em$/.test(value),
    guidance: 'use a semantic --fs-* token (relative em and responsive clamp values are allowed)',
  },
  {
    property: 'font-weight',
    allowed: (value) => value.startsWith('var(') || value === 'inherit',
    guidance: 'use a semantic --w-* token',
  },
  {
    property: 'line-height',
    allowed: (value) => value.startsWith('var('),
    guidance: 'use a semantic --lh-* token',
  },
  {
    property: 'letter-spacing',
    allowed: (value) => value.startsWith('var('),
    guidance: 'use a semantic --ls-* token',
  },
  {
    // WHY THIS ONE SPELLS ITS PROPERTIES OUT. Every other entry leans on the
    // match being unanchored: one `gap` pattern covers `row-gap` and
    // `column-gap` for free, because the property name is simply found inside
    // the longer one. That convenience does not survive contact with padding.
    // It cuts the wrong way for the longhands — `padding` is not followed by a
    // colon in `padding-top:`, so a bare `padding` entry silently skipped 289
    // declarations — and it cuts too far for `padding-inline`, which would
    // swallow the three `scroll-padding-inline` declarations in src/styles/ and
    // report them under the wrong rule. So this entry carries its own `head`
    // pattern: every spelling named, and a lookbehind that refuses to start
    // mid-word. Longest alternative first, so `padding-inline-start` is not
    // matched as `padding-inline` with a stray tail.
    property: 'padding / gap',
    head:
      '(?<![\\w-])(?:padding(?:-top|-right|-bottom|-left|-inline-start|-inline-end' +
      '|-block-start|-block-end|-inline|-block)?|(?:row-|column-)?gap)',
    allowed: spacingAllowed,
    guidance: 'use a --space-* token',
  },
]

for (const { rel, name, css } of sheets) {
  const scan = stripComments(css)
  for (const rule of rules) {
    // `head` is everything before the colon. It defaults to the bare property
    // name — unanchored, which is the behaviour the four type rules were
    // written against — and a rule that needs to be precise supplies its own.
    const declarations = new RegExp(`(${rule.head ?? rule.property})\\s*:\\s*([^;]+);`, 'g')
    for (const match of scan.matchAll(declarations)) {
      const value = match[2].trim()
      const verdict = rule.allowed(value, { name, rel })
      if (verdict === true) continue

      const line = scan.slice(0, match.index).split('\n').length
      const why = typeof verdict === 'string' ? verdict : rule.guidance
      errors.push(`${rel}:${line}: ${match[1]}: ${value}; — ${why}`)
    }
  }
}

// A ledger entry that is no longer reached is a rule that checks nothing. Fail
// on it, so converting a listed literal forces the count down in the same
// commit and the list can only ever shrink.
let listed = 0
for (const [file, vals] of Object.entries(owed)) {
  for (const [px, left] of Object.entries(vals)) {
    listed += SPACING_RESIDUE[file][px]
    if (left > 0) {
      errors.push(
        `src/styles/${file}: SPACING_RESIDUE lists ${SPACING_RESIDUE[file][px]}x ${px}px, ` +
          `but ${left} of them are gone. Lower the count — or drop the entry — in the ` +
          'commit that removed them.',
      )
    }
  }
}

if (nudges > NUDGE_CEILING) {
  errors.push(
    `the 1-${NUDGE_MAX}px optical-nudge exemption now covers ${nudges} literals in padding ` +
      `and gap, over the ${NUDGE_CEILING} ceiling. Raise NUDGE_CEILING to the next ` +
      `multiple of ${NUDGE_BAND} deliberately, or take the nudges back to the scale.`,
  )
} else if (nudges <= NUDGE_CEILING - NUDGE_BAND) {
  errors.push(
    `the optical-nudge count fell to ${nudges}, a full band under the ${NUDGE_CEILING} ` +
      `ceiling. Lower NUDGE_CEILING to ${Math.ceil(nudges / NUDGE_BAND) * NUDGE_BAND} so it ` +
      'keeps describing this codebase.',
  )
}

if (errors.length) {
  console.error('Typography scale guard failed:')
  for (const error of errors) console.error(`  ${error}`)
  process.exit(1)
}

console.log(
  `Typography scale guard passed — ${listed} listed off-scale padding/gap literals ` +
    `across ${Object.keys(SPACING_RESIDUE).length} partials, every one still reached, ` +
    `plus ${nudges} optical nudges under the ${NUDGE_CEILING} ceiling.`,
)
