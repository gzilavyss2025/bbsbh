#!/usr/bin/env node
// Guards the "flat directories don't stay flat" rule in CLAUDE.md — the one
// convention in this repo that was written down, agreed, and then broken by an
// order of magnitude.
//
// The rule says to propose subdirectories before roughly the tenth file in a
// directory. src/components reached 126. src/api reached 84. Nothing caught it,
// because unlike the ALL-CAPS invariant or the CLAUDE.md line cap, this rule had
// no script behind it — and in this repo every convention with a guard held,
// while every convention that was only prose drifted. That is the whole argument
// for this file (ADR-0038).
//
// It is a RATCHET, not a cap: the directories that are already over the line
// carry a budget pinned at today's count, and a budget may only ever be edited
// DOWNWARD. Three ways to fail:
//
//   1. An unbudgeted directory exceeds MAX_FILES — subdivide it, or add a
//      budget deliberately and say why in the PR.
//   2. A budgeted directory GREW past its budget — the ratchet's main job.
//   3. A budgeted directory SHRANK below its budget, or no longer exists — the
//      budget is stale. Tighten it in the same commit that did the cleanup, so
//      progress is recorded and the number never quietly stops meaning anything.
//
// (3) is deliberate and is what makes this a ratchet rather than a high-water
// mark that rots. The failure message prints the exact number to paste.
//
// Run by `npm run lint` (so it gates every push).

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

// Roots to walk. Every directory beneath these is checked, counting only the
// source files sitting DIRECTLY in it (subdirectories are their own entry).
const ROOTS = ['src', 'api', 'scripts']
const SOURCE_EXT = ['.js', '.jsx', '.mjs', '.css']
const MAX_FILES = 12

// Directories already over the line, pinned at their measured count. Edit these
// DOWNWARD as work lands; never upward. A new entry here is a deliberate
// decision that belongs in a PR description, not a reflex to make lint green.
const BUDGETS = {
  'src/components': 125,
  'src/api': 84,
  scripts: 67,
  'src/lib': 50,
  'src/screens': 38,
  'src/hooks': 19,
  'src/screens/identity-lab': 15,
}

const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git'])

function walk(dir, out = []) {
  out.push(dir)
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (IGNORE_DIRS.has(entry)) continue
    const rel = `${dir}/${entry}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
  }
  return out
}

function countSources(dir) {
  return readdirSync(join(ROOT, dir)).filter((entry) => {
    if (!SOURCE_EXT.some((ext) => entry.endsWith(ext))) return false
    return statSync(join(ROOT, dir, entry)).isFile()
  }).length
}

const problems = []
const counts = new Map()

for (const root of ROOTS) {
  for (const dir of walk(root)) counts.set(dir, countSources(dir))
}

// 1 + 2: over the line.
for (const [dir, n] of [...counts].sort()) {
  const budget = BUDGETS[dir]
  if (budget == null) {
    if (n > MAX_FILES) {
      problems.push(
        `${dir} holds ${n} source files (max ${MAX_FILES}). Subdivide it — see the ` +
          `"Flat directories don't stay flat" rule in CLAUDE.md.`,
      )
    }
  } else if (n > budget) {
    problems.push(
      `${dir} grew to ${n} source files, past its budget of ${budget}. This ` +
        `directory is already over ${MAX_FILES} and may not get worse — put the new ` +
        `file in a subdirectory.`,
    )
  }
}

// 3: stale budgets.
for (const [dir, budget] of Object.entries(BUDGETS)) {
  const n = counts.get(dir)
  if (n == null) {
    problems.push(`${dir} has a budget of ${budget} in this guard but no longer exists — drop the entry.`)
  } else if (n <= MAX_FILES) {
    // Back under the cap, so it no longer needs an exception at all. This case
    // MUST come before the tighten-it branch below: without it, the guard would
    // hand you a sub-cap number to pin (say 11), and the directory would then be
    // held to a stricter limit than the CLAUDE.md rule this script enforces —
    // a legal 12th file failing with "already over 12", which is false. Same
    // surrender-the-entry rule as check-file-size.mjs.
    problems.push(
      `${dir} is down to ${n} source files, back under the ${MAX_FILES}-file cap. ` +
        `Drop its BUDGETS entry in this commit so the exception table keeps shrinking.`,
    )
  } else if (n < budget) {
    problems.push(
      `${dir} is down to ${n} source files but its budget still says ${budget}. ` +
        `Tighten it to ${n} in this commit — the ratchet only counts if it moves.`,
    )
  }
}

if (problems.length) {
  console.error(
    '\n✗ Directory-size guard failed. A directory nobody can hold in their head\n' +
      '  is where conventions go to die — this is the guard that stops\n' +
      '  src/components reaching 126 files a second time (ADR-0038). Problems:\n',
  )
  for (const p of problems) console.error(`  ${p}`)
  console.error(
    '\n  Fix by subdividing, or — if a directory genuinely belongs flat — edit\n' +
      '  BUDGETS in this script deliberately and say why in the PR.\n',
  )
  process.exit(1)
}

// Name the worst offender rather than hardcoding a directory that this guard's
// own third assertion is designed to eventually remove from the table.
const entries = Object.entries(BUDGETS)
const worst = entries.sort((a, b) => b[1] - a[1])[0]
console.log(
  `✓ Directory sizes hold — ${counts.size} directories under ${MAX_FILES} files, ` +
    `${entries.length} on a shrinking budget${worst ? ` (largest: ${worst[0]} ${worst[1]})` : ''}.`,
)
