#!/usr/bin/env node
// Guards the meaning of the kraft seal colour (ADR-0083).
//
// --seal is the one colour in this app that carries a PROMISE: it means the
// thing under it is sealed, and a tap will lift it. That promise is only worth
// anything if nothing else wears it. By #1138 the token was read 295 times
// across 67 partials — on rank chips, hover states, watch buttons, a rehab
// banner, the design lab's own verdict box — and every one of those diluted it.
//
// THE RULE: `var(--seal*)` may appear only where a reveal is possible.
//
// "A reveal is possible" means one of:
//   - the cover itself, its copy, and the tear it splits into;
//   - a control that LIFTS a seal — the reveal button, the standings reveal
//     chip, the Scores Unlocked switch, the consent to spoil a day (ADR-0026),
//     the scorecard's face-down at-bat, the due-up pill;
//   - the Game Log's mint strip, which is the one action that leaves something
//     behind on the far side of a seal (ADR-0035);
//   - the surfaces finding 9 of the design critique put on its must-survive
//     list, where kraft carries real meaning: the @ watermark, the Last 10
//     home-game ticket, the pencilled-in option year, and the club band's 3px
//     accent underline — on a themed page that underline is the CLUB's accent
//     (ADR-0030) and kraft is only its unthemed fallback.
//
// Everything else went to --marker (rank and flag emphasis) or to a structural
// token. The full classification, one row per read, is the ledger this guard
// was cut from: .scratch/design-system/prD/ledger.md.
//
// Three assertions:
//   1. Every `var(--seal*)` read in src/styles/ sits in an allowlisted
//      (file, selector) pair.
//   2. Every allowlisted pair is still REACHED. A guard that quietly stops
//      checking something is worse than no guard, so a selector that was
//      renamed or repainted fails here rather than rotting.
//   3. Outside src/styles/, only an allowlisted file may name --seal at all —
//      a component can set a token inline, and --marker is already reached
//      that way from src/lib/resultCards.js.
//
// Run by `npm run lint`. Zero deps, walks src/ and public/learn.css.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const STYLES = join(ROOT, 'src', 'styles')

// WHO MAY WEAR THE SEAL. Keyed by partial, then by the innermost selector the
// rule is written under. Adding a name here is a design-system decision — read
// ADR-0083 first, and say in the PR why a reveal is possible on that surface.
const ALLOWLIST = {
  // The Scores Unlocked switch, ON. It lifts every seal on the slate (ADR-0026).
  '03-slate-header.css': ['.daystate__chip--live-on'],

  // The "@" watermark, on the masthead and on a slate card. Finding 9's
  // must-survive list: the mark is the scorebook's own, drawn in tape amber.
  '05-masthead-nav.css': ['.masthead__at-ghost'],
  '06-loader-and-cards.css': ['.gamecard__atmark-ghost'],

  // .btn--reveal IS the cover carried into the innings bar. .liveedge replaces
  // it at the live frontier and says "the seal is off, and we're current".
  // .btn--seal is the Game Log's mint strip (ADR-0035).
  '07-team-logo-and-buttons.css': ['.liveedge', '.liveedge__dot', '.btn--reveal', '.btn--seal'],

  // The club band's 3px accent underline, themed. `var(--bar-accent, var(--seal))`
  // is the club-accent SLOT with kraft as its unthemed fallback (ADR-0030).
  '09-team-info.css': [
    '.is-themed .metricbar',
    '.is-themed .abs__title',
    '.is-themed .halfdefense__title',
    '.lineupteam.is-themed .lineupteam__name',
    '.roster.is-themed .roster__toggle',
  ],

  // The cover, its copy, the tear — and the six mastheads that wear the club
  // band's recipe unthemed.
  '12-sealbox.css': [
    '.sealbox.cover',
    '.sealtear__face',
    '.cover__main',
    '.cover__sub',
    '.abs__title',
    '.statbox__title',
    '.dueup__title',
    '.lineupcard__title',
    '.lineupteam__name',
    '.halfdefense__title',
  ],
  '13-play-by-play.css': ['.roster__toggle'],
  '20-charts.css': ['.winprob__head', '.marginnotes__title', '.pitchers__title'],
  '44-pre-game-cards.css': ['.metricbar'],
  '69-pitch-arsenal.css': ['.pitchslab__head', '.pitchslab__heat'],
  'focus/console.css': ['.gamehud--console'],
  // The two mock bands — the identity lab's and the team hub's identity drawer —
  // preview the real one, so they carry the real one's fallback.
  '17-identity-lab-workbench.css': ['.idlab__barmock'],
  '62-identity-admin.css': ['.idlab__barmock'],
  // The umpire-tendencies card opts OUT of club theming and restores the
  // DEFAULT band, so it moves with the band rather than away from it.
  '53-umpire-tendencies.css': ['.is-themed .umptend__bar'],

  // The pencilled-in option year on a contract. Finding 9's must-survive list.
  // `.contractcard__seg--option` sets --seg-dot, a CUSTOM PROPERTY rather than
  // a paint property — an indirection a sweep that only reads `background`,
  // `color` and `border` would have painted straight over.
  '26b-player-contract.css': ['.contractcard__seg--option', '.contractcard__openzone'],

  // The Last 10 Games home-game ticket, and the same home/away convention on
  // the season strip. Finding 9's must-survive list — the hatched win-loss
  // stamps are printed ON this kraft. contrastPairings.js pins the pair.
  '29-team-transactions.css': [
    '.last10__card--home .last10__stub',
    '.last10__card--home .last10__foot',
    '.last10__card--home .last10__cap',
    '.last10__card--home .last10__daynum',
    '.last10__card--home .last10__score',
    '.last10__card--home .last10__score--final',
    '.last10__card--home .last10__sep',
    '.last10__card--home .last10__meta',
    '.last10__card--home:hover .last10__stub',
    '.last10__card--home:hover .last10__foot',
    '.sstrip__cell--home',
    '.sstrip__cell--home.sstrip__cell--win',
    '.sstrip__cell--home.sstrip__cell--loss',
  ],

  // Controls that lift a seal.
  '30-standings.css': ['.standings-reveal'],
  '31-wild-card.css': ['.duepill'],
  '46-consent-modal.css': ['.consent__btn--confirm', '.modestrip'],
  'scorecard/box.css': ['.sc-ab__seal', '.sc-ab__sealtext', '.sc-ab__fliptext'],

  // "Score sealed" on the offseason notebook's picked game — the label that
  // says a result is still behind a cover.
  '78-offseason.css': ['.pgame__seal'],
}

// Outside src/styles/, a component may name --seal only if it is one of these.
// Each sets or reads the token rather than painting with it.
const NON_STYLE_ALLOWLIST = {
  // The band mock again, this time as an inline custom-property override: the
  // lab feeds a club's Bar/Accent/On-bar into --navy/--seal/--text-on-ink and
  // lets the cascade dress the real masthead rules.
  'src/screens/identity-lab/editors/WpaScenarios.jsx': true,
  // The OG poster renderer reads the token off :root to paint the same band on
  // a canvas, where no CSS rule can reach (api/preview.js, ADR-0012).
  'src/lib/preview/posterPaper.js': true,
  'src/lib/preview/posterHead.js': true,
  'src/lib/preview/posterInk.js': true,
  // The button class name, not the colour.
  'src/components/logbook/StampGameButton.jsx': true,
  'src/components/passport/BookOrderControl.jsx': true,
  'src/screens/logbook/NewBookPage.jsx': true,
  'src/screens/LogbookCollection.jsx': true,
  'src/components/SealBox.jsx': true,
  // The guard's own prose, the ledger the design lab prints, and the pairings.
  'src/lib/design/contrastPairings.js': true,
  'src/screens/designlab/catalog.js': true,
  'src/lib/clerkAppearance.js': true,
  'src/CLAUDE.md': true,
}

const READ = /var\(\s*--seal[a-z-]*/

function cssFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...cssFiles(full))
    else if (entry.endsWith('.css')) out.push(full)
  }
  return out
}

// Blank out comments, keeping newlines, so this repo's long design prose — which
// names --seal constantly, on purpose — never reads as a declaration.
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
}

// Walks a stylesheet tracking the selector each line sits under. Good enough
// for this codebase's hand-written CSS: no preprocessor, no nested at-rules
// beyond @media/@supports, which contribute no selector of their own.
function* declarations(css) {
  const lines = stripComments(css).split('\n')
  const stack = []
  let pending = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (READ.test(line)) {
      const innermost = stack.filter(Boolean).at(-1) ?? '(top level)'
      yield { line: i + 1, selector: innermost, text: line.trim() }
    }
    let buf = ''
    for (const ch of line) {
      if (ch === '{') {
        stack.push((pending + buf).trim().replace(/\s+/g, ' '))
        pending = ''
        buf = ''
      } else if (ch === '}') {
        stack.pop()
        pending = ''
        buf = ''
      } else if (ch === ';') {
        buf = ''
        pending = ''
      } else buf += ch
    }
    pending += `${buf} `
  }
}

const problems = []
const reached = new Set()
let reads = 0

for (const file of cssFiles(STYLES)) {
  const name = file.slice(STYLES.length + 1).split(sep).join('/')
  const allowed = ALLOWLIST[name]
  for (const decl of declarations(readFileSync(file, 'utf8'))) {
    reads += 1
    // A rule can list several selectors; the read is legal if ANY of them is
    // allowlisted, since they all paint the same declaration.
    const parts = decl.selector.split(',').map((s) => s.trim())
    const matches = allowed?.filter((sel) => parts.includes(sel)) ?? []
    if (matches.length) for (const sel of matches) reached.add(`${name} ${sel}`)
    else {
      problems.push(
        `${name}:${decl.line} — \`${decl.selector}\` reads the seal token, and no ` +
          `reveal is possible there.\n      ${decl.text}`,
      )
    }
  }
}

let allowlisted = 0
for (const [file, selectors] of Object.entries(ALLOWLIST)) {
  for (const sel of selectors) {
    allowlisted += 1
    if (!reached.has(`${file} ${sel}`)) {
      problems.push(
        `${file} — \`${sel}\` is allowlisted to wear the seal but no longer reads it. ` +
          'Take it off this list rather than leaving a rule that checks nothing.',
      )
    }
  }
}

// --- 3: everything outside src/styles/ ------------------------------------
const NAMES = /--seal[a-z-]*/
function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (full === STYLES) continue
      out.push(...sourceFiles(full))
    } else if (/\.(jsx?|md)$/.test(entry)) out.push(full)
  }
  return out
}
for (const file of sourceFiles(join(ROOT, 'src'))) {
  const name = file.slice(ROOT.length + 1).split(sep).join('/')
  if (NON_STYLE_ALLOWLIST[name]) continue
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
  if (NAMES.test(src)) {
    problems.push(
      `${name} names the seal token outside src/styles/. A component may only do ` +
        'that to set the band\'s accent slot or to paint an OG card — see this ' +
        "guard's NON_STYLE_ALLOWLIST.",
    )
  }
}

// src/tokens/ defines the family and public/learn.css mirrors the palette; the
// guide at /learn has no seals on it, so it may declare the token but not read it.
const learn = stripComments(readFileSync(join(ROOT, 'public', 'learn.css'), 'utf8'))
if (READ.test(learn)) {
  problems.push(
    'public/learn.css reads the seal token. /learn is a standalone guide ' +
      '(ADR-0053) with nothing sealed on it.',
  )
}

if (problems.length) {
  console.error(
    '\n✗ Seal-scope guard failed. --seal means SEALED: a tap will lift this.\n' +
      '  A surface that cannot be revealed must not wear it (ADR-0083).\n' +
      '  Rank and flag emphasis goes to --marker; a border on a control goes to\n' +
      '  a structural token. Problems:\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Repaint the surface, or — if a reveal genuinely IS possible there —\n' +
      '  widen ALLOWLIST in this script deliberately and say why in the PR.\n',
  )
  process.exit(1)
}

console.log(
  `✓ Seal scope holds — ${reads} \`var(--seal*)\` reads in src/styles/, all of them ` +
    `on one of the ${allowlisted} allowlisted selectors across ` +
    `${Object.keys(ALLOWLIST).length} partials, and every one of those selectors still reached.`,
)
