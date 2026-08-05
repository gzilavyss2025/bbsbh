#!/usr/bin/env node
// Caps how long a single source file may get, so the next src/index.css (29,828
// lines) or src/api/person.js (2,620) is caught while it is still small enough
// to split cheaply. Companion to check-dir-size.mjs; both are ADR-0038.
//
// A file this long is a maintenance problem in three specific ways: an agent
// cannot hold it in context, two agents editing different parts of it still
// collide (26 of the last 50 commits touched index.css), and a rule that lives
// halfway down it is a rule nobody finds.
//
// MAX_LINES sits between p90 (411) and p99 (1,470) of this repo's 481 source
// files, so it flags the genuinely large ones without turning the budget table
// into a second copy of the file listing.
//
// WHY THE RATCHET IS WEAKER HERE THAN IN check-dir-size.mjs. That guard fails
// when a directory shrinks below its budget, forcing the number down; a
// directory's file count changes rarely, so that costs an edit almost never.
// Line counts change on nearly every commit, so the same rule would fail lint
// constantly and get deleted within a week. A budget here is therefore a
// CEILING: growth past it fails, shrinkage is free. Rot is bounded by the third
// assertion instead — once a file drops back under MAX_LINES it must give up
// its exception, so the table can only shrink over time.
//
// Run by `npm run lint` (so it gates every push).

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const ROOTS = ['src', 'api', 'scripts']
const MAX_LINES = 600
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git'])
const SOURCE_EXT = ['.js', '.jsx', '.mjs', '.css']

// Files already over the line, pinned at their measured length. A budget is a
// ceiling and may only be edited DOWNWARD. Adding an entry is a deliberate
// decision for a PR description — the default answer to "this file is too long"
// is to split it, not to widen the table.
//
// src/index.css is the extreme case and the reason this guard exists. When it is
// split into partials, this entry must be REPLACED by one entry per partial that
// is still over MAX_LINES — that is the point, and it is what stops 29,828 lines
// evaporating into unrecorded 9,000-line pieces.
const BUDGETS = {
  'src/index.css': 29828,
  'src/api/person.js': 2620,
  'src/api/callout-notes.js': 2080,
  'src/api/playbyplay.js': 1784,
  'src/api/whatsBrewing.js': 1581,
  'scripts/gen-callouts.mjs': 1483,
  'src/screens/identity-lab/profiles/mlb.jsx': 1470,
  'src/screens/TeamInfo.jsx': 1342,
  'src/screens/BoxScore.jsx': 1216,
  'src/screens/FoulTrackerPage.jsx': 1168,
  'src/lib/teams.js': 1099,
  'scripts/gen-fouls.mjs': 996,
  'src/api/teamTransactions.js': 961,
  'src/screens/InningViewer.jsx': 912,
  'src/api/boxscore.js': 859,
  'src/screens/GameSelect.jsx': 854,
  'src/api/select.js': 796,
  'src/screens/PlayerPage.jsx': 726,
  'src/components/PlayByPlay.jsx': 687,
  'src/api/loadPlayer.js': 658,
  'src/api/tradeDeadline.js': 633,
  'src/api/person-fetch.js': 633,
  'scripts/gen-former-teammates.mjs': 614,
  'src/components/WinProbChart.jsx': 612,
}

function walk(dir, out = []) {
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (IGNORE_DIRS.has(entry)) continue
    const rel = `${dir}/${entry}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (SOURCE_EXT.some((ext) => entry.endsWith(ext))) out.push(rel)
  }
  return out
}

// Count the editor-visible lines: split on newlines and drop a single trailing
// empty, the same way check-claude-md.mjs does, so the two guards agree and the
// numbers in BUDGETS match what `wc -l` reports.
function lines(rel) {
  const parts = readFileSync(join(ROOT, rel), 'utf8').split('\n')
  if (parts.length && parts[parts.length - 1] === '') parts.pop()
  return parts.length
}

const problems = []
const measured = new Map()

for (const root of ROOTS) {
  for (const file of walk(root)) measured.set(file, lines(file))
}

// 1 + 2: over the line.
for (const [file, n] of [...measured].sort()) {
  const budget = BUDGETS[file]
  if (budget == null) {
    if (n > MAX_LINES) {
      problems.push(`${file} is ${n} lines (max ${MAX_LINES}). Split it, or add a budget deliberately.`)
    }
  } else if (n > budget) {
    problems.push(
      `${file} grew to ${n} lines, past its budget of ${budget}. This file is ` +
        `already over ${MAX_LINES} and may not get worse — put new code elsewhere.`,
    )
  }
}

// 3: budgets that have outlived their purpose.
for (const [file, budget] of Object.entries(BUDGETS)) {
  const n = measured.get(file)
  if (n == null) {
    problems.push(`${file} has a budget of ${budget} in this guard but no longer exists — drop the entry.`)
  } else if (n <= MAX_LINES) {
    problems.push(
      `${file} is down to ${n} lines, back under the ${MAX_LINES}-line cap. Drop ` +
        `its BUDGETS entry in this commit so the exception table keeps shrinking.`,
    )
  }
}

if (problems.length) {
  console.error(
    '\n✗ File-size guard failed. A file too long to hold in context is one two\n' +
      '  agents cannot edit without colliding, and one whose rules nobody finds\n' +
      '  (ADR-0038). Problems:\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Fix by splitting the file. Widening BUDGETS is the last resort, not the\n' +
      '  first — and it is never the fix for a file that just grew.\n',
  )
  process.exit(1)
}

const budgeted = Object.keys(BUDGETS).length
console.log(
  `✓ File sizes hold — ${measured.size} source files under ${MAX_LINES} lines, ` +
    `${budgeted} on a ceiling (largest: src/index.css ${BUDGETS['src/index.css']}).`,
)
