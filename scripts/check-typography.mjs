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
// The padding/gap rule below says: no raw px. The sweep that turned the rule on
// converted the 1086 literals a token already carried EXACTLY — 598 on the 4px
// scale, 488 at the new half-steps 6/10/14. It moved no value. What is left is
// 637 literals that no token carries, and they split into two kinds that are
// answered differently on purpose.
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
// 2. EVERYTHING ELSE OFF THE SCALE, 274 literals in 72 partials. The odd
//    5/7/9/11/13px band and the genuine one-offs (18, 22, 28, 36, 72, 120,
//    200 ...). These are NOT exempt. They are listed, one entry per partial,
//    value by value with an exact count, and the list is the open question this
//    guard hands to the next slice. Rounding a value to make an entry go away
//    is the one repair that is forbidden: it is a real spacing change, and it
//    would be made by whoever happened to be editing that partial instead of by
//    the people who own the scale.
//
// The counts are exact in both directions, the same ratchet check-seal-scope.mjs
// uses. A literal that is not listed fails. A listed literal that is no longer
// there also fails, so the list can only shrink, and it cannot rot into a
// record of what the app used to look like.
const NUDGE_MAX = 3

const SPACING_RESIDUE = {
  '03-slate-header.css': { 7: 1, 9: 1 },
  '04-site-bar.css': { 5: 2, 7: 1 },
  '04a-wire-dock.css': { 62: 1 },
  '05-masthead-nav.css': { 7: 1, 9: 1, 18: 1 },
  '06-loader-and-cards.css': { 5: 2, 9: 3 },
  '07-team-logo-and-buttons.css': { 18: 1 },
  '08-site-shell.css': { 23: 2 },
  '09-team-info.css': { 5: 2, 7: 1, 72: 1 },
  '10-lineup.css': { 9: 2 },
  '11-innings.css': { 5: 1, 7: 1, 130: 1 },
  '12-sealbox.css': { 5: 5, 7: 2, 13: 2, 18: 1 },
  '13-play-by-play.css': { 5: 1, 7: 1 },
  '14-strike-zone.css': { 5: 3, 7: 2 },
  '16-identity-lab-shell.css': { 72: 1, 120: 1, 200: 1 },
  '19-pattern-and-sketch-labs.css': { 22: 1, 28: 1 },
  '20-charts.css': { 7: 2, 9: 1 },
  '21-box-score.css': { 5: 5, 9: 1, 72: 1 },
  '22-box-score-tables.css': { 5: 1 },
  '23-box-score-detail.css': { 5: 1, 7: 1 },
  '24-floating-nav-and-hud.css': { 5: 2, 9: 1 },
  '26-player-page.css': { 5: 5, 7: 2, 9: 1, 11: 3, 22: 1 },
  '26a-percentile-strip.css': { 7: 1, 9: 1 },
  '26b-player-contract.css': { 5: 2, 9: 2, 13: 2 },
  '26d-command-map.css': { 5: 2 },
  '26e-contract-history.css': { 5: 2 },
  '26f-glove-target.css': { 5: 1 },
  '26g-command-received.css': { 7: 1 },
  '27-player-position-innings.css': { 5: 1, 9: 4 },
  '28-team-hub.css': { 5: 2, 7: 3, 9: 3, 13: 1 },
  '28a-team-hub-hero.css': { 5: 2, 7: 1 },
  '29-team-transactions.css': { 5: 2, 7: 4, 9: 1 },
  '30-standings.css': { 5: 1, 9: 3, 11: 1, 56: 1 },
  '31-wild-card.css': { 5: 6, 7: 6, 9: 1, 18: 5 },
  '33-awards-history.css': { 5: 2, 9: 1 },
  '34-postseason.css': { 5: 1, 56: 1 },
  '35-postseason-series.css': { 7: 2, 9: 1, 11: 1, 50: 2 },
  '37-all-star-rosters.css': { 5: 1 },
  '38-umpire-pages.css': { 5: 2, 9: 1 },
  '39-manager-page.css': { 5: 1 },
  '40-game-modals.css': { 5: 1, 9: 1 },
  '42-first-scorebook.css': { 5: 4, 7: 2, 13: 2, 28: 2, 30: 1, 36: 1, 42: 1, 52: 1, 62: 1, 84: 1 },
  '43-foul-tracker.css': { 5: 3, 7: 1, 9: 1 },
  '44-pre-game-cards.css': { 7: 1 },
  '48a-logbook-stats.css': { 5: 1 },
  '50-logbook-landing.css': { 5: 1 },
  '51-similar-players.css': { 5: 4 },
  '52-highlight-clip-card.css': { 5: 3, 7: 1 },
  '53-umpire-tendencies.css': { 7: 3, 9: 2, 11: 3, 13: 7 },
  '61-ballpark-admin.css': { 5: 1 },
  '62-identity-admin.css': { 11: 2 },
  '63-print-sheet.css': { 72: 1 },
  '64-milb-alumni.css': { 5: 1 },
  '66-situational-records.css': { 7: 1 },
  '67-awards-ledger.css': { 5: 2, 7: 2, 9: 1 },
  '68-around-the-game.css': { 5: 1, 7: 1 },
  '69-hit-chart.css': { 5: 1, 7: 2, 9: 5, 11: 1 },
  '69-pitch-arsenal.css': { 5: 1, 7: 3, 9: 1, 18: 3, 44: 1 },
  '70-contracts-grid.css': { 5: 3, 7: 5, 13: 1 },
  '71-salaries-league.css': { 5: 3, 7: 2, 9: 3, 11: 1 },
  '72-club-transactions.css': { 18: 1 },
  '73-spray-map.css': { 5: 1, 7: 1 },
  '76-workload-marks.css': { 5: 3 },
  '77-express-lane.css': { 5: 1, 18: 1 },
  '77a-express-lane-entry.css': { 5: 1, 7: 1 },
  '78-offseason.css': { 7: 2 },
  'boxlines/boxlines.css': { 5: 1 },
  'boxlines/gamelines.css': { 7: 1 },
  'boxlines/listdoor.css': { 7: 1, 9: 1 },
  'designlab/lab.css': { 7: 1 },
  'report/charts.css': { 36: 3 },
  'scorecard/box.css': { 5: 1 },
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
