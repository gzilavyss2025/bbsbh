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
// loads the first time Claude reads a file in its folder (and its parent
// folders' files load with it), then stays for the session. So a rule belongs
// in the deepest folder that every edit it governs passes through (ADR-0098),
// and a big nested file costs every session that touches its folder. They carry
// BUDGETS, on the same ratchet rule as check-dir-size.mjs: pinned at today's
// count, editable DOWNWARD only, and a file that drops below its budget must
// tighten it in the same commit so the number never quietly stops meaning
// anything.
//
// LINES ARE NOT THE WHOLE COST. A table row can hold thousands of characters
// on one line, so a line cap cannot see it: src/components/CLAUDE.md was 74
// lines and 30,038 characters. Each file also has a character cap, 80 times its
// line cap. No file needs a character budget today; add one, downward only,
// when a file must exceed its cap.
//
// A NOTE ON MERGE ORDER, learned the same way check-dir-size.mjs learned it.
// These numbers are measured against the tree the branch was cut from, so a
// branch that sits behind `main` while other doc work lands will carry stale
// ones — and if it merges last, it turns `main` red for something no PR author
// did wrong. This guard hit it on its own first day: a PR grew
// src/CLAUDE.md from 434 to 441 lines mid-review. REBASE ONTO `main` AND
// RE-MEASURE BEFORE MERGING anything that touches BUDGETS.
//
// If this fails, DON'T just raise the cap. The tier below is the answer: move
// per-module detail into docs/* (which loads by reference, not by navigation)
// or a deeper nested file, and leave a pointer. src/api/CLAUDE.md is the worked
// example: it moved its catalog into docs/api/ and kept only the spoiler rule
// that you must read BEFORE touching anything in that directory.
//
// The nested files are found by walking the tree, so a new one cannot skip the
// caps by being left off a list. scripts/check-claude-md-facts.mjs checks that
// the root file lists them all.

import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { ROOT, DEFAULT_SKIP, walk } from './lib/walk.mjs'

const ROOT_MAX = 200
const ROOT_MAX_CHARS = ROOT_MAX * 80

// Ceiling for a nested CLAUDE.md with no budget entry. Deliberately generous
// against the root's 200: a nested file is paid for only when you work there.
const NESTED_MAX = 250
const NESTED_MAX_CHARS = NESTED_MAX * 80

// Nested files already over the line, pinned at their measured count. Edit
// DOWNWARD as work lands; never upward. A new entry here is a deliberate
// decision that belongs in a PR description, not a reflex to make lint green.
const BUDGETS = {
  // Screens, routing, the design system, and the UI half of the spoiler rule.
  'src/CLAUDE.md': 255,
  // The club-identity data model; the stores moved to src/lib/data/.
  'src/lib/CLAUDE.md': 264,
}

// `.claude` holds the other agents' worktrees, each with a copy of every file.
const SKIP = new Set([...DEFAULT_SKIP, '.claude'])

function measure(path) {
  const text = readFileSync(join(ROOT, path), 'utf8')
  const parts = text.split('\n')
  if (parts.length && parts[parts.length - 1] === '') parts.pop()
  return { lines: parts.length, chars: text.length }
}

const NESTED = walk(ROOT, { skip: SKIP, exts: ['CLAUDE.md'] })
  .map((f) => relative(ROOT, f).split('\\').join('/'))
  .filter((f) => f !== 'CLAUDE.md')
  .sort()

const problems = []

const root = measure('CLAUDE.md')
if (root.lines > ROOT_MAX) {
  problems.push(
    `root CLAUDE.md is ${root.lines} lines (max ${ROOT_MAX}). It loads on EVERY ` +
      'session — move detail into a nested CLAUDE.md or docs/* and leave a pointer.',
  )
}
if (root.chars > ROOT_MAX_CHARS) {
  problems.push(
    `root CLAUDE.md is ${root.chars} characters (max ${ROOT_MAX_CHARS}). A long line ` +
      'costs as much as many short ones — move detail into a nested CLAUDE.md or docs/*.',
  )
}

for (const file of NESTED) {
  const { lines, chars } = measure(file)
  const budget = BUDGETS[file]
  if (budget == null) {
    if (lines > NESTED_MAX) {
      problems.push(
        `${file} is ${lines} lines (max ${NESTED_MAX}). It loads in full the first ` +
          'time Claude reads a file in that folder. Move per-module detail into docs/* ' +
          'or a deeper nested file and leave a pointer — src/api/CLAUDE.md is the worked example.',
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
  if (chars > NESTED_MAX_CHARS) {
    problems.push(
      `${file} is ${chars} characters (max ${NESTED_MAX_CHARS}). A long table row or ` +
        'paragraph hides under a line cap — split it, or move the reference into docs/*.',
    )
  }
}

for (const file of Object.keys(BUDGETS)) {
  if (!NESTED.includes(file)) {
    problems.push(`${file} has a budget but no such nested CLAUDE.md exists.`)
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
  `✓ CLAUDE.md LEANNESS RULE holds — root is ${root.lines}/${ROOT_MAX} lines; ` +
    `${NESTED.length - budgeted} nested files under ${NESTED_MAX}, ${budgeted} on a shrinking budget.`,
)
