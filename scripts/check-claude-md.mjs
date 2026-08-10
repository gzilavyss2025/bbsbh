#!/usr/bin/env node
// Guards the CLAUDE.md LEANNESS RULE (see the "Maintaining these docs" section
// of the root CLAUDE.md).
//
// The root CLAUDE.md is loaded into context on EVERY Claude Code session and
// persists the whole session, so its size is a fixed per-session token tax.
// This check fails the build if it grows past ROOT_MAX — mirroring
// check-caps.mjs (zero deps, run by `npm run lint`, so it gates every push).
//
// THE NESTED FILES ARE ALSO A TAX, just a conditional one. A nested CLAUDE.md
// loads in full the moment anyone works in its directory, which for src/api/
// and scripts/ is most sessions — so "move it to the nested file" was only ever
// half a fix, and the nested files grew to 741 and 646 lines with nothing
// watching. They now carry BUDGETS, on the same ratchet rule as
// check-dir-size.mjs: pinned at today's count, editable DOWNWARD only, and a
// file that drops below its budget must tighten it in the same commit so the
// number never quietly stops meaning anything.
//
// A NOTE ON MERGE ORDER, learned the same way check-dir-size.mjs learned it.
// These numbers are measured against the tree the branch was cut from, so a
// branch that sits behind `main` while other doc work lands will carry stale
// ones — and if it merges last, it turns `main` red for something no PR author
// did wrong. This guard hit it on its own first day: PR #602 grew
// src/CLAUDE.md from 434 to 441 lines mid-review. REBASE ONTO `main` AND
// RE-MEASURE BEFORE MERGING anything that touches BUDGETS.
//
// If this fails, DON'T just raise the cap. The tier below is the answer: move
// per-module detail into docs/* (which loads by reference, not by navigation)
// and leave a pointer. src/api/CLAUDE.md is the worked example — it went from
// 756 lines to 123 by moving its catalog into docs/api/, keeping only the
// spoiler rule that you must read BEFORE touching anything in that directory.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const ROOT_MAX = 200

// Ceiling for a nested CLAUDE.md with no budget entry. Deliberately generous
// against the root's 200: a nested file is paid for only when you work there.
const NESTED_MAX = 250

// Nested files already over the line, pinned at their measured count. Edit
// DOWNWARD as work lands; never upward. A new entry here is a deliberate
// decision that belongs in a PR description, not a reflex to make lint green.
const BUDGETS = {
  // scripts/CLAUDE.md is GONE from this table, and that is the outcome the
  // entry was here to produce. It carried 667 lines, two thirds of them a
  // per-generator catalog; that catalog is `docs/scripts/generators.md` now
  // and the file sits at 196, under NESTED_MAX with room to spare. Re-adding
  // an entry for it means the catalog started growing back into it.
  //
  // Screens, routing, the design system, and the UI half of the spoiler rule.
  'src/CLAUDE.md': 451,
  // The club-identity data model and the dev-only lab that writes it.
  'src/lib/CLAUDE.md': 385,
}

const NESTED = [
  'src/CLAUDE.md',
  'src/api/CLAUDE.md',
  'src/lib/CLAUDE.md',
  'src/components/CLAUDE.md',
  'scripts/CLAUDE.md',
  'test/CLAUDE.md',
]

function lineCount(path) {
  const parts = readFileSync(join(ROOT, path), 'utf8').split('\n')
  if (parts.length && parts[parts.length - 1] === '') parts.pop()
  return parts.length
}

const problems = []

const rootLines = lineCount('CLAUDE.md')
if (rootLines > ROOT_MAX) {
  problems.push(
    `root CLAUDE.md is ${rootLines} lines (max ${ROOT_MAX}). It loads on EVERY ` +
      'session — move detail into a nested CLAUDE.md or docs/* and leave a pointer.',
  )
}

for (const file of NESTED) {
  let lines
  try {
    lines = lineCount(file)
  } catch {
    problems.push(`${file} is named in this guard's nested list but no longer exists.`)
    continue
  }
  const budget = BUDGETS[file]
  if (budget == null) {
    if (lines > NESTED_MAX) {
      problems.push(
        `${file} is ${lines} lines (max ${NESTED_MAX}). It loads in full whenever ` +
          'anyone works in that directory. Move per-module detail into docs/* and ' +
          'leave a pointer — src/api/CLAUDE.md is the worked example.',
      )
    }
  } else if (lines > budget) {
    problems.push(
      `${file} is ${lines} lines, past its budget of ${budget}. Budgets only move ` +
        'DOWN. Move the new detail into docs/* instead.',
    )
  } else if (lines < budget) {
    problems.push(
      `${file} is down to ${lines} lines, under its budget of ${budget}. Tighten the ` +
        `entry in scripts/check-claude-md.mjs to ${lines} in this same commit, so the ` +
        'progress is recorded and the number keeps meaning something.',
    )
  }
}

for (const file of Object.keys(BUDGETS)) {
  if (!NESTED.includes(file)) {
    problems.push(`${file} has a budget but is not in this guard's nested list.`)
  }
}

if (problems.length) {
  console.error('\n✗ CLAUDE.md LEANNESS RULE violated:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  The tier below is the answer, not a bigger cap: docs/* loads by REFERENCE\n' +
      '  (when someone is pointed at it) rather than by NAVIGATION, so detail moved\n' +
      '  there costs nothing until it is wanted.\n',
  )
  process.exit(1)
}

const budgeted = Object.keys(BUDGETS).length
console.log(
  `✓ CLAUDE.md LEANNESS RULE holds — root is ${rootLines}/${ROOT_MAX} lines; ` +
    `${NESTED.length - budgeted} nested files under ${NESTED_MAX}, ${budgeted} on a shrinking budget.`,
)
