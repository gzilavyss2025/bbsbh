#!/usr/bin/env node
// Guards the Logbook's spoiler containment (ADR-0035, PRD step 8).
//
// A game stamp IS a final score — that is the artifact, not a side effect. It is
// safe for exactly one reason: a stamp only ever exists for a game its owner
// already finished revealing, which the server enforces on every mint. That
// argument collapses the moment a stamp renders somewhere the user has NOT
// revealed: a slate card, "pick up your pencil", any list of upcoming or
// unopened games. Nothing in the type system stops that; this does.
//
// Three assertions, cheapest first:
//
//   1. GameStamp.jsx is imported only by an allowlist.
//   2. StampGameButton.jsx (which imports GameStamp) is imported only by
//      BoxScore.jsx, so the chain has exactly one entry point into a game.
//   3. A named set of spoiler-critical surfaces mentions no stamp identifier at
//      all — a belt-and-braces check that also catches a copy-paste of the
//      markup rather than an import.
//
// Run by `npm run lint` (so it gates every push). Zero deps, walks src/.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC = join(ROOT, 'src')

// Who may render a stamp. Every entry here is a surface where EVERY game shown
// is already one of this user's own stamps (or, for the box score, a game whose
// score is already on screen behind the same reveal). Adding a name to this list
// is a spoiler-rule decision — read ADR-0035 first, and say in the PR why the
// new surface cannot show an unrevealed game.
const STAMP_ALLOWLIST = {
  'components/GameStamp.jsx': ['components/StampGameButton.jsx', 'screens/LogbookPage.jsx'],
  // The mint affordance lives inside the box score's SealBox reveal render
  // function (ADR-0002 is what makes that safe). One importer, on purpose.
  'components/StampGameButton.jsx': ['screens/BoxScore.jsx'],
}

// Surfaces that list games the user has NOT revealed. None of them may so much
// as name a stamp component.
const FORBIDDEN_SURFACES = [
  'screens/GameSelect.jsx',
  'components/GameCard.jsx',
  'components/ContinueScoring.jsx',
  'components/PastGameFlipCard.jsx',
  'components/GameResultFace.jsx',
  'components/Scorebug.jsx',
  'components/GameFinder.jsx',
  'components/DeckNudge.jsx',
]
const FORBIDDEN_IDENTIFIERS = ['GameStamp', 'StampGameButton', 'useStamps']

function sourceFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (entry.endsWith('.jsx') || entry.endsWith('.js')) out.push(full)
  }
  return out
}

const rel = (file) => file.slice(file.indexOf('src') + 4).replace(/\\/g, '/')

// Blank out comments so this file's own prose — and the long spoiler-rule
// headers on the components themselves — don't read as imports or usages.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/.*$/gm, (m) => ' '.repeat(m.length))
}

const problems = []
const files = sourceFiles(SRC)

// --- 1 + 2: the import allowlists -----------------------------------------
for (const [target, allowed] of Object.entries(STAMP_ALLOWLIST)) {
  const basename = target.slice(target.lastIndexOf('/') + 1)
  const importRe = new RegExp(`from\\s+['"][^'"]*${basename.replace('.', '\\.')}['"]`)
  const importers = []
  for (const file of files) {
    const name = rel(file)
    if (name === target) continue
    if (importRe.test(stripComments(readFileSync(file, 'utf8')))) importers.push(name)
  }
  for (const importer of importers) {
    if (!allowed.includes(importer)) {
      problems.push(
        `${importer} imports ${target}, which is not on that component's allowlist ` +
          `(${allowed.join(', ')}).`,
      )
    }
  }
}

// --- 3: the forbidden surfaces --------------------------------------------
for (const surface of FORBIDDEN_SURFACES) {
  const full = join(SRC, surface)
  let src
  try {
    src = stripComments(readFileSync(full, 'utf8'))
  } catch {
    // The file was renamed or removed. Say so rather than silently passing —
    // a guard that quietly stops checking anything is worse than none.
    problems.push(`${surface} is named in this guard's forbidden-surface list but no longer exists.`)
    continue
  }
  for (const identifier of FORBIDDEN_IDENTIFIERS) {
    if (new RegExp(`\\b${identifier}\\b`).test(src)) {
      problems.push(
        `${surface} references ${identifier}. This surface lists games the user has ` +
          `NOT revealed — a stamp there is a spoiler.`,
      )
    }
  }
}

if (problems.length) {
  console.error(
    '\n✗ Logbook stamp containment guard failed. A game stamp carries a final\n' +
      '  score; it is only safe where every game shown is one the user already\n' +
      '  revealed (ADR-0035). Problems:\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Fix the surface, or — if the new one genuinely cannot show an\n' +
      '  unrevealed game — widen STAMP_ALLOWLIST in this script deliberately and\n' +
      '  say why in the PR.\n',
  )
  process.exit(1)
}

console.log(
  '✓ Logbook stamp containment holds — GameStamp.jsx and StampGameButton.jsx are imported only from their allowlists.',
)
